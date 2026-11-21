const { query } = require('../config/db');

/**
 * Ready-made packages with their full parts list (grouped by section) and an indicative
 * price before discount, so the quote screen can show "3 kW On-Grid System – Rs 1.73 L".
 * kind: PANEL_SET | ON_GRID | OFF_GRID | INSTALLATION
 */
async function listTemplates({ kind, systemType, capacityKw }) {
  const { rows } = await query(
    `SELECT t.id, t.name, t.kind, t.capacity_kw, t.system_type, t.description,
            round(sum(ti.quantity * p.unit_price), 2)                          AS subtotal,
            round(sum(ti.quantity * p.unit_price * p.gst_rate / 100), 2)       AS gst_amount,
            round(sum(ti.quantity * p.unit_price * (1 + p.gst_rate / 100)), 2) AS estimated_total,
            count(*)::int                                                      AS part_count,
            json_agg(json_build_object(
              'product_id', p.id, 'sku', p.sku, 'name', p.name, 'category', p.category, 'brand', p.brand,
              'unit', p.unit, 'quantity', ti.quantity, 'unit_price', p.unit_price, 'gst_rate', p.gst_rate,
              'section', ti.section, 'sort_order', ti.sort_order
            ) ORDER BY ti.sort_order, p.sku) AS items
       FROM package_templates t
       JOIN template_items ti ON ti.template_id = t.id
       JOIN products p        ON p.id = ti.product_id
      WHERE t.is_active
        AND ($1::package_kind IS NULL OR t.kind = $1)
        AND ($2::system_type IS NULL OR t.system_type = $2)
        AND ($3::numeric IS NULL OR t.capacity_kw = $3)
      GROUP BY t.id
      ORDER BY array_position(ARRAY['PANEL_SET', 'ON_GRID', 'OFF_GRID', 'INSTALLATION'], t.kind::text), t.capacity_kw`,
    [kind, systemType, capacityKw],
  );
  return rows;
}

module.exports = { listTemplates };
