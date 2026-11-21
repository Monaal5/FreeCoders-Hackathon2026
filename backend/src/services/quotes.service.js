const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { LEAD_STATUS, transitionLead, assertStatus } = require('../utils/leadStatus');
const { round2 } = require('../utils/money');
const { assertLeadAccess, canAccessLead } = require('../utils/access');

const QUOTE_TRANSITIONS = Object.freeze({
  DRAFT: ['SENT', 'ACCEPTED', 'REJECTED'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
});

const CATEGORY_ORDER = ['PANEL', 'INVERTER', 'BATTERY', 'STRUCTURE', 'CABLE', 'BOS', 'SERVICE'];

/**
 * Pure maths, easy to unit-test. Discount is applied to every line before GST,
 * so GST is charged on the discounted value (as on a real tax invoice).
 */
function calculateTotals(items, discountPct = 0) {
  const factor = 1 - discountPct / 100;
  const subtotal = round2(items.reduce((s, i) => s + i.line_total, 0));
  const discountAmount = round2(subtotal * (discountPct / 100));
  const taxableAmount = round2(subtotal - discountAmount);
  const gstAmount = round2(items.reduce((s, i) => s + round2(i.line_total * factor * (i.gst_rate / 100)), 0));
  return { subtotal, discountAmount, taxableAmount, gstAmount, total: round2(taxableAmount + gstAmount) };
}

/**
 * Creates a quote from a ready-made package (Panel Set / On-Grid / Off-Grid) plus, optionally,
 * the matching Installation service. Gate: lead must be SURVEY_APPROVED (first quote) or
 * QUOTED (revised quote) – anything else is 409. Every part of the package(s) is copied into
 * quote_items as a price snapshot (with its section), all in one transaction.
 */
async function createQuote(leadId, { templateId, includeInstallation, discountPct, notes, validDays }, actor) {
  return withTransaction(async (client) => {
    const lead = await assertLeadAccess(client, leadId, actor, { lock: true }); // 404 if not this staff's lead
    assertStatus(lead, [LEAD_STATUS.SURVEY_APPROVED, LEAD_STATUS.QUOTED], 'create a quote');

    const surveyRes = await client.query(
      `SELECT id FROM surveys WHERE lead_id = $1 AND status = 'APPROVED' ORDER BY reviewed_at DESC LIMIT 1`,
      [leadId],
    );
    if (!surveyRes.rows.length) throw AppError.conflict('Lead has no approved survey', 'SURVEY_NOT_APPROVED');

    const tplRes = await client.query('SELECT * FROM package_templates WHERE id = $1 AND is_active', [templateId]);
    if (!tplRes.rows.length) throw AppError.notFound('Template');
    const template = tplRes.rows[0];
    if (template.kind === 'INSTALLATION') {
      throw AppError.badRequest('Pick a Panel Set, On-Grid or Off-Grid package; Installation is added with includeInstallation', {
        field: 'templateId',
      });
    }

    // Installation service of the same size, when requested
    const templateIds = [template.id];
    let installation = null;
    if (includeInstallation) {
      const inst = await client.query(
        `SELECT * FROM package_templates WHERE kind = 'INSTALLATION' AND capacity_kw = $1 AND is_active`,
        [template.capacity_kw],
      );
      if (!inst.rows.length) {
        throw AppError.conflict(`No installation package for ${template.capacity_kw} kW`, 'NO_INSTALLATION_PACKAGE');
      }
      installation = inst.rows[0];
      templateIds.push(installation.id);
    }

    // BOM = every part of the chosen package(s) x current catalogue prices
    const bomRes = await client.query(
      `SELECT p.id AS product_id, p.sku, p.name, p.category, p.unit, p.unit_price, p.gst_rate, ti.quantity,
              round(ti.quantity * p.unit_price, 2) AS line_total, ti.section, ti.sort_order
         FROM template_items ti
         JOIN products p ON p.id = ti.product_id
        WHERE ti.template_id = ANY($1::bigint[])
        ORDER BY ti.sort_order, p.sku`,
      [templateIds],
    );
    const bom = bomRes.rows;
    if (!bom.length) throw AppError.conflict('Template has no BOM items', 'EMPTY_TEMPLATE');

    const totals = calculateTotals(bom, discountPct);
    const packageName = installation ? `${template.name} + Installation` : template.name;

    const quoteRes = await client.query(
      `INSERT INTO quotes (lead_id, survey_id, template_id, package_kind, system_type, includes_installation, capacity_kw,
                           subtotal, discount_pct, discount_amount, taxable_amount, gst_amount, total,
                           valid_until, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, current_date + $14::int, $15, $16)
       RETURNING *`,
      [
        leadId, surveyRes.rows[0].id, template.id, template.kind, template.system_type, !!installation,
        template.capacity_kw, totals.subtotal, discountPct, totals.discountAmount, totals.taxableAmount,
        totals.gstAmount, totals.total, validDays, notes, actor.id,
      ],
    );
    const quote = quoteRes.rows[0];

    // Snapshot the BOM in ONE statement using unnest() over parallel arrays
    const itemsRes = await client.query(
      `INSERT INTO quote_items (quote_id, product_id, sku, name, category, unit, quantity, unit_price, gst_rate,
                               line_total, section, sort_order)
       SELECT $1, * FROM unnest($2::bigint[], $3::text[], $4::text[], $5::product_category[], $6::text[],
                                $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::text[], $12::int[])
       RETURNING *`,
      [
        quote.id,
        bom.map((i) => i.product_id), bom.map((i) => i.sku), bom.map((i) => i.name), bom.map((i) => i.category),
        bom.map((i) => i.unit), bom.map((i) => i.quantity), bom.map((i) => i.unit_price),
        bom.map((i) => i.gst_rate), bom.map((i) => i.line_total), bom.map((i) => i.section),
        bom.map((i) => i.sort_order),
      ],
    );
    itemsRes.rows.sort((a, b) => a.sort_order - b.sort_order || a.sku.localeCompare(b.sku));

    const note = `Quote ${quote.quote_number} created: ${packageName} (${bom.length} parts), total Rs ${totals.total.toLocaleString('en-IN')}`;
    if (lead.status === LEAD_STATUS.SURVEY_APPROVED) {
      await transitionLead(client, leadId, LEAD_STATUS.QUOTED, actor.id, note);
    } else {
      await client.query(
        `INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`,
        [leadId, actor.id, `Revised – ${note}`],
      );
    }

    return { ...quote, template_name: packageName, items: itemsRes.rows };
  });
}

async function getQuote(id, user) {
  const [quoteRes, itemsRes] = await Promise.all([
    query(
      `SELECT q.*, l.assigned_to,
              t.name || CASE WHEN q.includes_installation THEN ' + Installation' ELSE '' END AS template_name,
              u.name AS created_by_name, u.phone AS created_by_phone,
              l.lead_code, l.customer_name, l.phone AS customer_phone, l.email AS customer_email,
              l.address AS customer_address, l.city AS customer_city, l.state AS customer_state,
              l.pincode AS customer_pincode,
              l.status AS lead_status
         FROM quotes q
         JOIN leads l ON l.id = q.lead_id
         LEFT JOIN package_templates t ON t.id = q.template_id
         LEFT JOIN users u ON u.id = q.created_by
        WHERE q.id = $1`,
      [id],
    ),
    query(
      `SELECT * FROM quote_items WHERE quote_id = $1
        ORDER BY sort_order, array_position($2::text[], category::text), sku`,
      [id, CATEGORY_ORDER],
    ),
  ]);
  // staff may only open quotes of their own leads – anything else looks like it doesn't exist
  if (!quoteRes.rows.length || !canAccessLead(user, quoteRes.rows[0])) throw AppError.notFound('Quote');
  return { ...quoteRes.rows[0], items: itemsRes.rows };
}

/**
 * DRAFT -> SENT -> ACCEPTED | REJECTED.
 * ACCEPTED moves the lead QUOTED -> WON and closes the lead's other open quotes.
 */
async function updateQuoteStatus(id, toStatus, actor) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM quotes WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw AppError.notFound('Quote');
    const quote = rows[0];
    try {
      await assertLeadAccess(client, quote.lead_id, actor);
    } catch {
      throw AppError.notFound('Quote'); // same answer as a missing quote
    }

    if (!QUOTE_TRANSITIONS[quote.status].includes(toStatus)) {
      throw AppError.conflict(`Cannot move quote from ${quote.status} to ${toStatus}`, 'INVALID_STATUS_TRANSITION', {
        from: quote.status,
        to: toStatus,
        allowed: QUOTE_TRANSITIONS[quote.status],
      });
    }

    const updated = await client.query(
      `UPDATE quotes
          SET status = $2::quote_status,
              sent_at    = CASE WHEN $2::quote_status = 'SENT' THEN now() ELSE sent_at END,
              decided_at = CASE WHEN $2::quote_status IN ('ACCEPTED', 'REJECTED') THEN now() ELSE decided_at END
        WHERE id = $1
        RETURNING *`,
      [id, toStatus],
    );

    if (toStatus === 'ACCEPTED') {
      await transitionLead(client, quote.lead_id, LEAD_STATUS.WON, actor.id, `Quote ${quote.quote_number} accepted`);
      await client.query(
        `UPDATE quotes SET status = 'REJECTED', decided_at = now()
          WHERE lead_id = $1 AND id <> $2 AND status IN ('DRAFT', 'SENT')`,
        [quote.lead_id, id],
      );
    } else {
      await client.query(
        `INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`,
        [quote.lead_id, actor.id, `Quote ${quote.quote_number} marked ${toStatus}`],
      );
    }
    return updated.rows[0];
  });
}

module.exports = { calculateTotals, createQuote, getQuote, updateQuoteStatus, QUOTE_TRANSITIONS };
