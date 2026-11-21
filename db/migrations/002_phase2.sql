-- =============================================================
-- Migration 002 – Phase 2 (orders, payments, inventory, dispatch, jobs, warranties)
-- Upgrades an EXISTING database in place: leads, surveys, quotes and users are kept.
--   From backend/:  npm run db:migrate -- migrations/002_phase2.sql
-- Needs migration 001 first. Safe to run more than once.
-- =============================================================

\ir ../04_phase2_schema.sql
\ir ../05_phase2_seed.sql

-- Quotes already ACCEPTED before Phase 2 existed get their order now (30% advance, no payments yet).
INSERT INTO orders (lead_id, quote_id, total_amount, advance_pct, advance_required, created_by, created_at)
SELECT q.lead_id, q.id, q.total, 30, round(q.total * 0.30, 2), q.created_by, COALESCE(q.decided_at, now())
FROM quotes q
WHERE q.status = 'ACCEPTED'
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.quote_id = q.id);
