// Phase 2 – orders: created on quote acceptance, confirmed by the advance payment, picked by
// scanning serials, dispatched (stock leaves the warehouse) and delivered (warranties start).
// Every state change runs in ONE transaction with the order row locked (SELECT ... FOR UPDATE),
// so two people acting on the same order are serialised; cross-order races (two scanners, two
// dispatches sharing stock) are stopped by conditional UPDATEs that only succeed while the
// unit is still free / the stock is still there.
const { query, withTransaction } = require('../config/db');
const { advancePercent, jobLeadDays } = require('../config/env');
const AppError = require('../utils/AppError');
const { round2 } = require('../utils/money');
const { canAccessLead, isScopedStaff } = require('../utils/access');
const { ORDER_STATUS: O, assertOrderStatus, transitionOrder } = require('../utils/orderStatus');

const note = (client, leadId, actorId, text) =>
  client.query(`INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`, [
    leadId,
    actorId,
    text,
  ]);

const rs = (n) => `Rs ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------------------------
// A2 – order is born when a quote is ACCEPTED (called inside the quote-status transaction)
// ---------------------------------------------------------------------------------------------
async function createOrderForQuote(client, quote, actor) {
  const advanceRequired = round2((Number(quote.total) * advancePercent) / 100);
  const { rows } = await client.query(
    `INSERT INTO orders (lead_id, quote_id, total_amount, advance_pct, advance_required, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (quote_id) DO NOTHING
     RETURNING *`,
    [quote.lead_id, quote.id, quote.total, advancePercent, advanceRequired, actor.id],
  );
  if (!rows.length) return null; // order already existed for this quote
  const order = rows[0];
  await note(
    client,
    quote.lead_id,
    actor.id,
    `Order ${order.order_number} created from quote ${quote.quote_number}: total ${rs(order.total_amount)}, advance ${rs(advanceRequired)} (${advancePercent}%) due`,
  );
  return order;
}

// ---------------------------------------------------------------------------------------------
// Access + loading
// ---------------------------------------------------------------------------------------------
/** Loads an order (optionally FOR UPDATE) and applies the lead-ownership rule: 404 if not visible. */
async function loadOrder(db, orderId, user, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT o.*, l.assigned_to, l.customer_name, l.lead_code
       FROM orders o JOIN leads l ON l.id = o.lead_id
      WHERE o.id = $1${lock ? ' FOR UPDATE OF o' : ''}`,
    [orderId],
  );
  if (!rows.length || !canAccessLead(user, rows[0])) throw AppError.notFound('Order');
  return rows[0];
}

/** Pick list lines with product info, how many are available, and whether each line is done. */
async function pickList(db, orderId) {
  const { rows } = await db.query(
    `SELECT pl.id, pl.product_id, p.sku, p.name, p.unit, p.category, pl.is_serialized,
            pl.qty_required, pl.qty_scanned,
            ARRAY(SELECT i.serial_number FROM inventory_items i
                   WHERE i.order_id = pl.order_id AND i.product_id = pl.product_id ORDER BY i.serial_number) AS scanned_serials,
            CASE WHEN pl.is_serialized
                 THEN (SELECT count(*) FROM inventory_items i WHERE i.product_id = p.id AND i.status = 'IN_STOCK')
                 ELSE p.stock_qty END AS available,
            CASE WHEN pl.is_serialized THEN pl.qty_scanned >= pl.qty_required
                 ELSE p.stock_qty >= pl.qty_required OR pl.qty_scanned >= pl.qty_required END AS ready
       FROM pick_list_items pl JOIN products p ON p.id = pl.product_id
      WHERE pl.order_id = $1
      ORDER BY pl.is_serialized DESC, p.sku`,
    [orderId],
  );
  const serialLines = rows.filter((r) => r.is_serialized);
  return {
    lines: rows,
    serialsRequired: serialLines.reduce((s, r) => s + Number(r.qty_required), 0),
    serialsScanned: serialLines.reduce((s, r) => s + Number(r.qty_scanned), 0),
    complete: serialLines.every((r) => Number(r.qty_scanned) >= Number(r.qty_required)),
    readyToDispatch: rows.length > 0 && rows.every((r) => r.ready),
  };
}

