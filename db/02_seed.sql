-- =============================================================
-- SunPower – Phase 1 seed data
-- All users share the demo password:  password123
-- (hash generated with bcryptjs, cost 10 – regenerate with: npm run hash -- <password>)
-- =============================================================

-- ---------- users (1 admin, 2 staff, 1 technician) ----------
INSERT INTO users (name, email, phone, password_hash, role) VALUES
  ('Aarav Admin',     'admin@sunpower.local',  '9800000001', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'ADMIN'),
  ('Sneha Staff',     'staff1@sunpower.local', '9800000002', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'STAFF'),
  ('Rohan Staff',     'staff2@sunpower.local', '9800000003', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'STAFF'),
  ('Vikram Technician','tech1@sunpower.local', '9800000004', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'TECHNICIAN');

-- ---------- products (18) ----------
INSERT INTO products (sku, name, category, brand, unit, unit_price, gst_rate) VALUES
  ('PNL-540',    'Mono PERC Solar Panel 540 Wp',         'PANEL',     'Waaree',   'nos',   13500.00,  5),
  ('INV-ONG-1',  'On-Grid Inverter 1 kW',                'INVERTER',  'Growatt',  'nos',   18000.00,  5),
  ('INV-ONG-2',  'On-Grid Inverter 2 kW',                'INVERTER',  'Growatt',  'nos',   24000.00,  5),
  ('INV-ONG-3',  'On-Grid Inverter 3 kW',                'INVERTER',  'Growatt',  'nos',   32000.00,  5),
  ('INV-ONG-4',  'On-Grid Inverter 4 kW',                'INVERTER',  'Growatt',  'nos',   40000.00,  5),
  ('INV-ONG-5',  'On-Grid Inverter 5 kW',                'INVERTER',  'Growatt',  'nos',   45000.00,  5),
  ('INV-OFF-2',  'Off-Grid Solar PCU 2 kVA',             'INVERTER',  'Luminous', 'nos',   28000.00,  5),
  ('INV-OFF-3',  'Off-Grid Solar PCU 3.5 kVA',           'INVERTER',  'Luminous', 'nos',   38000.00,  5),
  ('INV-OFF-5',  'Off-Grid Solar PCU 5 kVA',             'INVERTER',  'Luminous', 'nos',   55000.00,  5),
  ('BAT-150',    'Tubular Solar Battery 12V 150Ah',      'BATTERY',   'Exide',    'nos',   15000.00, 18),
  ('STR-GI',     'Hot-dip GI Mounting Structure',        'STRUCTURE', 'SunPower', 'kW',     6000.00, 18),
  ('CAB-DC-4',   'DC Solar Cable 4 sq.mm',               'CABLE',     'Polycab',  'm',        85.00, 18),
  ('CAB-AC-4',   'AC Cable 4 sq.mm (Cu)',                'CABLE',     'Polycab',  'm',       120.00, 18),
  ('BOS-DB',     'ACDB + DCDB Protection Box Set',       'BOS',       'Havells',  'set',    4500.00, 18),
  ('BOS-EARTH',  'Earthing Kit (chemical, 3 pits)',      'BOS',       'SunPower', 'set',    3500.00, 18),
  ('BOS-LA',     'Lightning Arrester',                   'BOS',       'SunPower', 'nos',    2500.00, 18),
  ('BOS-NETMTR', 'Bi-directional Net Meter',             'BOS',       'L&T',      'nos',    6500.00, 18),
  ('SRV-INST',   'Installation & Commissioning',         'SERVICE',   'SunPower', 'kW',     5000.00, 18);

-- ---------- package templates (1–5 kW × On/Off-Grid = 10) ----------
INSERT INTO package_templates (name, capacity_kw, system_type, description)
SELECT
  kw || ' kW ' || CASE st WHEN 'ON_GRID' THEN 'On-Grid' ELSE 'Off-Grid' END || ' Package',
  kw,
  st::system_type,
  CASE st WHEN 'ON_GRID'
    THEN 'Grid-tied rooftop system with net metering. Approx. ' || (kw * 120) || ' units/month.'
    ELSE 'Battery-backed standalone system for power-cut areas. Approx. ' || (kw * 120) || ' units/month.'
  END
