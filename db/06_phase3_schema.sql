-- =============================================================
-- SunPower - Phase 3 schema: field installation ("on the roof")
--
--   job:    SCHEDULED -> IN_PROGRESS (Start tapped) -> COMPLETED (checklist + photos + serials + signature)
--   order:  DELIVERED -> INSTALLED      serial: DELIVERED -> INSTALLED (verified on site)
--
-- Safe on a fresh database (reset.sql) and on an existing one (migrations/004_phase3.sql):
-- IF NOT EXISTS / duplicate_object guards everywhere. Job statuses IN_PROGRESS / COMPLETED come
-- from 04_phase2_schema.sql (fresh) or migrations/003_job_completion.sql (existing).
-- =============================================================

DO $$ BEGIN CREATE TYPE photo_stage AS ENUM ('BEFORE', 'DURING', 'AFTER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- labour costing: what one hour of this person's time costs the company (Rs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN ALTER TABLE users ADD CONSTRAINT users_hourly_rate_nonneg CHECK (hourly_rate >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- installation_jobs: the on-site record ----------
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS started_at            TIMESTAMPTZ;
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS started_by            BIGINT REFERENCES users(id);
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS finished_at           TIMESTAMPTZ;
-- { "STANDS_MOUNTED": true, "PANELS_LAID": false, ... } – saved as the crew goes, so nothing is lost
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS checklist             JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS confirmed_capacity_kw NUMERIC(5,2);
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS generation_reading_kw NUMERIC(6,2);
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signed_by_name        TEXT;
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signature_path        TEXT;     -- /uploads/signatures/<file>.png
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signed_at             TIMESTAMPTZ;
-- SHA-256(job id | installed serials | signed time | signature image) -> tamper-evident proof of the job
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signature_hash        TEXT;
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS labour_hours          NUMERIC(8,2);
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS labour_cost           NUMERIC(12,2);
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ;
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_by          BIGINT REFERENCES users(id);

-- ---------- job_crew: everyone on the roof (the crew lead is always counted as crew) ----------
CREATE TABLE IF NOT EXISTS job_crew (
  job_id        BIGINT      NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
  technician_id BIGINT      NOT NULL REFERENCES users(id),
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, technician_id)
);
CREATE INDEX IF NOT EXISTS idx_job_crew_technician ON job_crew(technician_id);

-- ---------- job_photos ----------
CREATE TABLE IF NOT EXISTS job_photos (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id      BIGINT      NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
  path        TEXT        NOT NULL,                 -- /uploads/jobs/<file>
  stage       photo_stage NOT NULL,
  uploaded_by BIGINT      REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON job_photos(job_id, stage);

-- ---------- job_time_logs: labour per technician (feeds the Phase 5 profit report) ----------
CREATE TABLE IF NOT EXISTS job_time_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id        BIGINT        NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
  technician_id BIGINT        NOT NULL REFERENCES users(id),
  hours         NUMERIC(8,2)  NOT NULL CHECK (hours >= 0),
  hourly_rate   NUMERIC(10,2) NOT NULL CHECK (hourly_rate >= 0),
  cost          NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (job_id, technician_id)
);

-- ---------- serials: who verified each unit on the roof, and when ----------
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS installed_at     TIMESTAMPTZ;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS installed_job_id BIGINT REFERENCES installation_jobs(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS installed_by     BIGINT REFERENCES users(id);
