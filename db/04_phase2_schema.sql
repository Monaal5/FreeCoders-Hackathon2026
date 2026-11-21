-- =============================================================
-- SunPower – Phase 2 schema: Order -> Inventory -> Dispatch -> Warranty
--
--   order:  PENDING_PAYMENT -> CONFIRMED -> DISPATCHED -> DELIVERED (-> INSTALLED, Phase 3)
--            (advance paid)   (all serials scanned)   (warranty starts)
--   serial: IN_STOCK -> RESERVED (scanned) -> DISPATCHED -> DELIVERED (-> INSTALLED)
--
-- Written to be safe on a fresh database (reset.sql) AND on an existing one
-- (migrations/002_phase2.sql): IF NOT EXISTS / duplicate_object guards everywhere.
-- =============================================================

-- ---------- enums ----------
DO $$ BEGIN CREATE TYPE order_status   AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'INSTALLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE serial_status  AS ENUM ('IN_STOCK', 'RESERVED', 'DISPATCHED', 'DELIVERED', 'INSTALLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_type   AS ENUM ('ADVANCE', 'BALANCE', 'FULL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_mode   AS ENUM ('UPI', 'CASH', 'BANK', 'CHEQUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stock_reason   AS ENUM ('RECEIVED', 'DISPATCHED', 'ADJUSTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE job_status     AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- products: stock & warranty settings ----------
-- is_serialized: tracked unit-by-unit (scanned) – inverter, battery, charge controller, panels
-- stock_qty:     on-hand quantity for BULK items (wires, stands, switches…); serial stock = count of IN_STOCK rows
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_serialized   BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_months INT           NOT NULL DEFAULT 0 CHECK (warranty_months >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_qty       NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0);
DO $$ BEGIN ALTER TABLE products ADD CONSTRAINT products_stock_qty_nonneg CHECK (stock_qty >= 0);   -- belt and braces
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- orders ----------
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE TABLE IF NOT EXISTS orders (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number     TEXT          NOT NULL UNIQUE
                   DEFAULT ('SPO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 4, '0')),
  lead_id          BIGINT        NOT NULL REFERENCES leads(id),
  quote_id         BIGINT        NOT NULL UNIQUE REFERENCES quotes(id),   -- one order per accepted quote
  status           order_status  NOT NULL DEFAULT 'PENDING_PAYMENT',
  total_amount     NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_pct      NUMERIC(5,2)  NOT NULL,
  advance_required NUMERIC(12,2) NOT NULL CHECK (advance_required >= 0),
  amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  confirmed_at     TIMESTAMPTZ,
  created_by       BIGINT        REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT orders_paid_not_above_total CHECK (amount_paid <= total_amount)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_lead   ON orders(lead_id);
DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- payments ----------
CREATE TABLE IF NOT EXISTS payments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type        payment_type  NOT NULL,
  mode        payment_mode  NOT NULL,
  reference   TEXT,                                   -- UPI txn id, cheque no., bank ref…
  received_by BIGINT        REFERENCES users(id),
  paid_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ---------- inventory_items: one row per physical serialized unit ----------
CREATE TABLE IF NOT EXISTS inventory_items (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    BIGINT        NOT NULL REFERENCES products(id),
  serial_number TEXT          NOT NULL UNIQUE,
  status        serial_status NOT NULL DEFAULT 'IN_STOCK',
  order_id      BIGINT        REFERENCES orders(id),
  purchase_cost NUMERIC(12,2) CHECK (purchase_cost IS NULL OR purchase_cost >= 0),
  received_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- a unit in stock belongs to no order; any other state must belong to one
  CONSTRAINT inventory_order_matches_status CHECK ((status = 'IN_STOCK') = (order_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_inventory_product_status ON inventory_items(product_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_order          ON inventory_items(order_id);
DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory_items;
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- stock_movements: the stock ledger (append-only) ----------
CREATE TABLE IF NOT EXISTS stock_movements (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT        NOT NULL REFERENCES products(id),
  qty_change NUMERIC(12,2) NOT NULL CHECK (qty_change <> 0),  -- + in, - out
  reason     stock_reason  NOT NULL,
  order_id   BIGINT        REFERENCES orders(id),
  note       TEXT,
  created_by BIGINT        REFERENCES users(id),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

-- ---------- pick_list_items: what the warehouse must hand over per order ----------
CREATE TABLE IF NOT EXISTS pick_list_items (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    BIGINT        NOT NULL REFERENCES products(id),
  is_serialized BOOLEAN       NOT NULL,           -- copied from product at confirmation
  qty_required  NUMERIC(12,2) NOT NULL CHECK (qty_required > 0),
  qty_scanned   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (qty_scanned >= 0),
  CONSTRAINT pick_scanned_not_above_required CHECK (qty_scanned <= qty_required),
  UNIQUE (order_id, product_id)
);

-- ---------- dispatches ----------
CREATE TABLE IF NOT EXISTS dispatches (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id               BIGINT      NOT NULL UNIQUE REFERENCES orders(id),
  vehicle_no             TEXT        NOT NULL,
  driver_name            TEXT        NOT NULL,
  dispatched_by          BIGINT      REFERENCES users(id),
  dispatched_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at           TIMESTAMPTZ,
  delivered_confirmed_by BIGINT      REFERENCES users(id)
);

-- ---------- installation_jobs ----------
CREATE TABLE IF NOT EXISTS installation_jobs (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id       BIGINT      NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  crew_lead_id   BIGINT      REFERENCES users(id),     -- a TECHNICIAN; assigned later
  scheduled_date DATE,
  status         job_status  NOT NULL DEFAULT 'SCHEDULED',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_crew_date ON installation_jobs(crew_lead_id, scheduled_date);
-- job completion (also added to existing databases by migrations/003_job_completion.sql)
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE installation_jobs ADD COLUMN IF NOT EXISTS completed_by BIGINT REFERENCES users(id);
DROP TRIGGER IF EXISTS trg_jobs_updated ON installation_jobs;
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON installation_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- warranties: one per delivered serial ----------
CREATE TABLE IF NOT EXISTS warranties (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL UNIQUE REFERENCES inventory_items(id),
  order_id          BIGINT NOT NULL REFERENCES orders(id),
  start_date        DATE   NOT NULL,
  end_date          DATE   NOT NULL,
  months            INT    NOT NULL CHECK (months >= 0),
  CONSTRAINT warranty_dates_ordered CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_warranties_order ON warranties(order_id);