// ---------------------------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------------------------
async function listOrders({ status, q }, user) {
  const search = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null; // escape LIKE wildcards
  const { rows } = await query(
    `SELECT o.id, o.quote_id, o.order_number, o.status, o.total_amount, o.advance_required, o.amount_paid,
            o.total_amount - o.amount_paid AS balance_due, o.created_at, o.confirmed_at,
            l.id AS lead_id, l.lead_code, l.customer_name, l.phone, l.city, u.name AS assigned_to_name,
            q.quote_number, j.scheduled_date AS job_date
       FROM orders o
       JOIN leads l  ON l.id = o.lead_id
       JOIN quotes q ON q.id = o.quote_id
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN installation_jobs j ON j.order_id = o.id
      WHERE ($1::order_status IS NULL OR o.status = $1)
        AND ($2::bigint IS NULL OR l.assigned_to = $2)
        AND ($3::text IS NULL OR o.order_number ILIKE $3 OR l.customer_name ILIKE $3 OR l.city ILIKE $3 OR l.lead_code ILIKE $3)
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [status, isScopedStaff(user) ? user.id : null, search],
  );
  return rows;
}

async function getOrderDetail(orderId, user) {
  if (user.role === 'TECHNICIAN') {
    // a technician may open an order only when they are the crew lead of its installation job
    const crew = await query('SELECT 1 FROM installation_jobs WHERE order_id = $1 AND crew_lead_id = $2', [orderId, user.id]);
    if (!crew.rows.length) throw AppError.notFound('Order');
  }
  const order = await loadOrder({ query }, orderId, user);
  const [lead, quote, payments, pick, serials, dispatch, job, warranties] = await Promise.all([
    query(`SELECT id, lead_code, customer_name, phone, email, address, city, state, pincode FROM leads WHERE id = $1`, [order.lead_id]),
    query(
      `SELECT q.id, q.quote_number, q.package_kind, q.capacity_kw, q.includes_installation,
              t.name || CASE WHEN q.includes_installation THEN ' + Installation' ELSE '' END AS package_name
         FROM quotes q LEFT JOIN package_templates t ON t.id = q.template_id WHERE q.id = $1`,
      [order.quote_id],
    ),
    query(
      `SELECT p.*, u.name AS received_by_name FROM payments p LEFT JOIN users u ON u.id = p.received_by
        WHERE p.order_id = $1 ORDER BY p.paid_at, p.id`,
      [orderId],
    ),
    pickList({ query }, orderId),
    query(
      `SELECT i.id, i.serial_number, i.status, i.product_id, p.sku, p.name, p.category, p.warranty_months, i.updated_at
         FROM inventory_items i JOIN products p ON p.id = i.product_id
        WHERE i.order_id = $1 ORDER BY p.sku, i.serial_number`,
      [orderId],
    ),
    query(
      `SELECT d.*, a.name AS dispatched_by_name, c.name AS delivered_confirmed_by_name
         FROM dispatches d LEFT JOIN users a ON a.id = d.dispatched_by LEFT JOIN users c ON c.id = d.delivered_confirmed_by
        WHERE d.order_id = $1`,
      [orderId],
    ),
    query(
      `SELECT j.*, u.name AS crew_lead_name FROM installation_jobs j LEFT JOIN users u ON u.id = j.crew_lead_id
        WHERE j.order_id = $1`,
      [orderId],
    ),
    query(
      `SELECT w.*, i.serial_number, p.sku, p.name, p.category FROM warranties w
         JOIN inventory_items i ON i.id = w.inventory_item_id JOIN products p ON p.id = i.product_id
        WHERE w.order_id = $1 ORDER BY p.sku, i.serial_number`,
      [orderId],
    ),
  ]);
  const { assigned_to, customer_name, lead_code, ...o } = order;
  return {
    ...o,
    balance_due: round2(o.total_amount - o.amount_paid),
    lead: lead.rows[0],
    quote: quote.rows[0],
    payments: payments.rows,
    pick_list: pick,
    serials: serials.rows,
    dispatch: dispatch.rows[0] || null,
    installation_job: job.rows[0] || null,
    warranties: warranties.rows,
  };
}

async function getPickList(orderId, user) {
  const order = await loadOrder({ query }, orderId, user);
  return { order_id: order.id, order_number: order.order_number, status: order.status, ...(await pickList({ query }, orderId)) };
}

// ---------------------------------------------------------------------------------------------
// A3 – payments. Crossing the advance threshold confirms the order, builds the pick list
// from the quote lines and creates the installation job – all in the same transaction.
// ---------------------------------------------------------------------------------------------
async function recordPayment(orderId, { amount, type, mode, reference }, actor) {
  return withTransaction(async (client) => {
    let order = await loadOrder(client, orderId, actor, { lock: true });
    const balance = round2(order.total_amount - order.amount_paid);
    if (balance <= 0) throw AppError.conflict(`Order ${order.order_number} is already fully paid`, 'ALREADY_PAID');
    if (amount > balance) {
      throw AppError.conflict(`Payment of ${rs(amount)} is more than the balance due (${rs(balance)})`, 'OVERPAYMENT', {
        balanceDue: balance,
      });
    }

    // type: given by staff, or inferred – money before confirmation is advance (or FULL if it
    // clears the whole amount at once); money after confirmation is balance
    const paymentType =
      type ||
      (order.status === O.PENDING_PAYMENT
        ? Number(order.amount_paid) === 0 && amount === balance
          ? 'FULL'
          : 'ADVANCE'
        : 'BALANCE');

    const payRes = await client.query(
      `INSERT INTO payments (order_id, amount, type, mode, reference, received_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [order.id, amount, paymentType, mode, reference, actor.id],
    );
    const upd = await client.query(
      `UPDATE orders SET amount_paid = amount_paid + $2 WHERE id = $1 RETURNING *`,
      [order.id, amount],
    );
    order = { ...order, ...upd.rows[0] };
    await note(client, order.lead_id, actor.id, `Order ${order.order_number}: ${paymentType} payment ${rs(amount)} received (${mode}${reference ? `, ref ${reference}` : ''})`);

    let confirmed = false;
    if (order.status === O.PENDING_PAYMENT && Number(order.amount_paid) >= Number(order.advance_required)) {
      order = { ...order, ...(await transitionOrder(client, order, O.CONFIRMED)) };
      confirmed = true;

      // pick list = the hardware on the accepted quote (services are not picked)
      const pl = await client.query(
        `INSERT INTO pick_list_items (order_id, product_id, is_serialized, qty_required)
         SELECT $1, qi.product_id, p.is_serialized, sum(qi.quantity)
           FROM quote_items qi JOIN products p ON p.id = qi.product_id
          WHERE qi.quote_id = $2 AND p.category <> 'SERVICE'
          GROUP BY qi.product_id, p.is_serialized
         ON CONFLICT (order_id, product_id) DO NOTHING
         RETURNING id`,
        [order.id, order.quote_id],
      );

      // installation job (only when the quote includes our installation service)
      const q = await client.query('SELECT includes_installation FROM quotes WHERE id = $1', [order.quote_id]);
      let job = null;
      if (q.rows[0]?.includes_installation) {
        const jr = await client.query(
          `INSERT INTO installation_jobs (order_id, scheduled_date) VALUES ($1, current_date + $2::int)
           ON CONFLICT (order_id) DO NOTHING RETURNING *`,
          [order.id, jobLeadDays],
        );
        job = jr.rows[0];
      }
      await note(
        client,
        order.lead_id,
        actor.id,
        `Order ${order.order_number} CONFIRMED: pick list of ${pl.rowCount} lines created${job ? `, installation job pencilled for ${job.scheduled_date}` : ''}`,
      );
    }

    return { order, payment: payRes.rows[0], confirmed, balance_due: round2(order.total_amount - order.amount_paid) };
  });
}

