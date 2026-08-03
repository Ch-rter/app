-- Charter indexer schema.
--
-- The indexer is read-only infrastructure for the frontend: it polls Soroban
-- RPC `getEvents`, stores every event verbatim in `charter_events`, and folds
-- them into the derived read-model tables (`orgs`, `categories`, `requests`,
-- `approvals`) that the REST API serves. The frontend never writes here — all
-- state changes go through Soroban via the user's wallet.
--
-- Amount columns are NUMERIC(30, 0): wide enough for the full i128 range and
-- exact (never float, never a type that can truncate).

-- Raw event log — the source of truth the read models are folded from.
-- `payload` keeps the decoded event body so a read model can be rebuilt or a
-- new one derived without re-polling the chain.
CREATE TABLE IF NOT EXISTS charter_events (
  id           BIGSERIAL PRIMARY KEY,
  contract_id  TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  ledger       INT         NOT NULL,
  tx_hash      TEXT        NOT NULL,
  -- RPC paging token; globally unique per event, so it also dedupes ingestion.
  paging_token TEXT        NOT NULL UNIQUE,
  payload      JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charter_events_contract ON charter_events (contract_id, ledger);
CREATE INDEX IF NOT EXISTS idx_charter_events_type ON charter_events (event_type);

-- Single-row ingestion checkpoint: the last ledger fully processed, so the
-- poller resumes without rescanning history. `id` is pinned to TRUE to enforce
-- exactly one row.
CREATE TABLE IF NOT EXISTS ingest_cursor (
  id                 BOOLEAN PRIMARY KEY DEFAULT TRUE,
  last_ledger        INT         NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ingest_cursor_singleton CHECK (id)
);

-- The contracts the poller watches: the factory plus every treasury it has
-- deployed. Treasury rows are added as `treasury_deployed` events arrive, so
-- the watch list bootstraps from the factory's own event history.
CREATE TABLE IF NOT EXISTS watched_contracts (
  contract_id TEXT PRIMARY KEY,
  kind        TEXT        NOT NULL CHECK (kind IN ('factory', 'treasury')),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Derived read models
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orgs (
  id               INT  PRIMARY KEY,
  name             TEXT NOT NULL,
  treasury_address TEXT NOT NULL UNIQUE,
  admin_address    TEXT NOT NULL,
  created_ledger   INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  treasury_address TEXT          NOT NULL,
  category_id      INT           NOT NULL,
  name             TEXT          NOT NULL,
  cap              NUMERIC(30, 0) NOT NULL,
  spent            NUMERIC(30, 0) NOT NULL DEFAULT 0,
  active           BOOLEAN       NOT NULL DEFAULT TRUE,
  PRIMARY KEY (treasury_address, category_id)
);

CREATE TABLE IF NOT EXISTS requests (
  treasury_address TEXT          NOT NULL,
  request_id       INT           NOT NULL,
  category_id      INT           NOT NULL,
  recipient        TEXT          NOT NULL,
  amount           NUMERIC(30, 0) NOT NULL,
  memo             TEXT,
  requester        TEXT          NOT NULL,
  status           TEXT          NOT NULL CHECK (status IN ('Pending', 'Executed', 'Rejected', 'Cancelled')),
  created_ledger   INT           NOT NULL,
  PRIMARY KEY (treasury_address, request_id)
);

CREATE INDEX IF NOT EXISTS idx_requests_treasury_status ON requests (treasury_address, status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests (treasury_address, category_id);

CREATE TABLE IF NOT EXISTS approvals (
  treasury_address TEXT NOT NULL,
  request_id       INT  NOT NULL,
  approver         TEXT NOT NULL,
  approved_ledger  INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (treasury_address, request_id, approver)
);
