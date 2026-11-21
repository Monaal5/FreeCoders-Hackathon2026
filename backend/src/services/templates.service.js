const { query } = require('../config/db');

/**
 * Package templates with their BOM and an indicative price (before discount),
 * so the quote screen can show "3 kW On-Grid – Rs 1.78 L" in the picker.
 */
async function listTemplates({ systemType, capacityKw }) {
  const { rows } = await query(
    `SELECT t.id, t.name, t.capacity_kw, t.system_type, t.description,
            round(sum(ti.quantity * p.unit_price), 2)                          AS subtotal,
            round(sum(ti.quantity * p.unit_price * p.gst_rate / 100), 2)       AS gst_amount,
            round(sum(ti.quantity * p.unit_price * (1 + p.gst_rate / 100)), 2) AS estimated_total,
            json_agg(json_build_object(
              'product_id', p.id, 'sku', p.sku, 'name', p.name, 'category', p.category, 'brand', p.brand,
              'unit', p.unit, 'quantity', ti.quantity, 'unit_price', p.unit_price, 'gst_rate', p.gst_rate
            ) ORDER BY p.category, p.sku) AS items
       FROM package_templates t
       JOIN template_items ti ON ti.template_id = t.id
       JOIN products p        ON p.id = ti.product_id
      WHERE t.is_active
        AND ($1::system_type IS NULL OR t.system_type = $1)
        AND ($2::numeric IS NULL OR t.capacity_kw = $2)
      GROUP BY t.id
      ORDER BY t.system_type, t.capacity_kw`,
    [systemType, capacityKw],
  );
  return rows;
}

module.exports = { listTemplates };
