-- =============================================================
-- SunPower – Phase 1 schema (PostgreSQL 14+)
-- Lead -> Qualify -> Survey -> Approval -> Quote
-- Run via:  npm run db:reset   (from backend/)   or   psql -f db/reset.sql
-- =============================================================

-- ---------- Enums ----------
CREATE TYPE user_role        AS ENUM ('ADMIN', 'STAFF', 'TECHNICIAN');
CREATE TYPE lead_status      AS ENUM ('NEW', 'QUALIFIED', 'SURVEY_SCHEDULED', 'SURVEY_SUBMITTED',
                                      'SURVEY_APPROVED', 'QUOTED', 'WON', 'LOST');
CREATE TYPE lead_source      AS ENUM ('WEBSITE', 'PHONE', 'WHATSAPP', 'WALK_IN', 'REFERRAL');
CREATE TYPE property_type    AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL');
CREATE TYPE system_type      AS ENUM ('ON_GRID', 'OFF_GRID');
CREATE TYPE survey_status    AS ENUM ('SCHEDULED', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE quote_status     AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');
CREATE TYPE product_category AS ENUM ('PANEL', 'INVERTER', 'BATTERY', 'STRUCTURE', 'CABLE', 'BOS', 'SERVICE');
CREATE TYPE activity_type    AS ENUM ('CREATED', 'ASSIGNED', 'STATUS_CHANGE', 'NOTE');
-- What a package is: hardware-only panel set, a complete system, or the installation service add-on
CREATE TYPE package_kind     AS ENUM ('PANEL_SET', 'ON_GRID', 'OFF_GRID', 'INSTALLATION');

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- users ----------
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role) WHERE is_active;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- leads ----------
CREATE SEQUENCE lead_code_seq START 1001;

