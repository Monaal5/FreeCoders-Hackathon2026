-- =============================================================
-- SunPower - Phase 3 seed
--   1) hourly rates + a second technician (so a job can have a 2-person crew)
--   2) ONE demo order already DELIVERED with an installation job scheduled TODAY for
--      Vikram (crew lead) + Zara, so the field screens can be tested straight after db:reset.
-- The demo order is only created when lead SP-1003 (Green Valley School) is still in its
-- seeded QUALIFIED state with no quotes, so running this twice does nothing the second time.
-- =============================================================

-- ---------- crew ----------
INSERT INTO users (name, email, phone, password_hash, role)
VALUES ('Zara Technician', 'tech2@sunpower.com', '9800000005',
        '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'TECHNICIAN')   -- password123
ON CONFLICT (email) DO NOTHING;

UPDATE users SET hourly_rate = CASE email
    WHEN 'tech@sunpower.com'  THEN 350   -- lead electrician
    WHEN 'tech2@sunpower.com' THEN 300   -- installer
    WHEN 'admin@sunpower.com' THEN 500
    WHEN 'staff@sunpower.com' THEN 250
    WHEN 'staff2@sunpower.com' THEN 250
    ELSE hourly_rate END;

-- ---------- demo: Green Valley School, 5 kW On-Grid + installation, DELIVERED ----------
DO $$
DECLARE
  v_lead BIGINT; v_staff BIGINT; v_admin BIGINT; v_tech BIGINT; v_tech2 BIGINT;
  v_survey BIGINT; v_tpl BIGINT; v_inst BIGINT; v_quote BIGINT; v_order BIGINT; v_job BIGINT;
  v_sub NUMERIC; v_gst NUMERIC; v_total NUMERIC;
BEGIN
  SELECT id, assigned_to INTO v_lead, v_staff FROM leads WHERE lead_code = 'SP-1003' AND status = 'QUALIFIED';
  IF v_lead IS NULL OR EXISTS (SELECT 1 FROM quotes WHERE lead_id = v_lead) THEN
    RETURN;  -- already created, or the lead has moved on
  END IF;
  SELECT id INTO v_admin FROM users WHERE email = 'admin@sunpower.com';
  SELECT id INTO v_tech  FROM users WHERE email = 'tech@sunpower.com';
  SELECT id INTO v_tech2 FROM users WHERE email = 'tech2@sunpower.com';

  -- approved survey
  INSERT INTO surveys (lead_id, technician_id, scheduled_date, status, roof_type, roof_area_sqft, shading,
                       orientation, sanctioned_load_kw, recommended_kw, technician_notes, submitted_at,
                       reviewed_by, reviewed_at, review_note, created_by, structure_type, cable_run_meters,
                       inverter_location)
  VALUES (v_lead, v_tech, now() - interval '9 days', 'APPROVED', 'RCC flat', 620, 'No shading 9am-4pm',
          'South', 10, 5, 'School terrace, wide staircase access', now() - interval '8 days',
          v_admin, now() - interval '7 days', 'Approved for 5 kW on-grid', v_staff,
          'Elevated GI Structure (1.5m clearance)', 40, 'Staff room wall')
  RETURNING id INTO v_survey;

  -- accepted quote: 5 kW On-Grid + 5 kW installation, parts copied from the packages
  SELECT id INTO v_tpl  FROM package_templates WHERE kind = 'ON_GRID'      AND capacity_kw = 5;
  SELECT id INTO v_inst FROM package_templates WHERE kind = 'INSTALLATION' AND capacity_kw = 5;
  SELECT round(sum(round(ti.quantity * p.unit_price, 2)), 2),
         round(sum(round(ti.quantity * p.unit_price * p.gst_rate / 100, 2)), 2)
    INTO v_sub, v_gst
    FROM template_items ti JOIN products p ON p.id = ti.product_id
   WHERE ti.template_id IN (v_tpl, v_inst);
  v_total := v_sub + v_gst;

  INSERT INTO quotes (lead_id, survey_id, template_id, status, package_kind, system_type, includes_installation,
                      capacity_kw, subtotal, discount_pct, discount_amount, taxable_amount, gst_amount, total,
                      valid_until, notes, created_by, sent_at, decided_at, created_at)
  VALUES (v_lead, v_survey, v_tpl, 'ACCEPTED', 'ON_GRID', 'ON_GRID', TRUE, 5, v_sub, 0, 0, v_sub, v_gst, v_total,
          current_date + 8, 'Demo order for the field-installation screens', v_staff,
          now() - interval '6 days', now() - interval '6 days', now() - interval '7 days')
  RETURNING id INTO v_quote;

  INSERT INTO quote_items (quote_id, product_id, sku, name, category, unit, quantity, unit_price, gst_rate,
                           line_total, section, sort_order)
  SELECT v_quote, p.id, p.sku, p.name, p.category, p.unit, ti.quantity, p.unit_price, p.gst_rate,
         round(ti.quantity * p.unit_price, 2), ti.section, ti.sort_order
    FROM template_items ti JOIN products p ON p.id = ti.product_id
   WHERE ti.template_id IN (v_tpl, v_inst);

  UPDATE leads SET status = 'WON', suggested_kw = 5 WHERE id = v_lead;
  INSERT INTO lead_activities (lead_id, actor_id, type, from_status, to_status, note, created_at) VALUES
    (v_lead, v_staff, 'STATUS_CHANGE', 'QUALIFIED', 'SURVEY_SCHEDULED', 'Survey assigned to Vikram Technician', now() - interval '10 days'),
    (v_lead, v_tech,  'STATUS_CHANGE', 'SURVEY_SCHEDULED', 'SURVEY_SUBMITTED', 'Survey submitted, recommends 5 kW', now() - interval '8 days'),
    (v_lead, v_admin, 'STATUS_CHANGE', 'SURVEY_SUBMITTED', 'SURVEY_APPROVED', 'Survey approved', now() - interval '7 days'),
    (v_lead, v_staff, 'STATUS_CHANGE', 'SURVEY_APPROVED', 'QUOTED', 'Quote created: 5 kW On-Grid System + Installation', now() - interval '7 days'),
    (v_lead, v_staff, 'STATUS_CHANGE', 'QUOTED', 'WON', 'Quote accepted', now() - interval '6 days');

  -- order: advance paid, confirmed, picked, dispatched and delivered
  INSERT INTO orders (lead_id, quote_id, status, total_amount, advance_pct, advance_required, amount_paid,
                      confirmed_at, created_by, created_at)
  VALUES (v_lead, v_quote, 'DELIVERED', v_total, 30, round(v_total * 0.30, 2), round(v_total * 0.30, 2),
          now() - interval '5 days', v_staff, now() - interval '6 days')
  RETURNING id INTO v_order;

  INSERT INTO payments (order_id, amount, type, mode, reference, received_by, paid_at)
  VALUES (v_order, round(v_total * 0.30, 2), 'ADVANCE', 'BANK', 'NEFT-DEMO-5001', v_staff, now() - interval '5 days');

  INSERT INTO pick_list_items (order_id, product_id, is_serialized, qty_required, qty_scanned)
  SELECT v_order, qi.product_id, p.is_serialized, sum(qi.quantity), sum(qi.quantity)
    FROM quote_items qi JOIN products p ON p.id = qi.product_id
   WHERE qi.quote_id = v_quote AND p.category <> 'SERVICE'
   GROUP BY qi.product_id, p.is_serialized;

  -- the 12 serialized units on the truck: 10 panels, 1 inverter, 1 charge controller
  UPDATE inventory_items SET status = 'DELIVERED', order_id = v_order
   WHERE status = 'IN_STOCK'
     AND serial_number IN ('PNL-540-SN0015', 'PNL-540-SN0016', 'PNL-540-SN0017', 'PNL-540-SN0018', 'PNL-540-SN0019',
                           'PNL-540-SN0020', 'PNL-540-SN0021', 'PNL-540-SN0022', 'PNL-540-SN0023', 'PNL-540-SN0024',
                           'INV-ONG-5-SN0001', 'CC-MPPT-60-SN0004');

  UPDATE products p SET stock_qty = p.stock_qty - pl.qty_required
    FROM pick_list_items pl
   WHERE pl.order_id = v_order AND pl.product_id = p.id AND NOT pl.is_serialized;

  INSERT INTO stock_movements (product_id, qty_change, reason, order_id, note, created_by, created_at)
  SELECT pl.product_id, -pl.qty_required, 'DISPATCHED', v_order, 'Demo dispatch', v_staff, now() - interval '2 days'
    FROM pick_list_items pl WHERE pl.order_id = v_order;

  INSERT INTO dispatches (order_id, vehicle_no, driver_name, dispatched_by, dispatched_at, delivered_at, delivered_confirmed_by)
  VALUES (v_order, 'UP16 CK 4521', 'Mahesh Yadav', v_staff, now() - interval '2 days', now() - interval '1 day', v_staff);

  INSERT INTO warranties (inventory_item_id, order_id, start_date, end_date, months)
  SELECT i.id, v_order, current_date - 1, (current_date - 1 + make_interval(months => p.warranty_months))::date, p.warranty_months
    FROM inventory_items i JOIN products p ON p.id = i.product_id
   WHERE i.order_id = v_order;

  -- installation job TODAY: Vikram leads, Zara assists
  INSERT INTO installation_jobs (order_id, crew_lead_id, scheduled_date, status, notes)
  VALUES (v_order, v_tech, current_date, 'SCHEDULED', 'School terrace: bring 2 ladders, call the principal on arrival')
  RETURNING id INTO v_job;
  INSERT INTO job_crew (job_id, technician_id) VALUES (v_job, v_tech), (v_job, v_tech2);

  INSERT INTO lead_activities (lead_id, actor_id, type, note, created_at) VALUES
    (v_lead, v_staff, 'NOTE', 'Order confirmed, dispatched on UP16 CK 4521 and delivered; 12 warranties started', now() - interval '1 day'),
    (v_lead, v_staff, 'NOTE', 'Installation scheduled for today: Vikram Technician (lead) + Zara Technician', now() - interval '1 day');
END $$;
