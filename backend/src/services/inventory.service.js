// Phase 2 – inventory: stock levels with a low-stock flag, stock-in (bulk quantity or a list of
// serials), serial search and the stock ledger (stock_movements). Inventory is shared by the
// whole company, so it is not limited by lead ownership.
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');

/** Every stocked product (services excluded) with available quantity and a lowStock flag. */
async function listInventory({ q, lowOnly }) {
  const search = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const { rows } = await query(
    `SELECT p.id, p.sku, p.name, p.category, p.brand, p.unit, p.unit_price, p.is_serialized, p.warranty_months,
            p.reorder_level, p.stock_qty,
            coalesce(s.in_stock, 0)   AS serials_in_stock,
            coalesce(s.reserved, 0)   AS serials_reserved,
            coalesce(s.dispatched, 0) AS serials_dispatched,
            coalesce(s.delivered, 0)  AS serials_delivered,
            CASE WHEN p.is_serialized THEN coalesce(s.in_stock, 0) ELSE p.stock_qty END AS available
       FROM products p
       LEFT JOIN (
         SELECT product_id,
                count(*) FILTER (WHERE status = 'IN_STOCK')   AS in_stock,
                count(*) FILTER (WHERE status = 'RESERVED')   AS reserved,
                count(*) FILTER (WHERE status = 'DISPATCHED') AS dispatched,
                count(*) FILTER (WHERE status IN ('DELIVERED', 'INSTALLED')) AS delivered
           FROM inventory_items GROUP BY product_id
       ) s ON s.product_id = p.id
      WHERE p.is_active AND p.category <> 'SERVICE'
        AND ($1::text IS NULL OR p.sku ILIKE $1 OR p.name ILIKE $1)
      ORDER BY p.category, p.sku`,
    [search],
  );
  const items = rows.map((r) => ({ ...r, low_stock: Number(r.available) <= Number(r.reorder_level) }));
  return lowOnly ? items.filter((r) => r.low_stock) : items;
}

/**
 * Stock-in. Bulk product: { productId, quantity }. Serialized product: { productId, serials: [] }.
 * Duplicate serials (already in the system, or repeated in the request) -> nothing is saved.
 */
async function receiveStock({ productId, quantity, serials, purchaseCost, note }, actor) {
  return withTransaction(async (client) => {
    const pr = await client.query(
      `SELECT id, sku, name, category, is_serialized FROM products WHERE id = $1 AND is_active FOR UPDATE`,
      [productId],
    );
    if (!pr.rows.length) throw AppError.notFound('Product');
    const product = pr.rows[0];
    if (product.category === 'SERVICE') throw AppError.badRequest(`${product.sku} is a service and has no stock`);

    if (product.is_serialized) {
      if (!serials?.length) {
        throw AppError.badRequest(`${product.sku} is tracked by serial number: send "serials": [...]`, { field: 'serials' });
      }
      const existing = await client.query(
        `SELECT serial_number FROM inventory_items WHERE serial_number = ANY($1::text[])`,
        [serials],
      );
      if (existing.rows.length) {
        throw AppError.conflict(`Serial number(s) already exist: ${existing.rows.map((r) => r.serial_number).join(', ')}`, 'DUPLICATE_SERIAL', {
          duplicates: existing.rows.map((r) => r.serial_number),
        });
      }
      const ins = await client.query(
        `INSERT INTO inventory_items (product_id, serial_number, purchase_cost)
         SELECT $1, s, $3 FROM unnest($2::text[]) AS s
         RETURNING id, serial_number, status`,
        [product.id, serials, purchaseCost],
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, qty_change, reason, note, created_by) VALUES ($1, $2, 'RECEIVED', $3, $4)`,
        [product.id, ins.rowCount, note, actor.id],
      );
      return { product: product.sku, received: ins.rowCount, serials: ins.rows };
    }

    if (!quantity) {
      throw AppError.badRequest(`${product.sku} is tracked by quantity: send "quantity"`, { field: 'quantity' });
    }
    const upd = await client.query(
      `UPDATE products SET stock_qty = stock_qty + $2 WHERE id = $1 RETURNING stock_qty`,
      [product.id, quantity],
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, qty_change, reason, note, created_by) VALUES ($1, $2, 'RECEIVED', $3, $4)`,
      [product.id, quantity, note, actor.id],
    );
    return { product: product.sku, received: quantity, stock_qty: upd.rows[0].stock_qty };
  });
}

/** Serial search: by product, status, text (serial / SKU) or order. */
async function listSerials({ productId, status, q, orderId }) {
  const search = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const { rows } = await query(
    `SELECT i.id, i.serial_number, i.status, i.purchase_cost, i.received_at, i.updated_at,
            p.id AS product_id, p.sku, p.name, p.category, o.id AS order_id, o.order_number,
            w.start_date AS warranty_start, w.end_date AS warranty_end
       FROM inventory_items i
       JOIN products p ON p.id = i.product_id
       LEFT JOIN orders o ON o.id = i.order_id
       LEFT JOIN warranties w ON w.inventory_item_id = i.id
      WHERE ($1::bigint IS NULL OR i.product_id = $1)
        AND ($2::serial_status IS NULL OR i.status = $2)
        AND ($3::text IS NULL OR i.serial_number ILIKE $3 OR p.sku ILIKE $3)
        AND ($4::bigint IS NULL OR i.order_id = $4)
      ORDER BY p.sku, i.serial_number
      LIMIT 500`,
    [productId, status, search, orderId],
  );
  return rows;
}

/** The stock ledger, newest first. */
async function listMovements({ productId }) {
  const { rows } = await query(
    `SELECT m.*, p.sku, p.name, o.order_number, u.name AS created_by_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN orders o ON o.id = m.order_id
       LEFT JOIN users u ON u.id = m.created_by
      WHERE ($1::bigint IS NULL OR m.product_id = $1)
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 300`,
    [productId],
  );
  return rows;
}

module.exports = { listInventory, receiveStock, listSerials, listMovements };
