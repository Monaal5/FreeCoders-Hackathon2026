-- =============================================================
-- SunPower – Phase 1 seed data
-- All users share the demo password:  password123
-- (hash generated with bcryptjs, cost 10 – regenerate with: npm run hash -- <password>)
-- =============================================================

-- ---------- users (1 admin, 2 staff, 1 technician) ----------
INSERT INTO users (name, email, phone, password_hash, role) VALUES
  ('Aarav Admin',     'admin@sunpower.com',  '9800000001', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'ADMIN'),
  ('Sneha Staff',     'staff@sunpower.com', '9800000002', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'STAFF'),
  ('Rohan Staff',     'staff2@sunpower.com', '9800000003', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'STAFF'),
  ('Vikram Technician','tech@sunpower.com', '9800000004', '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'TECHNICIAN');

-- products, packages and their parts lists live in 03_packages.sql

-- ---------- sample leads (5, at different stages) ----------
INSERT INTO leads (customer_name, phone, email, address, city, pincode, property_type, monthly_bill,
                   message, source, status, assigned_to, qualification, suggested_kw, created_at)
VALUES
  ('Priya Sharma', '9876500001', 'priya@example.com', '12 MG Road', 'Jaipur', '302001', 'RESIDENTIAL', 3200,
   'Want to reduce electricity bill', 'WEBSITE', 'NEW',
   (SELECT id FROM users WHERE email = 'staff@sunpower.com'), '{}', NULL, now() - interval '1 day'),

  ('Amit Verma', '9876500002', NULL, '45 Civil Lines', 'Kanpur', '208001', 'RESIDENTIAL', 1800,
   'Called about subsidy scheme', 'PHONE', 'NEW',
   (SELECT id FROM users WHERE email = 'staff2@sunpower.com'), '{}', NULL, now() - interval '2 days'),

  ('Green Valley School', '9876500003', 'office@greenvalley.example', 'Sector 21', 'Noida', '201301', 'COMMERCIAL', 12000,
   'Need quote for school rooftop', 'WHATSAPP', 'QUALIFIED',
   (SELECT id FROM users WHERE email = 'staff@sunpower.com'),
   '{"monthlyBill": 12000, "roofAreaSqft": 600, "systemType": "ON_GRID", "timeline": "1-3 months"}', 5, now() - interval '4 days'),

  ('Rahul Mehta', '9876500004', 'rahul@example.com', '7 Lake View', 'Bhopal', '462001', 'RESIDENTIAL', 2500,
   NULL, 'WEBSITE', 'SURVEY_SUBMITTED',
   (SELECT id FROM users WHERE email = 'staff2@sunpower.com'),
   '{"monthlyBill": 2500, "roofAreaSqft": 350, "systemType": "ON_GRID"}', 3, now() - interval '7 days'),

  ('Kavita Singh', '9876500005', 'kavita@example.com', '88 Hill Road', 'Dehradun', '248001', 'RESIDENTIAL', 2000,
   'Frequent power cuts, want battery backup', 'REFERRAL', 'SURVEY_APPROVED',
   (SELECT id FROM users WHERE email = 'staff@sunpower.com'),
   '{"monthlyBill": 2000, "roofAreaSqft": 400, "systemType": "OFF_GRID"}', 2, now() - interval '10 days');

-- state + customer-reported roof details (captured by the enquiry form)
UPDATE leads l
   SET state = v.state,
       roof_type = 'Flat Concrete',
       roof_area_sqft = COALESCE((l.qualification->>'roofAreaSqft')::numeric, 450)
  FROM (VALUES ('Jaipur', 'Rajasthan'), ('Kanpur', 'Uttar Pradesh'), ('Noida', 'Uttar Pradesh'),
               ('Bhopal', 'Madhya Pradesh'), ('Dehradun', 'Uttarakhand')) AS v(city, state)
 WHERE l.city = v.city;

-- qualification answers in the same shape the qualify screen saves
UPDATE leads
   SET qualification = qualification || jsonb_build_object(
         'monthlyUnits', round(monthly_bill / 8),
         'sanctionedLoadKw', 5,
         'roofViability', 'HIGH',
         'notes', 'Qualified on call; owner is the decision maker.')
 WHERE status <> 'NEW';

-- ---------- surveys for the two advanced leads ----------
INSERT INTO surveys (lead_id, technician_id, scheduled_date, status, roof_type, roof_area_sqft, shading,
                     orientation, sanctioned_load_kw, recommended_kw, technician_notes, submitted_at,
                     reviewed_by, reviewed_at, review_note, created_by)
VALUES
  ((SELECT id FROM leads WHERE phone = '9876500004'),
   (SELECT id FROM users WHERE email = 'tech@sunpower.com'),
   current_date - 2, 'SUBMITTED', 'RCC flat', 340, 'NONE', 'South', 5, 3,
   'Clear roof, easy access via staircase.', now() - interval '1 day',
   NULL, NULL, NULL,
   (SELECT id FROM users WHERE email = 'staff2@sunpower.com')),

  ((SELECT id FROM leads WHERE phone = '9876500005'),
   (SELECT id FROM users WHERE email = 'tech@sunpower.com'),
   current_date - 5, 'APPROVED', 'RCC flat', 380, 'PARTIAL', 'South-East', 3, 2,
   'Water tank shades one corner in the evening.', now() - interval '4 days',
   (SELECT id FROM users WHERE email = 'admin@sunpower.com'), now() - interval '3 days', 'Looks good, proceed.',
   (SELECT id FROM users WHERE email = 'staff@sunpower.com'));

UPDATE surveys
   SET scheduled_date    = scheduled_date + interval '11 hours',   -- 11:00 visit slot
       structure_type    = 'Elevated GI Structure (1.5m clearance)',
       cable_run_meters  = 25,
       inverter_location = 'Near ground-floor main meter box',
       shading           = CASE shading WHEN 'NONE' THEN 'No shading between 9am and 4pm'
                                        ELSE 'Water tank shades the south-east corner after 3pm' END;

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
