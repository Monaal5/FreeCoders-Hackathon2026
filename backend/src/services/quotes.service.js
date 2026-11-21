const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { LEAD_STATUS, transitionLead, assertStatus } = require('../utils/leadStatus');
const { round2 } = require('../utils/money');

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
 * Creates a quote from a package template. Gate: lead must be SURVEY_APPROVED (first quote)
 * or QUOTED (revised quote) – anything else is 409. The template BOM is copied into
 * quote_items as a price snapshot, all in one transaction.
 */
async function createQuote(leadId, { templateId, discountPct, notes, validDays }, actor) {
  return withTransaction(async (client) => {
    const leadRes = await client.query('SELECT id, status, customer_name FROM leads WHERE id = $1 FOR UPDATE', [leadId]);
    if (!leadRes.rows.length) throw AppError.notFound('Lead');
    const lead = leadRes.rows[0];
    assertStatus(lead, [LEAD_STATUS.SURVEY_APPROVED, LEAD_STATUS.QUOTED], 'create a quote');

    const surveyRes = await client.query(
      `SELECT id FROM surveys WHERE lead_id = $1 AND status = 'APPROVED' ORDER BY reviewed_at DESC LIMIT 1`,
      [leadId],
    );
    if (!surveyRes.rows.length) throw AppError.conflict('Lead has no approved survey', 'SURVEY_NOT_APPROVED');

    const tplRes = await client.query('SELECT * FROM package_templates WHERE id = $1 AND is_active', [templateId]);
    if (!tplRes.rows.length) throw AppError.notFound('Template');
    const template = tplRes.rows[0];

    // BOM = template items x current catalogue prices
    const bomRes = await client.query(
      `SELECT p.id AS product_id, p.sku, p.name, p.category, p.unit, p.unit_price, p.gst_rate, ti.quantity,
              round(ti.quantity * p.unit_price, 2) AS line_total
         FROM template_items ti
         JOIN products p ON p.id = ti.product_id
        WHERE ti.template_id = $1
        ORDER BY array_position($2::text[], p.category::text), p.sku`,
      [templateId, CATEGORY_ORDER],
    );
    const bom = bomRes.rows;
    if (!bom.length) throw AppError.conflict('Template has no BOM items', 'EMPTY_TEMPLATE');

    const totals = calculateTotals(bom, discountPct);

    const quoteRes = await client.query(
      `INSERT INTO quotes (lead_id, survey_id, template_id, system_type, capacity_kw,
                           subtotal, discount_pct, discount_amount, taxable_amount, gst_amount, total,
                           valid_until, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, current_date + $12::int, $13, $14)
       RETURNING *`,
      [
        leadId, surveyRes.rows[0].id, template.id, template.system_type, template.capacity_kw,
        totals.subtotal, discountPct, totals.discountAmount, totals.taxableAmount, totals.gstAmount, totals.total,
        validDays, notes, actor.id,
      ],
    );
    const quote = quoteRes.rows[0];

    // Snapshot the BOM in ONE statement using unnest() over parallel arrays
    const itemsRes = await client.query(
      `INSERT INTO quote_items (quote_id, product_id, sku, name, category, unit, quantity, unit_price, gst_rate, line_total)
       SELECT $1, * FROM unnest($2::bigint[], $3::text[], $4::text[], $5::product_category[], $6::text[],
                                $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[])
       RETURNING *`,
      [
        quote.id,
        bom.map((i) => i.product_id), bom.map((i) => i.sku), bom.map((i) => i.name), bom.map((i) => i.category),
        bom.map((i) => i.unit), bom.map((i) => i.quantity), bom.map((i) => i.unit_price),
        bom.map((i) => i.gst_rate), bom.map((i) => i.line_total),
      ],
    );

    const note = `Quote ${quote.quote_number} created: ${template.name}, total Rs ${totals.total.toLocaleString('en-IN')}`;
    if (lead.status === LEAD_STATUS.SURVEY_APPROVED) {
      await transitionLead(client, leadId, LEAD_STATUS.QUOTED, actor.id, note);
    } else {
      await client.query(
        `INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`,
        [leadId, actor.id, `Revised – ${note}`],
      );
    }

    return { ...quote, template_name: template.name, items: itemsRes.rows };
  });
}

async function getQuote(id) {
  const [quoteRes, itemsRes] = await Promise.all([
    query(
      `SELECT q.*, t.name AS template_name, u.name AS created_by_name, u.phone AS created_by_phone,
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
        ORDER BY array_position($2::text[], category::text), sku`,
      [id, CATEGORY_ORDER],
    ),
  ]);
  if (!quoteRes.rows.length) throw AppError.notFound('Quote');
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
