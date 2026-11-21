-- =============================================================
-- Migration 004 - Phase 3 field installation
-- Upgrades an EXISTING database in place (needs 001, 002, 003 first). Safe to run twice.
--   From backend/:  npm run db:migrate -- migrations/004_phase3.sql
-- Adds the schema, hourly rates and the second technician. The demo DELIVERED order from
-- 07_phase3_seed.sql is NOT created here, so your own data is left exactly as it is.
-- =============================================================

\ir ../06_phase3_schema.sql

INSERT INTO users (name, email, phone, password_hash, role)
VALUES ('Zara Technician', 'tech2@sunpower.com', '9800000005',
        '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG', 'TECHNICIAN')
ON CONFLICT (email) DO NOTHING;

UPDATE users SET hourly_rate = CASE email
    WHEN 'tech@sunpower.com'  THEN 350
    WHEN 'tech2@sunpower.com' THEN 300
    WHEN 'admin@sunpower.com' THEN 500
    WHEN 'staff@sunpower.com' THEN 250
    WHEN 'staff2@sunpower.com' THEN 250
    ELSE hourly_rate END
WHERE hourly_rate = 0;

-- existing jobs: the crew lead is crew
INSERT INTO job_crew (job_id, technician_id)
SELECT id, crew_lead_id FROM installation_jobs WHERE crew_lead_id IS NOT NULL
ON CONFLICT DO NOTHING;
