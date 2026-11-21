-- =============================================================
-- SunPower – Phase 2 seed: product stock settings, 61 serialized units, bulk stock
-- Safe to re-run: settings are UPDATEs, serials use ON CONFLICT DO NOTHING, and the opening
-- stock for bulk items is only written once (ledger row 'Opening stock' acts as the marker).
-- =============================================================

-- ---------- which products are scanned one by one, and their warranty ----------
-- Inverter / battery / charge controller: required serialized, 24 months.
-- Panels: serialized too (optional per plan) so each panel gets its 240-month warranty.
UPDATE products SET is_serialized = TRUE,  warranty_months = 24  WHERE category IN ('INVERTER', 'BATTERY') OR sku LIKE 'CC-MPPT-%';
UPDATE products SET is_serialized = TRUE,  warranty_months = 240 WHERE category = 'PANEL';
UPDATE products SET is_serialized = FALSE, warranty_months = 0   WHERE NOT (category IN ('INVERTER', 'BATTERY', 'PANEL') OR sku LIKE 'CC-MPPT-%');

-- ---------- reorder levels (alert when available stock <= level) ----------
UPDATE products p SET reorder_level = v.lvl
FROM (VALUES
  ('PNL-540', 12), ('INV-ONG-1', 1), ('INV-ONG-2', 1), ('INV-ONG-3', 2), ('INV-ONG-4', 1), ('INV-ONG-5', 1),
  ('INV-OFF-2', 1), ('INV-OFF-3', 1), ('INV-OFF-5', 1), ('CC-MPPT-30', 2), ('CC-MPPT-60', 2), ('BAT-150', 4),
  ('MC4-PAIR', 40), ('CAB-DC-4', 200), ('CAB-AC-4', 150), ('BOS-DCDB', 5), ('BOS-ACDB', 5), ('SW-DC-ISO', 5),
  ('SW-AC-MCB', 10), ('KIT-INSTALL', 5), ('BOS-EARTH', 4), ('BOS-LA', 4), ('STR-GI', 10), ('BAT-RACK', 2),
  ('CAB-BAT', 3)
) AS v(sku, lvl)
WHERE p.sku = v.sku;

-- ---------- opening bulk stock (a few deliberately at / below reorder level) ----------
WITH opening(sku, qty) AS (VALUES
  ('MC4-PAIR', 120), ('CAB-DC-4', 600), ('CAB-AC-4', 400), ('BOS-DCDB', 12), ('BOS-ACDB', 12),
  ('SW-DC-ISO', 3),          -- below reorder level (5)
  ('SW-AC-MCB', 25), ('KIT-INSTALL', 10),
  ('BOS-EARTH', 3),          -- below reorder level (4)
  ('BOS-LA', 2),             -- below reorder level (4)
  ('STR-GI', 30), ('BAT-RACK', 4),
  ('CAB-BAT', 2)             -- below reorder level (3)
), fresh AS (
  -- only the first time: skip if opening stock was already recorded
  SELECT o.sku, o.qty, p.id AS product_id
  FROM opening o JOIN products p ON p.sku = o.sku
  WHERE NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id = p.id AND m.note = 'Opening stock')
), upd AS (
  UPDATE products p SET stock_qty = p.stock_qty + f.qty FROM fresh f WHERE p.id = f.product_id RETURNING p.id
)
INSERT INTO stock_movements (product_id, qty_change, reason, note)
SELECT product_id, qty, 'RECEIVED', 'Opening stock' FROM fresh;

-- ---------- 61 serialized units ----------
-- serial format: <SKU>-SN<4 digits>, e.g. INV-ONG-3-SN0002
WITH units(sku, n, cost) AS (VALUES
  ('PNL-540', 24, 11200),                                           -- 24 panels
  ('INV-ONG-1', 3, 14500), ('INV-ONG-2', 3, 19500), ('INV-ONG-3', 3, 26000),
  ('INV-ONG-4', 3, 33000), ('INV-ONG-5', 3, 37500),                -- 15 on-grid inverters
  ('INV-OFF-2', 2, 23000), ('INV-OFF-3', 2, 31000), ('INV-OFF-5', 2, 46000),   -- 6 off-grid inverters
  ('CC-MPPT-30', 4, 3600), ('CC-MPPT-60', 4, 6000),                -- 8 charge controllers
  ('BAT-150', 8, 12000)                                             -- 8 batteries  => 61 units
), ins AS (
  INSERT INTO inventory_items (product_id, serial_number, purchase_cost)
  SELECT p.id, u.sku || '-SN' || lpad(g::text, 4, '0'), u.cost
  FROM units u
  JOIN products p ON p.sku = u.sku
  CROSS JOIN LATERAL generate_series(1, u.n) AS g
  ON CONFLICT (serial_number) DO NOTHING
  RETURNING product_id
)
INSERT INTO stock_movements (product_id, qty_change, reason, note)
SELECT product_id, count(*), 'RECEIVED', 'Opening serial stock' FROM ins GROUP BY product_id;