// ---------------------------------------------------------------------------------------------
// A5 – scan a serial onto an order (reserve it), or undo a wrong scan
// ---------------------------------------------------------------------------------------------
const normaliseSerial = (s) => String(s || '').trim().toUpperCase();

async function scanSerial(orderId, rawSerial, actor) {
  const serial = normaliseSerial(rawSerial);
  return withTransaction(async (client) => {
    const order = await loadOrder(client, orderId, actor, { lock: true }); // serialises scans of this order
    assertOrderStatus(order, [O.CONFIRMED], 'scan items');

    const itemRes = await client.query(
      `SELECT i.*, p.sku, p.name, o.order_number AS held_by_order
         FROM inventory_items i JOIN products p ON p.id = i.product_id
         LEFT JOIN orders o ON o.id = i.order_id
        WHERE i.serial_number = $1`,
      [serial],
    );
    if (!itemRes.rows.length) throw AppError.conflict(`Serial ${serial} was not found in stock`, 'SERIAL_NOT_FOUND', { serial });
    const item = itemRes.rows[0];

    if (item.status !== 'IN_STOCK') {
      const mine = Number(item.order_id) === Number(order.id);
      throw AppError.conflict(
        mine
          ? `Serial ${serial} is already scanned for this order`
          : `Serial ${serial} is already ${item.status.toLowerCase()}${item.held_by_order ? ` for order ${item.held_by_order}` : ''}`,
        'SERIAL_NOT_AVAILABLE',
        { serial, status: item.status },
      );
    }

    const lineRes = await client.query(
      `SELECT * FROM pick_list_items WHERE order_id = $1 AND product_id = $2 AND is_serialized`,
      [order.id, item.product_id],
    );
    if (!lineRes.rows.length) {
      throw AppError.conflict(`${item.name} (${item.sku}) is not on this order's pick list`, 'NOT_ON_PICK_LIST', { serial, sku: item.sku });
    }
    const line = lineRes.rows[0];
    if (Number(line.qty_scanned) >= Number(line.qty_required)) {
      throw AppError.conflict(`${item.sku} line is already fully scanned (${line.qty_scanned}/${line.qty_required})`, 'LINE_FULLY_SCANNED', {
        sku: item.sku,
      });
    }

    // THE safety query: only succeeds if the unit is still free – even with two scanners at once
    const reserved = await client.query(
      `UPDATE inventory_items SET status = 'RESERVED', order_id = $1
        WHERE serial_number = $2 AND status = 'IN_STOCK'
        RETURNING *`,
      [order.id, serial],
    );
    if (!reserved.rows.length) {
      throw AppError.conflict(`Serial ${serial} was just taken by another order`, 'SERIAL_NOT_AVAILABLE', { serial });
    }
    await client.query(
      `UPDATE pick_list_items SET qty_scanned = qty_scanned + 1 WHERE id = $1 AND qty_scanned < qty_required`,
      [line.id],
    );
    return { scanned: { ...reserved.rows[0], sku: item.sku, name: item.name }, pick_list: await pickList(client, order.id) };
  });
}

