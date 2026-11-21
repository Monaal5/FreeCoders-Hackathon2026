-- =============================================================
-- SunPower – ready-made packages and their complete parts lists (BOM)
--
--   Solar Panel Set (Hardware)   panels, MC4 connectors, DC wires
--   On-Grid System 1–5 kW        panel set + inverter + battery charge controller + wiring boxes
--                                + switches + safety earthing + metal stands
--   Off-Grid System 1–5 kW       everything in On-Grid (with an off-grid inverter) + battery storage
--   Installation (Service)       fitting and testing by our crew at the customer's site (add-on)
--
-- A quote picks ONE package (+ optional Installation) and every part below is copied in
-- automatically, so nobody has to remember connectors, isolators, earthing or stands.
--
-- Safe to re-run (upserts): used by db:reset AND by the in-place migration.
-- =============================================================

-- ---------- parts catalogue ----------
INSERT INTO products (sku, name, category, brand, unit, unit_price, gst_rate) VALUES
  -- panels & DC wiring
  ('PNL-540',     'Mono PERC Solar Panel 540 Wp',                      'PANEL',     'Waaree',   'nos',   13500.00,  5),
  ('MC4-PAIR',    'MC4 Connector Pair (IP67, 1000 V DC)',              'CABLE',     'Staubli',  'pair',    150.00, 18),
  ('CAB-DC-4',    'DC Solar Cable 4 sq.mm (UV-resistant)',             'CABLE',     'Polycab',  'm',        85.00, 18),
  -- inverters (turn sun power into home electricity)
  ('INV-ONG-1',   'On-Grid Inverter 1 kW',                             'INVERTER',  'Growatt',  'nos',   18000.00,  5),
  ('INV-ONG-2',   'On-Grid Inverter 2 kW',                             'INVERTER',  'Growatt',  'nos',   24000.00,  5),
  ('INV-ONG-3',   'On-Grid Inverter 3 kW',                             'INVERTER',  'Growatt',  'nos',   32000.00,  5),
  ('INV-ONG-4',   'On-Grid Inverter 4 kW',                             'INVERTER',  'Growatt',  'nos',   40000.00,  5),
  ('INV-ONG-5',   'On-Grid Inverter 5 kW',                             'INVERTER',  'Growatt',  'nos',   45000.00,  5),
  ('INV-OFF-2',   'Off-Grid Solar Inverter (PCU) 2 kVA',               'INVERTER',  'Luminous', 'nos',   28000.00,  5),
  ('INV-OFF-3',   'Off-Grid Solar Inverter (PCU) 3.5 kVA',             'INVERTER',  'Luminous', 'nos',   38000.00,  5),
  ('INV-OFF-5',   'Off-Grid Solar Inverter (PCU) 5 kVA',               'INVERTER',  'Luminous', 'nos',   55000.00,  5),
  -- battery charge controllers
  ('CC-MPPT-30',  'Battery Charge Controller (MPPT) 30 A',             'BOS',       'Luminous', 'nos',    4500.00,  5),
  ('CC-MPPT-60',  'Battery Charge Controller (MPPT) 60 A',             'BOS',       'Luminous', 'nos',    7500.00,  5),
  -- wiring boxes, switches & AC wiring
  ('BOS-DCDB',    'DC Wiring Box (DCDB) with fuse & surge protector',  'BOS',       'Havells',  'nos',    3000.00, 18),
  ('BOS-ACDB',    'AC Wiring Box (ACDB) with MCB & surge protector',   'BOS',       'Havells',  'nos',    2500.00, 18),
  ('SW-DC-ISO',   'DC Isolator Switch 1000 V',                         'BOS',       'Havells',  'nos',    1200.00, 18),
  ('SW-AC-MCB',   'AC Main Switch (MCB, double pole)',                 'BOS',       'Havells',  'nos',     450.00, 18),
  ('CAB-AC-4',    'AC Cable 4 sq.mm (Cu)',                             'CABLE',     'Polycab',  'm',       120.00, 18),
  ('KIT-INSTALL', 'Cable Ties, Lugs, Conduit & Glands Kit',            'BOS',       'SunPower', 'set',    1500.00, 18),
  -- safety
  ('BOS-EARTH',   'Safety Earthing Kit (chemical, 3 pits)',            'BOS',       'SunPower', 'set',    3500.00, 18),
  ('BOS-LA',      'Lightning Arrester',                                'BOS',       'SunPower', 'nos',    2500.00, 18),
  -- metal stands
  ('STR-GI',      'Hot-dip GI Mounting Stand',                         'STRUCTURE', 'SunPower', 'kW',     6000.00, 18),
  -- battery storage (off-grid)
  ('BAT-150',     'Tubular Solar Battery 12 V 150 Ah',                 'BATTERY',   'Exide',    'nos',   15000.00, 18),
  ('BAT-RACK',    'Battery Rack (powder-coated steel)',                'STRUCTURE', 'SunPower', 'nos',    2500.00, 18),
  ('CAB-BAT',     'Battery Interconnect Cable Set',                    'CABLE',     'Polycab',  'set',     800.00, 18),
  -- installation service
  ('SRV-INST',    'Installation & Fitting by SunPower Crew',           'SERVICE',   'SunPower', 'kW',     5000.00, 18),
  ('SRV-TEST',    'Testing & Commissioning (with site report)',        'SERVICE',   'SunPower', 'site',   2500.00, 18)
