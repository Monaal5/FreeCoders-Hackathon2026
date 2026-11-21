-- =============================================================
-- Migration 001 – ready-made packages (Panel Set / On-Grid / Off-Grid / Installation)
-- Upgrades an EXISTING database in place: leads, surveys, quotes and users are kept.
--   From backend/:  npm run db:migrate -- migrations/001_packages.sql
-- Safe to run more than once.
-- =============================================================

DO $$ BEGIN
  CREATE TYPE package_kind AS ENUM ('PANEL_SET', 'ON_GRID', 'OFF_GRID', 'INSTALLATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- package_templates: kind + optional system_type, unique per (kind, kW)
ALTER TABLE package_templates ADD COLUMN IF NOT EXISTS kind package_kind;
UPDATE package_templates SET kind = system_type::text::package_kind WHERE kind IS NULL;
ALTER TABLE package_templates ALTER COLUMN kind SET NOT NULL;
ALTER TABLE package_templates ALTER COLUMN system_type DROP NOT NULL;
ALTER TABLE package_templates DROP CONSTRAINT IF EXISTS package_templates_capacity_kw_system_type_key;
DO $$ BEGIN
  ALTER TABLE package_templates ADD CONSTRAINT package_templates_kind_capacity_key UNIQUE (kind, capacity_kw);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- template_items: section + order for grouped parts lists
ALTER TABLE template_items ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE template_items ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- quotes: which package, optional installation; system_type optional (panel set only)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS package_kind package_kind;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS includes_installation BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quotes ALTER COLUMN system_type DROP NOT NULL;
UPDATE quotes SET package_kind = system_type::text::package_kind WHERE package_kind IS NULL AND system_type IS NOT NULL;

-- quote_items: keep the section on the snapshot
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- new parts catalogue + packages + parts lists
\ir ../03_packages.sql