async function unscanSerial(orderId, rawSerial, actor) {
  const serial = normaliseSerial(rawSerial);
  return withTransaction(async (client) => {
    const order = await loadOrder(client, orderId, actor, { lock: true });
    assertOrderStatus(order, [O.CONFIRMED], 'undo a scan');
    const { rows } = await client.query(
      `UPDATE inventory_items SET status = 'IN_STOCK', order_id = NULL
        WHERE serial_number = $1 AND order_id = $2 AND status = 'RESERVED'
        RETURNING *`,
      [serial, order.id],
    );
    if (!rows.length) throw AppError.notFound(`Scanned serial ${serial} on this order`);
    await client.query(
      `UPDATE pick_list_items SET qty_scanned = qty_scanned - 1
        WHERE order_id = $1 AND product_id = $2 AND qty_scanned > 0`,
      [order.id, rows[0].product_id],
    );
    return { released: rows[0], pick_list: await pickList(client, order.id) };
  });
}

// ---------------------------------------------------------------------------------------------
// A6 – dispatch: 409 unless every serialized line is scanned and bulk stock is enough
// ---------------------------------------------------------------------------------------------
async function dispatchOrder(orderId, { vehicleNo, driverName }, actor) {
  return withTransaction(async (client) => {
    const order = await loadOrder(client, orderId, actor, { lock: true });
    assertOrderStatus(order, [O.CONFIRMED], 'dispatch');

    const { rows: lines } = await client.query(
      `SELECT pl.*, p.sku, p.name, p.stock_qty FROM pick_list_items pl JOIN products p ON p.id = pl.product_id
        WHERE pl.order_id = $1 ORDER BY pl.product_id`, // fixed order -> no deadlocks between dispatches
      [order.id],
    );
    const missing = lines
      .filter((l) => l.is_serialized && Number(l.qty_scanned) < Number(l.qty_required))
      .map((l) => ({ sku: l.sku, required: Number(l.qty_required), scanned: Number(l.qty_scanned) }));
    if (missing.length) {
      throw AppError.conflict(`Pick list is not complete: ${missing.map((m) => `${m.sku} ${m.scanned}/${m.required}`).join(', ')}`, 'PICK_LIST_INCOMPLETE', { missing });
    }
    const short = lines
      .filter((l) => !l.is_serialized && Number(l.stock_qty) < Number(l.qty_required))
      .map((l) => ({ sku: l.sku, required: Number(l.qty_required), available: Number(l.stock_qty) }));
    if (short.length) {
      throw AppError.conflict(`Not enough stock: ${short.map((s) => `${s.sku} needs ${s.required}, has ${s.available}`).join('; ')}`, 'INSUFFICIENT_STOCK', { short });
    }

    // Bulk stock out. THE safety query: stock can never go negative, even if another dispatch
    // took it between our check and now -> 0 rows -> 409, and the whole transaction rolls back.
    for (const l of lines.filter((x) => !x.is_serialized)) {
      const dec = await client.query(
        `UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2 AND stock_qty >= $1 RETURNING stock_qty`,
        [l.qty_required, l.product_id],
      );
      if (!dec.rows.length) {
        throw AppError.conflict(`Not enough stock for ${l.sku} (needs ${l.qty_required})`, 'INSUFFICIENT_STOCK', { sku: l.sku });
      }
      await client.query(`UPDATE pick_list_items SET qty_scanned = qty_required WHERE id = $1`, [l.id]); // picked
      await client.query(
        `INSERT INTO stock_movements (product_id, qty_change, reason, order_id, created_by)
         VALUES ($1, $2, 'DISPATCHED', $3, $4)`,
        [l.product_id, -Number(l.qty_required), order.id, actor.id],
      );
    }

    // Serialized units leave the warehouse
    const sent = await client.query(
      `UPDATE inventory_items SET status = 'DISPATCHED' WHERE order_id = $1 AND status = 'RESERVED' RETURNING product_id`,
      [order.id],
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, qty_change, reason, order_id, created_by)
       SELECT product_id, -count(*), 'DISPATCHED', $1, $2 FROM inventory_items
        WHERE order_id = $1 AND status = 'DISPATCHED' GROUP BY product_id`,
      [order.id, actor.id],
    );

    const d = await client.query(
      `INSERT INTO dispatches (order_id, vehicle_no, driver_name, dispatched_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [order.id, vehicleNo, driverName, actor.id],
    );
    const updated = await transitionOrder(client, order, O.DISPATCHED);
    await note(client, order.lead_id, actor.id, `Order ${order.order_number} DISPATCHED on ${vehicleNo} (driver ${driverName}): ${sent.rowCount} serialized units + ${lines.filter((x) => !x.is_serialized).length} bulk lines`);
    return { order: updated, dispatch: d.rows[0], serials_dispatched: sent.rowCount };
  });
}

