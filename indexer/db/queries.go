// Package db is the indexer's Postgres access layer.
//
// It owns the connection pool, applies the schema on boot, and exposes the
// narrow set of queries the ingestion loop and REST API need. All amount
// columns are NUMERIC(30, 0); amounts cross this boundary as decimal strings
// (never float64) so the full i128 range survives round-trips exactly.
package db

import (
	"context"
	_ "embed"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// schemaSQL is the DDL applied idempotently on startup. Every statement in it
// is guarded with IF NOT EXISTS, so applying it to an up-to-date database is a
// no-op.
//
//go:embed schema.sql
var schemaSQL string

// DB wraps the connection pool with the queries the indexer performs.
type DB struct {
	pool *pgxpool.Pool
}

// Event is a single raw contract event, stored verbatim as the source of truth
// the read models are folded from.
type Event struct {
	ContractID  string
	EventType   string
	Ledger      int64
	TxHash      string
	PagingToken string
	// Payload is the decoded event body as JSON (topics + value + tx hash).
	Payload []byte
}

// WatchedContract is a contract the poller subscribes to.
type WatchedContract struct {
	ContractID string
	Kind       string
}

// Connect opens a pooled connection to Postgres and verifies it with a ping.
func Connect(ctx context.Context, url string) (*DB, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("open pgx pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &DB{pool: pool}, nil
}

// Close releases the pool. Safe to call on a nil-free *DB.
func (d *DB) Close() {
	d.pool.Close()
}

// Ping verifies the database is reachable, backing the API health check.
func (d *DB) Ping(ctx context.Context) error {
	if err := d.pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}
	return nil
}

// ApplySchema runs the embedded schema. It is idempotent.
func (d *DB) ApplySchema(ctx context.Context) error {
	if _, err := d.pool.Exec(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	return nil
}

// -- Ingestion checkpoint ----------------------------------------------------

// GetCursor returns the last fully processed ledger, or 0 when ingestion has
// never run.
func (d *DB) GetCursor(ctx context.Context) (int64, error) {
	var last int64
	err := d.pool.QueryRow(ctx, `SELECT last_ledger FROM ingest_cursor WHERE id = TRUE`).Scan(&last)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read ingest cursor: %w", err)
	}
	return last, nil
}

// SetCursor advances the checkpoint to the given ledger.
func (d *DB) SetCursor(ctx context.Context, ledger int64) error {
	_, err := d.pool.Exec(ctx, `
		INSERT INTO ingest_cursor (id, last_ledger, updated_at)
		VALUES (TRUE, $1, now())
		ON CONFLICT (id) DO UPDATE SET last_ledger = EXCLUDED.last_ledger, updated_at = now()
	`, ledger)
	if err != nil {
		return fmt.Errorf("write ingest cursor: %w", err)
	}
	return nil
}

// -- Watched contracts -------------------------------------------------------

// AddWatchedContract registers a contract for polling. Idempotent.
func (d *DB) AddWatchedContract(ctx context.Context, contractID, kind string) error {
	_, err := d.pool.Exec(ctx, `
		INSERT INTO watched_contracts (contract_id, kind)
		VALUES ($1, $2)
		ON CONFLICT (contract_id) DO NOTHING
	`, contractID, kind)
	if err != nil {
		return fmt.Errorf("add watched contract %s: %w", contractID, err)
	}
	return nil
}

// ListWatchedContracts returns every contract the poller should query.
func (d *DB) ListWatchedContracts(ctx context.Context) ([]WatchedContract, error) {
	rows, err := d.pool.Query(ctx, `SELECT contract_id, kind FROM watched_contracts ORDER BY added_at`)
	if err != nil {
		return nil, fmt.Errorf("list watched contracts: %w", err)
	}
	defer rows.Close()

	var out []WatchedContract
	for rows.Next() {
		var w WatchedContract
		if err := rows.Scan(&w.ContractID, &w.Kind); err != nil {
			return nil, fmt.Errorf("scan watched contract: %w", err)
		}
		out = append(out, w)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate watched contracts: %w", err)
	}
	return out, nil
}

// -- Raw event log -----------------------------------------------------------

// InsertEvent stores a raw event. The unique paging_token makes this idempotent:
// re-ingesting an already-seen event is a no-op. Returns true when a new row was
// inserted, so the caller only folds first-seen events into the read models.
func (d *DB) InsertEvent(ctx context.Context, ev Event) (bool, error) {
	tag, err := d.pool.Exec(ctx, `
		INSERT INTO charter_events (contract_id, event_type, ledger, tx_hash, paging_token, payload)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb)
		ON CONFLICT (paging_token) DO NOTHING
	`, ev.ContractID, ev.EventType, ev.Ledger, ev.TxHash, ev.PagingToken, string(ev.Payload))
	if err != nil {
		return false, fmt.Errorf("insert event %s: %w", ev.PagingToken, err)
	}
	return tag.RowsAffected() == 1, nil
}

// -- Read-model folds --------------------------------------------------------
//
// Orgs are keyed by treasury_address — the identity the frontend uses to select
// an org everywhere. The integer id is an indexer-local list key, assigned on
// first sight; it does not have to match the factory's on-chain org index.

// UpsertOrg records a deployed treasury. On a new treasury it assigns the next
// local id; on a known treasury it refreshes the mutable fields.
func (d *DB) UpsertOrg(ctx context.Context, name, treasury, admin string, createdLedger int64) error {
	_, err := d.pool.Exec(ctx, `
		INSERT INTO orgs (id, name, treasury_address, admin_address, created_ledger)
		VALUES ((SELECT COALESCE(MAX(id), -1) + 1 FROM orgs), $1, $2, $3, $4)
		ON CONFLICT (treasury_address) DO UPDATE
		SET name = COALESCE(NULLIF(EXCLUDED.name, ''), orgs.name),
		    admin_address = EXCLUDED.admin_address
	`, name, treasury, admin, createdLedger)
	if err != nil {
		return fmt.Errorf("upsert org %s: %w", treasury, err)
	}
	return nil
}

// UpsertCategory records a created category. On conflict it refreshes name/cap/
// active but preserves the accumulated spent total.
func (d *DB) UpsertCategory(ctx context.Context, treasury string, categoryID int64, name, cap string, active bool) error {
	_, err := d.pool.Exec(ctx, `
		INSERT INTO categories (treasury_address, category_id, name, cap, spent, active)
		VALUES ($1, $2, $3, $4::numeric, 0, $5)
		ON CONFLICT (treasury_address, category_id) DO UPDATE
		SET name = COALESCE(NULLIF(EXCLUDED.name, ''), categories.name),
		    cap = EXCLUDED.cap,
		    active = EXCLUDED.active
	`, treasury, categoryID, name, cap, active)
	if err != nil {
		return fmt.Errorf("upsert category %s/%d: %w", treasury, categoryID, err)
	}
	return nil
}

// UpdateCategoryCap changes only the spending cap.
func (d *DB) UpdateCategoryCap(ctx context.Context, treasury string, categoryID int64, cap string) error {
	_, err := d.pool.Exec(ctx, `
		UPDATE categories SET cap = $3::numeric
		WHERE treasury_address = $1 AND category_id = $2
	`, treasury, categoryID, cap)
	if err != nil {
		return fmt.Errorf("update category cap %s/%d: %w", treasury, categoryID, err)
	}
	return nil
}

// SetCategoryActive toggles a category's active flag.
func (d *DB) SetCategoryActive(ctx context.Context, treasury string, categoryID int64, active bool) error {
	_, err := d.pool.Exec(ctx, `
		UPDATE categories SET active = $3
		WHERE treasury_address = $1 AND category_id = $2
	`, treasury, categoryID, active)
	if err != nil {
		return fmt.Errorf("set category active %s/%d: %w", treasury, categoryID, err)
	}
	return nil
}

// IncrementCategorySpent adds an executed request's amount to a category's spent
// total. amount is a decimal string.
func (d *DB) IncrementCategorySpent(ctx context.Context, treasury string, categoryID int64, amount string) error {
	_, err := d.pool.Exec(ctx, `
		UPDATE categories SET spent = spent + $3::numeric
		WHERE treasury_address = $1 AND category_id = $2
	`, treasury, categoryID, amount)
	if err != nil {
		return fmt.Errorf("increment category spent %s/%d: %w", treasury, categoryID, err)
	}
	return nil
}

// UpsertRequest records a submitted request in the Pending state. On conflict it
// leaves the row untouched (later status transitions own the status column).
func (d *DB) UpsertRequest(ctx context.Context, treasury string, requestID, categoryID int64, recipient, amount, memo, requester string, createdLedger int64) error {
	_, err := d.pool.Exec(ctx, `
		INSERT INTO requests (treasury_address, request_id, category_id, recipient, amount, memo, requester, status, created_ledger)
		VALUES ($1, $2, $3, $4, $5::numeric, $6, $7, 'Pending', $8)
		ON CONFLICT (treasury_address, request_id) DO NOTHING
	`, treasury, requestID, categoryID, recipient, amount, memo, requester, createdLedger)
	if err != nil {
		return fmt.Errorf("upsert request %s/%d: %w", treasury, requestID, err)
	}
	return nil
}

// SetRequestStatus transitions a request to a terminal status.
func (d *DB) SetRequestStatus(ctx context.Context, treasury string, requestID int64, status string) error {
	_, err := d.pool.Exec(ctx, `
		UPDATE requests SET status = $3
		WHERE treasury_address = $1 AND request_id = $2
	`, treasury, requestID, status)
	if err != nil {
		return fmt.Errorf("set request status %s/%d: %w", treasury, requestID, err)
	}
	return nil
}

// RequestAmount returns a request's amount (decimal string) and category id,
// used when folding an execution into the category's spent total. ok is false
// when the request has not been indexed yet.
func (d *DB) RequestAmount(ctx context.Context, treasury string, requestID int64) (amount string, categoryID int64, ok bool, err error) {
	row := d.pool.QueryRow(ctx, `
		SELECT amount::text, category_id FROM requests
		WHERE treasury_address = $1 AND request_id = $2
	`, treasury, requestID)
	scanErr := row.Scan(&amount, &categoryID)
	if errors.Is(scanErr, pgx.ErrNoRows) {
		return "", 0, false, nil
	}
	if scanErr != nil {
		return "", 0, false, fmt.Errorf("read request amount %s/%d: %w", treasury, requestID, scanErr)
	}
	return amount, categoryID, true, nil
}

// AddApproval records an approver's approval of a request. Idempotent.
func (d *DB) AddApproval(ctx context.Context, treasury string, requestID int64, approver string, approvedLedger int64) error {
	_, err := d.pool.Exec(ctx, `
		INSERT INTO approvals (treasury_address, request_id, approver, approved_ledger)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (treasury_address, request_id, approver) DO NOTHING
	`, treasury, requestID, approver, approvedLedger)
	if err != nil {
		return fmt.Errorf("add approval %s/%d/%s: %w", treasury, requestID, approver, err)
	}
	return nil
}