CREATE TABLE leads (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_code     TEXT          NOT NULL UNIQUE DEFAULT ('SP-' || nextval('lead_code_seq')),
  customer_name TEXT          NOT NULL,
  phone         TEXT          NOT NULL,
  email         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  property_type property_type NOT NULL DEFAULT 'RESIDENTIAL',
  monthly_bill  NUMERIC(12,2) CHECK (monthly_bill IS NULL OR monthly_bill >= 0),
  roof_type     TEXT,                                   -- as reported by the customer
  roof_area_sqft NUMERIC(10,2) CHECK (roof_area_sqft IS NULL OR roof_area_sqft >= 0),
  message       TEXT,
  source        lead_source   NOT NULL DEFAULT 'WEBSITE',
  status        lead_status   NOT NULL DEFAULT 'NEW',
  assigned_to   BIGINT        REFERENCES users(id) ON DELETE SET NULL,
  qualification JSONB         NOT NULL DEFAULT '{}'::jsonb,
  suggested_kw  NUMERIC(5,2),
  lost_reason   TEXT,
  created_by    BIGINT        REFERENCES users(id) ON DELETE SET NULL,  -- NULL = public enquiry
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_status     ON leads(status);
CREATE INDEX idx_leads_assigned   ON leads(assigned_to, status);
CREATE INDEX idx_leads_phone      ON leads(phone);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- lead_activities (timeline / audit log) ----------
CREATE TABLE lead_activities (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id     BIGINT        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id    BIGINT        REFERENCES users(id) ON DELETE SET NULL,     -- NULL = system / public
  type        activity_type NOT NULL,
  from_status lead_status,
  to_status   lead_status,
  note        TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_lead ON lead_activities(lead_id, created_at DESC);

-- ---------- surveys ----------
CREATE TABLE surveys (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id            BIGINT        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  technician_id      BIGINT        NOT NULL REFERENCES users(id),
  scheduled_date     TIMESTAMPTZ   NOT NULL,                -- visit date + time slot
  status             survey_status NOT NULL DEFAULT 'SCHEDULED',
  assign_notes       TEXT,
  -- filled by technician on submit
  roof_type          TEXT,
  roof_area_sqft     NUMERIC(10,2),
  shading            TEXT,                                  -- free-text shading / azimuth analysis
  orientation        TEXT,
  structure_type     TEXT,
  cable_run_meters   NUMERIC(8,2),
  inverter_location  TEXT,
  sanctioned_load_kw NUMERIC(6,2),
  recommended_kw     NUMERIC(5,2),
  latitude           NUMERIC(9,6),
  longitude          NUMERIC(9,6),
  technician_notes   TEXT,
  photos             TEXT[]        NOT NULL DEFAULT '{}',   -- e.g. {'/uploads/surveys/abc.jpg'}
  submitted_at       TIMESTAMPTZ,
  -- filled by admin on review
  reviewed_by        BIGINT        REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  review_note        TEXT,
  created_by         BIGINT        REFERENCES users(id),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_surveys_lead       ON surveys(lead_id);
CREATE INDEX idx_surveys_technician ON surveys(technician_id, status);
-- at most one open (scheduled/submitted) survey per lead
CREATE UNIQUE INDEX uq_surveys_one_open_per_lead ON surveys(lead_id) WHERE status IN ('SCHEDULED', 'SUBMITTED');
CREATE TRIGGER trg_surveys_updated BEFORE UPDATE ON surveys FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- products (catalogue) ----------
CREATE TABLE products (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku        TEXT             NOT NULL UNIQUE,
  name       TEXT             NOT NULL,
  category   product_category NOT NULL,
  brand      TEXT,
  unit       TEXT             NOT NULL DEFAULT 'nos',
  unit_price NUMERIC(12,2)    NOT NULL CHECK (unit_price >= 0),
  gst_rate   NUMERIC(5,2)     NOT NULL DEFAULT 18 CHECK (gst_rate BETWEEN 0 AND 28),
  is_active  BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- ---------- package_templates + template_items (BOM) ----------
-- Ready-made packages (see 03_packages.sql). Picking one copies its complete parts list into
-- the quote, so nobody has to remember connectors, switches, earthing, stands ...
CREATE TABLE package_templates (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT         NOT NULL,
  kind        package_kind NOT NULL,
  capacity_kw NUMERIC(5,2) NOT NULL CHECK (capacity_kw > 0),
  system_type system_type,                 -- ON_GRID / OFF_GRID for systems; NULL for panel set & installation
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT package_templates_kind_capacity_key UNIQUE (kind, capacity_kw)
);

CREATE TABLE template_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id BIGINT        NOT NULL REFERENCES package_templates(id) ON DELETE CASCADE,
  product_id  BIGINT        NOT NULL REFERENCES products(id),
  quantity    NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  section     TEXT          NOT NULL DEFAULT 'Other',  -- e.g. 'Solar Panels & Wiring', 'Safety & Earthing'
  sort_order  INT           NOT NULL DEFAULT 0,
  UNIQUE (template_id, product_id)
);

-- ---------- quotes + quote_items ----------
CREATE SEQUENCE quote_number_seq START 1;

CREATE TABLE quotes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quote_number    TEXT          NOT NULL UNIQUE
                  DEFAULT ('SPQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('quote_number_seq')::text, 4, '0')),
  lead_id         BIGINT        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  survey_id       BIGINT        REFERENCES surveys(id),
  template_id     BIGINT        REFERENCES package_templates(id),
  status          quote_status  NOT NULL DEFAULT 'DRAFT',
  package_kind    package_kind,
  system_type     system_type,                  -- NULL for a panel-set-only quote
  includes_installation BOOLEAN NOT NULL DEFAULT FALSE,
  capacity_kw     NUMERIC(5,2)  NOT NULL,
  subtotal        NUMERIC(12,2) NOT NULL,
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable_amount  NUMERIC(12,2) NOT NULL,
  gst_amount      NUMERIC(12,2) NOT NULL,
  total           NUMERIC(12,2) NOT NULL,
  valid_until     DATE,
  notes           TEXT,
  created_by      BIGINT        REFERENCES users(id),
  sent_at         TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_quotes_lead ON quotes(lead_id);
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- quote_items is a SNAPSHOT of the BOM: later price changes never alter an issued quote
CREATE TABLE quote_items (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quote_id   BIGINT           NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id BIGINT           REFERENCES products(id),
  sku        TEXT             NOT NULL,
  name       TEXT             NOT NULL,
  category   product_category NOT NULL,
  unit       TEXT             NOT NULL,
  quantity   NUMERIC(10,2)    NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2)    NOT NULL,
  gst_rate   NUMERIC(5,2)     NOT NULL,
  line_total NUMERIC(12,2)    NOT NULL,       -- quantity * unit_price (before discount & GST)
  section    TEXT,                            -- copied from the template, groups the quote/PDF
  sort_order INT              NOT NULL DEFAULT 0
);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
