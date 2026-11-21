const { pool } = require('./db');

async function initDb() {
  try {
    // Automatically ensure all Phase 2 and Phase 3 columns, enums and tables exist
    await pool.query(`
      -- Ensure job_status enum values
      DO $$ BEGIN ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'IN_PROGRESS'; EXCEPTION WHEN others THEN NULL; END $$;
      DO $$ BEGIN ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'COMPLETED'; EXCEPTION WHEN others THEN NULL; END $$;

      -- Ensure users hourly_rate exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0;

      -- Ensure installation_jobs Phase 3 columns exist
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS started_at            TIMESTAMPTZ;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS started_by            BIGINT REFERENCES users(id);
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS finished_at           TIMESTAMPTZ;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS checklist             JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS confirmed_capacity_kw NUMERIC(5,2);
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS generation_reading_kw NUMERIC(6,2);
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signed_by_name        TEXT;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signature_path        TEXT;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signed_at             TIMESTAMPTZ;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS signature_hash        TEXT;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS labour_hours          NUMERIC(8,2);
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS labour_cost           NUMERIC(12,2);
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_by          BIGINT REFERENCES users(id);
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS customer_rating       INT;
      ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS customer_feedback     TEXT;

      -- Ensure Phase 3 tables exist
      CREATE TABLE IF NOT EXISTS job_crew (
        job_id        BIGINT      NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
        technician_id BIGINT      NOT NULL REFERENCES users(id),
        added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (job_id, technician_id)
      );

      DO $$ BEGIN CREATE TYPE photo_stage AS ENUM ('BEFORE', 'DURING', 'AFTER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS job_photos (
        id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        job_id      BIGINT      NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
        path        TEXT        NOT NULL,
        stage       photo_stage NOT NULL DEFAULT 'AFTER',
        uploaded_by BIGINT      REFERENCES users(id),
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

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

      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS installed_at     TIMESTAMPTZ;
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS installed_job_id BIGINT REFERENCES installation_jobs(id);
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS installed_by     BIGINT REFERENCES users(id);
    `);
    console.log('✓ Database schema verified: Phase 3 columns & tables active.');
  } catch (err) {
    // If database is not currently running or table not yet created, don't crash the server
    console.warn('initDb note:', err.message);
  }
}

module.exports = { initDb };
