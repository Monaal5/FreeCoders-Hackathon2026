-- =============================================================
-- Drops EVERYTHING in the public schema and rebuilds it.
--   From backend/:  npm run db:reset          (no psql needed)
--   With psql:      psql -d sunpower -f db/reset.sql
-- =============================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

\ir 01_schema.sql
\ir 02_seed.sql
