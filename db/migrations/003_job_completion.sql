-- =============================================================
-- Migration 003 - installation job completion
-- Adds the job statuses IN_PROGRESS / COMPLETED and who/when completed a job.
-- Upgrades an EXISTING database in place (fresh databases get this from 04_phase2_schema.sql).
--   From backend/:  npm run db:migrate -- migrations/003_job_completion.sql
-- Needs migration 002 first. Safe to run more than once.
-- =============================================================

ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_by BIGINT REFERENCES users(id);