FROM generate_series(1, 5) AS kw
CROSS JOIN (VALUES ('ON_GRID'), ('OFF_GRID')) AS s(st)
ORDER BY st, kw;

-- ---------- template BOM items (generated from capacity) ----------
-- Panels: enough 540 Wp modules to reach the rated kW
INSERT INTO template_items (template_id, product_id, quantity)
SELECT t.id, p.id, CEIL(t.capacity_kw * 1000 / 540)
FROM package_templates t JOIN products p ON p.sku = 'PNL-540';

-- On-grid inverter matched to kW
INSERT INTO template_items (template_id, product_id, quantity)
SELECT t.id, p.id, 1
FROM package_templates t
JOIN products p ON p.sku = 'INV-ONG-' || t.capacity_kw::int
WHERE t.system_type = 'ON_GRID';

-- Off-grid PCU sized by kW
INSERT INTO template_items (template_id, product_id, quantity)
SELECT t.id, p.id, 1
FROM package_templates t
JOIN products p ON p.sku = CASE WHEN t.capacity_kw <= 2 THEN 'INV-OFF-2'
                                WHEN t.capacity_kw <= 3 THEN 'INV-OFF-3'
                                ELSE 'INV-OFF-5' END
WHERE t.system_type = 'OFF_GRID';

-- Off-grid batteries
INSERT INTO template_items (template_id, product_id, quantity)
SELECT t.id, p.id, CASE WHEN t.capacity_kw <= 2 THEN 2 ELSE 4 END
FROM package_templates t JOIN products p ON p.sku = 'BAT-150'
WHERE t.system_type = 'OFF_GRID';

-- Net meter: on-grid only
INSERT INTO template_items (template_id, product_id, quantity)
SELECT t.id, p.id, 1
FROM package_templates t JOIN products p ON p.sku = 'BOS-NETMTR'
WHERE t.system_type = 'ON_GRID';

-- Common items for every package
INSERT INTO template_items (template_id, product_id, quantity)
SELECT t.id, p.id,
  CASE p.sku
    WHEN 'STR-GI'    THEN t.capacity_kw
    WHEN 'CAB-DC-4'  THEN 10 + 10 * t.capacity_kw
    WHEN 'CAB-AC-4'  THEN 15 + 5 * t.capacity_kw
    WHEN 'SRV-INST'  THEN t.capacity_kw
    ELSE 1
  END
FROM package_templates t
JOIN products p ON p.sku IN ('STR-GI', 'CAB-DC-4', 'CAB-AC-4', 'BOS-DB', 'BOS-EARTH', 'BOS-LA', 'SRV-INST');

-- ---------- sample leads (5, at different stages) ----------
INSERT INTO leads (customer_name, phone, email, address, city, pincode, property_type, monthly_bill,
                   message, source, status, assigned_to, qualification, suggested_kw, created_at)