ON CONFLICT (sku) DO UPDATE
  SET name = EXCLUDED.name, category = EXCLUDED.category, brand = EXCLUDED.brand, unit = EXCLUDED.unit,
      unit_price = EXCLUDED.unit_price, gst_rate = EXCLUDED.gst_rate, is_active = TRUE;

-- parts no longer used by any package stay in the table (old quotes reference them) but are retired
UPDATE products SET is_active = FALSE WHERE sku IN ('BOS-DB', 'BOS-NETMTR');

-- ---------- packages: 4 kinds × 1–5 kW ----------
INSERT INTO package_templates (name, kind, capacity_kw, system_type, description)
SELECT
  kw || ' kW ' || k.label,
  k.kind::package_kind,
  kw,
  k.system_type::system_type,
  replace(k.description, '{units}', (kw * 120)::text)
FROM generate_series(1, 5) AS kw
CROSS JOIN (VALUES
  ('PANEL_SET',    'Solar Panel Set',   NULL,
   'Hardware only: solar panels, MC4 connectors and DC wires.'),
  ('ON_GRID',      'On-Grid System',    'ON_GRID',
   'Grid-tied rooftop system: panels, inverter, battery charge controller, wiring boxes, switches, safety earthing and metal stands. Approx. {units} units/month.'),
  ('OFF_GRID',     'Off-Grid System',   'OFF_GRID',
   'Everything in the On-Grid system plus a battery bank that stores power for power cuts. Approx. {units} units/month.'),
  ('INSTALLATION', 'Installation',      NULL,
   'Fitting and testing by our crew at the customer''s site.')
) AS k(kind, label, system_type, description)
ON CONFLICT ON CONSTRAINT package_templates_kind_capacity_key DO UPDATE
  SET name = EXCLUDED.name, system_type = EXCLUDED.system_type,
      description = EXCLUDED.description, is_active = TRUE;

-- ---------- parts list per package (rebuilt from the rules below) ----------
DELETE FROM template_items;