// ---------------------------------------------------------------------------------------------
// A7 – deliver: serials DELIVERED and a warranty for every serial (end = start + product months)
// ---------------------------------------------------------------------------------------------
async function deliverOrder(orderId, actor) {
  return withTransaction(async (client) => {
    let order;
    if (actor.role === 'TECHNICIAN') {
      // technicians may confirm delivery only for jobs where they are the crew lead
      const { rows } = await client.query(
        `SELECT o.* FROM orders o JOIN installation_jobs j ON j.order_id = o.id
          WHERE o.id = $1 AND j.crew_lead_id = $2 FOR UPDATE OF o`,
        [orderId, actor.id],
      );
      if (!rows.length) throw AppError.notFound('Order');
      order = rows[0];
    } else {
      order = await loadOrder(client, orderId, actor, { lock: true });
    }
    assertOrderStatus(order, [O.DISPATCHED], 'confirm delivery');

    await client.query(`UPDATE inventory_items SET status = 'DELIVERED' WHERE order_id = $1 AND status = 'DISPATCHED'`, [order.id]);
    const w = await client.query(
      `INSERT INTO warranties (inventory_item_id, order_id, start_date, end_date, months)
       SELECT i.id, i.order_id, current_date,
              (current_date + make_interval(months => p.warranty_months))::date, p.warranty_months
         FROM inventory_items i JOIN products p ON p.id = i.product_id
        WHERE i.order_id = $1 AND i.status = 'DELIVERED'
       ON CONFLICT (inventory_item_id) DO NOTHING
       RETURNING *`,
      [order.id],
    );
    await client.query(
      `UPDATE dispatches SET delivered_at = now(), delivered_confirmed_by = $2 WHERE order_id = $1`,
      [order.id, actor.id],
    );
    const updated = await transitionOrder(client, order, O.DELIVERED);
    await note(client, order.lead_id, actor.id, `Order ${order.order_number} DELIVERED: ${w.rowCount} warranties started`);
    return { order: updated, warranties_started: w.rowCount, warranties: w.rows };
  });
}

module.exports = {
  createOrderForQuote,
  listOrders,
  getOrderDetail,
  getPickList,
  recordPayment,
  scanSerial,
  unscanSerial,
  dispatchOrder,
  deliverOrder,
};