VALUES
  ('Priya Sharma', '9876500001', 'priya@example.com', '12 MG Road', 'Jaipur', '302001', 'RESIDENTIAL', 3200,
   'Want to reduce electricity bill', 'WEBSITE', 'NEW',
   (SELECT id FROM users WHERE email = 'staff1@sunpower.local'), '{}', NULL, now() - interval '1 day'),

  ('Amit Verma', '9876500002', NULL, '45 Civil Lines', 'Kanpur', '208001', 'RESIDENTIAL', 1800,
   'Called about subsidy scheme', 'PHONE', 'NEW',
   (SELECT id FROM users WHERE email = 'staff2@sunpower.local'), '{}', NULL, now() - interval '2 days'),

  ('Green Valley School', '9876500003', 'office@greenvalley.example', 'Sector 21', 'Noida', '201301', 'COMMERCIAL', 12000,
   'Need quote for school rooftop', 'WHATSAPP', 'QUALIFIED',
   (SELECT id FROM users WHERE email = 'staff1@sunpower.local'),
   '{"monthlyBill": 12000, "roofAreaSqft": 600, "systemType": "ON_GRID", "timeline": "1-3 months"}', 5, now() - interval '4 days'),

  ('Rahul Mehta', '9876500004', 'rahul@example.com', '7 Lake View', 'Bhopal', '462001', 'RESIDENTIAL', 2500,
   NULL, 'WEBSITE', 'SURVEY_SUBMITTED',
   (SELECT id FROM users WHERE email = 'staff2@sunpower.local'),
   '{"monthlyBill": 2500, "roofAreaSqft": 350, "systemType": "ON_GRID"}', 3, now() - interval '7 days'),

  ('Kavita Singh', '9876500005', 'kavita@example.com', '88 Hill Road', 'Dehradun', '248001', 'RESIDENTIAL', 2000,
   'Frequent power cuts, want battery backup', 'REFERRAL', 'SURVEY_APPROVED',
   (SELECT id FROM users WHERE email = 'staff1@sunpower.local'),
   '{"monthlyBill": 2000, "roofAreaSqft": 400, "systemType": "OFF_GRID"}', 2, now() - interval '10 days');

-- ---------- surveys for the two advanced leads ----------
INSERT INTO surveys (lead_id, technician_id, scheduled_date, status, roof_type, roof_area_sqft, shading,
                     orientation, sanctioned_load_kw, recommended_kw, technician_notes, submitted_at,
                     reviewed_by, reviewed_at, review_note, created_by)
VALUES
  ((SELECT id FROM leads WHERE phone = '9876500004'),
   (SELECT id FROM users WHERE email = 'tech1@sunpower.local'),
   current_date - 2, 'SUBMITTED', 'RCC flat', 340, 'NONE', 'South', 5, 3,
   'Clear roof, easy access via staircase.', now() - interval '1 day',
   NULL, NULL, NULL,
   (SELECT id FROM users WHERE email = 'staff2@sunpower.local')),

  ((SELECT id FROM leads WHERE phone = '9876500005'),
   (SELECT id FROM users WHERE email = 'tech1@sunpower.local'),
   current_date - 5, 'APPROVED', 'RCC flat', 380, 'PARTIAL', 'South-East', 3, 2,
   'Water tank shades one corner in the evening.', now() - interval '4 days',
   (SELECT id FROM users WHERE email = 'admin@sunpower.local'), now() - interval '3 days', 'Looks good, proceed.',
   (SELECT id FROM users WHERE email = 'staff1@sunpower.local'));

-- ---------- activity timeline for the sample leads ----------
INSERT INTO lead_activities (lead_id, actor_id, type, from_status, to_status, note, created_at)
SELECT l.id, NULL, 'CREATED', NULL, 'NEW', 'Lead created (' || l.source || ')', l.created_at
FROM leads l;

INSERT INTO lead_activities (lead_id, actor_id, type, from_status, to_status, note, created_at)
SELECT l.id, l.assigned_to, 'STATUS_CHANGE', v.from_s::lead_status, v.to_s::lead_status, v.note,
       l.created_at + (v.ord || ' hours')::interval
FROM leads l
JOIN (VALUES
  ('NEW', 'QUALIFIED',                  'Qualified on call', 1, ARRAY['QUALIFIED','SURVEY_SUBMITTED','SURVEY_APPROVED']),
  ('QUALIFIED', 'SURVEY_SCHEDULED',      'Survey assigned to Vikram Technician', 2, ARRAY['SURVEY_SUBMITTED','SURVEY_APPROVED']),
  ('SURVEY_SCHEDULED', 'SURVEY_SUBMITTED','Survey submitted', 3, ARRAY['SURVEY_SUBMITTED','SURVEY_APPROVED']),
  ('SURVEY_SUBMITTED', 'SURVEY_APPROVED', 'Survey approved', 4, ARRAY['SURVEY_APPROVED'])
) AS v(from_s, to_s, note, ord, applies_to) ON l.status::text = ANY (v.applies_to);