INSERT INTO template_items (template_id, product_id, quantity, section, sort_order)
SELECT t.id, p.id, q.qty, r.section, r.sort_order
FROM package_templates t
JOIN (VALUES
  -- kinds that get the part             section                       order  part          quantity rule
  ('PANEL_SET,ON_GRID,OFF_GRID', 'Solar Panels & Wiring',          10, 'PNL-540',     'panels'),
  ('PANEL_SET,ON_GRID,OFF_GRID', 'Solar Panels & Wiring',          20, 'MC4-PAIR',    'connectors'),
  ('PANEL_SET,ON_GRID,OFF_GRID', 'Solar Panels & Wiring',          30, 'CAB-DC-4',    'dc_cable'),
  ('ON_GRID',                    'Inverter & Charge Control',     110, 'INV-ONG',     'one'),
  ('OFF_GRID',                   'Inverter & Charge Control',     110, 'INV-OFF',     'one'),
  ('ON_GRID,OFF_GRID',           'Inverter & Charge Control',     120, 'CC-MPPT',     'one'),
  ('ON_GRID,OFF_GRID',           'Wiring Boxes & Switches',       210, 'BOS-DCDB',    'one'),
  ('ON_GRID,OFF_GRID',           'Wiring Boxes & Switches',       220, 'BOS-ACDB',    'one'),
  ('ON_GRID,OFF_GRID',           'Wiring Boxes & Switches',       230, 'SW-DC-ISO',   'one'),
  ('ON_GRID,OFF_GRID',           'Wiring Boxes & Switches',       240, 'SW-AC-MCB',   'one'),
  ('ON_GRID,OFF_GRID',           'Wiring Boxes & Switches',       250, 'CAB-AC-4',    'ac_cable'),
  ('ON_GRID,OFF_GRID',           'Wiring Boxes & Switches',       260, 'KIT-INSTALL', 'one'),
  ('ON_GRID,OFF_GRID',           'Safety & Earthing',             310, 'BOS-EARTH',   'one'),
  ('ON_GRID,OFF_GRID',           'Safety & Earthing',             320, 'BOS-LA',      'one'),
  ('ON_GRID,OFF_GRID',           'Mounting Stands',               410, 'STR-GI',      'per_kw'),
  ('OFF_GRID',                   'Battery Storage',               510, 'BAT-150',     'batteries'),
  ('OFF_GRID',                   'Battery Storage',               520, 'BAT-RACK',    'one'),
  ('OFF_GRID',                   'Battery Storage',               530, 'CAB-BAT',     'one'),
  ('INSTALLATION',               'Installation (Service)',        910, 'SRV-INST',    'per_kw'),
  ('INSTALLATION',               'Installation (Service)',        920, 'SRV-TEST',    'one')
) AS r(kinds, section, sort_order, sku, rule)
  ON t.kind::text = ANY (string_to_array(r.kinds, ','))
CROSS JOIN LATERAL (
  SELECT
    CASE r.sku                                   -- size-dependent parts
      WHEN 'INV-ONG' THEN 'INV-ONG-' || t.capacity_kw::int
      WHEN 'INV-OFF' THEN CASE WHEN t.capacity_kw <= 2 THEN 'INV-OFF-2'
                               WHEN t.capacity_kw <= 3 THEN 'INV-OFF-3' ELSE 'INV-OFF-5' END
      WHEN 'CC-MPPT' THEN CASE WHEN t.capacity_kw <= 2 THEN 'CC-MPPT-30' ELSE 'CC-MPPT-60' END
      ELSE r.sku
    END AS sku,
    CASE r.rule                                  -- quantities scale with system size
      WHEN 'panels'     THEN CEIL(t.capacity_kw * 1000 / 540)         -- enough 540 Wp panels for the rated kW
      WHEN 'connectors' THEN CEIL(t.capacity_kw * 1000 / 540) + 2     -- one pair per panel + 2 for string ends
      WHEN 'dc_cable'   THEN 10 + 10 * t.capacity_kw                  -- metres
      WHEN 'ac_cable'   THEN 15 + 5 * t.capacity_kw                   -- metres
      WHEN 'per_kw'     THEN t.capacity_kw
      WHEN 'batteries'  THEN CASE WHEN t.capacity_kw <= 2 THEN 2 ELSE 4 END
      ELSE 1
    END AS qty
) AS q
JOIN products p ON p.sku = q.sku;
