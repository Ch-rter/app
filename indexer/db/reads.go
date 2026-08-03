// Read queries backing the REST API.
//
// These return view structs whose amount fields are decimal strings, matching
// the NUMERIC(30, 0) storage exactly. The API marshals them straight to JSON,
// so amounts reach the frontend as strings and never pass through a float.
package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// OrgView is an organization as served to the frontend. TreasuryAddress is the
// identity the UI selects an org by.
type OrgView struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	TreasuryAddress string `json:"treasuryAddress"`
	AdminAddress    string `json:"adminAddress"`
	CreatedLedger   int64  `json:"createdLedger"`
}

// CategoryView is a budget category. Cap and Spent are decimal strings.
type CategoryView struct {
	CategoryID int64  `json:"categoryId"`
	Name       string `json:"name"`
	Cap        string `json:"cap"`
	Spent      string `json:"spent"`
	Active     bool   `json:"active"`
}

// RequestView is a disbursement request with its current approvals. Amount is a
// decimal string.
type RequestView struct {
	RequestID     int64    `json:"requestId"`
	CategoryID    int64    `json:"categoryId"`
	Recipient     string   `json:"recipient"`
	Amount        string   `json:"amount"`
	Memo          string   `json:"memo"`
	Requester     string   `json:"requester"`
	Status        string   `json:"status"`
	CreatedLedger int64    `json:"createdLedger"`
	Approvals     []string `json:"approvals"`
}

// ErrNotFound is returned when a requested resource has not been indexed.
var ErrNotFound = errors.New("not found")

// ListOrgs returns every indexed organization, newest first.
func (d *DB) ListOrgs(ctx context.Context) ([]OrgView, error) {
	rows, err := d.pool.Query(ctx, `
		SELECT id, name, treasury_address, admin_address, created_ledger
		FROM orgs
		ORDER BY created_ledger DESC, id DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list orgs: %w", err)
	}
	defer rows.Close()

	orgs := make([]OrgView, 0)
	for rows.Next() {
		var o OrgView
		if err := rows.Scan(&o.ID, &o.Name, &o.TreasuryAddress, &o.AdminAddress, &o.CreatedLedger); err != nil {
			return nil, fmt.Errorf("scan org: %w", err)
		}
		orgs = append(orgs, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate orgs: %w", err)
	}
	return orgs, nil
}

// GetOrg returns a single organization by its treasury address.
func (d *DB) GetOrg(ctx context.Context, treasury string) (OrgView, error) {
	var o OrgView
	err := d.pool.QueryRow(ctx, `
		SELECT id, name, treasury_address, admin_address, created_ledger
		FROM orgs WHERE treasury_address = $1
	`, treasury).Scan(&o.ID, &o.Name, &o.TreasuryAddress, &o.AdminAddress, &o.CreatedLedger)
	if errors.Is(err, pgx.ErrNoRows) {
		return OrgView{}, ErrNotFound
	}
	if err != nil {
		return OrgView{}, fmt.Errorf("get org %s: %w", treasury, err)
	}
	return o, nil
}

// ListCategories returns a treasury's categories in id order. Amounts are
// rendered as decimal strings via ::text so no precision is lost.
func (d *DB) ListCategories(ctx context.Context, treasury string) ([]CategoryView, error) {
	rows, err := d.pool.Query(ctx, `
		SELECT category_id, name, cap::text, spent::text, active
		FROM categories WHERE treasury_address = $1
		ORDER BY category_id
	`, treasury)
	if err != nil {
		return nil, fmt.Errorf("list categories %s: %w", treasury, err)
	}
	defer rows.Close()

	categories := make([]CategoryView, 0)
	for rows.Next() {
		var c CategoryView
		if err := rows.Scan(&c.CategoryID, &c.Name, &c.Cap, &c.Spent, &c.Active); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		categories = append(categories, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate categories: %w", err)
	}
	return categories, nil
}

// ListRequests returns a treasury's requests, newest first, each with its
// approver list. An optional status filter narrows to one lifecycle state.
func (d *DB) ListRequests(ctx context.Context, treasury, status string) ([]RequestView, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if status == "" {
		rows, err = d.pool.Query(ctx, `
			SELECT request_id, category_id, recipient, amount::text, memo, requester, status, created_ledger
			FROM requests WHERE treasury_address = $1
			ORDER BY request_id DESC
		`, treasury)
	} else {
		rows, err = d.pool.Query(ctx, `
			SELECT request_id, category_id, recipient, amount::text, memo, requester, status, created_ledger
			FROM requests WHERE treasury_address = $1 AND status = $2
			ORDER BY request_id DESC
		`, treasury, status)
	}
	if err != nil {
		return nil, fmt.Errorf("list requests %s: %w", treasury, err)
	}
	defer rows.Close()

	requests := make([]RequestView, 0)
	for rows.Next() {
		var r RequestView
		var memo *string
		if err := rows.Scan(&r.RequestID, &r.CategoryID, &r.Recipient, &r.Amount, &memo, &r.Requester, &r.Status, &r.CreatedLedger); err != nil {
			return nil, fmt.Errorf("scan request: %w", err)
		}
		if memo != nil {
			r.Memo = *memo
		}
		r.Approvals = []string{}
		requests = append(requests, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate requests: %w", err)
	}

	if err := d.attachApprovals(ctx, treasury, requests); err != nil {
		return nil, err
	}
	return requests, nil
}

// GetRequest returns one request by id, with its approvals.
func (d *DB) GetRequest(ctx context.Context, treasury string, requestID int64) (RequestView, error) {
	var r RequestView
	var memo *string
	err := d.pool.QueryRow(ctx, `
		SELECT request_id, category_id, recipient, amount::text, memo, requester, status, created_ledger
		FROM requests WHERE treasury_address = $1 AND request_id = $2
	`, treasury, requestID).Scan(&r.RequestID, &r.CategoryID, &r.Recipient, &r.Amount, &memo, &r.Requester, &r.Status, &r.CreatedLedger)
	if errors.Is(err, pgx.ErrNoRows) {
		return RequestView{}, ErrNotFound
	}
	if err != nil {
		return RequestView{}, fmt.Errorf("get request %s/%d: %w", treasury, requestID, err)
	}
	if memo != nil {
		r.Memo = *memo
	}
	approvals, err := d.approvalsFor(ctx, treasury, requestID)
	if err != nil {
		return RequestView{}, err
	}
	r.Approvals = approvals
	return r, nil
}

// attachApprovals fills the Approvals field on each request in one query,
// avoiding an N+1 across the list. Requests with no approvals keep their empty
// (non-nil) slice so the JSON is always an array.
func (d *DB) attachApprovals(ctx context.Context, treasury string, requests []RequestView) error {
	if len(requests) == 0 {
		return nil
	}
	ids := make([]int64, len(requests))
	index := make(map[int64]int, len(requests))
	for i, r := range requests {
		ids[i] = r.RequestID
		index[r.RequestID] = i
	}

	rows, err := d.pool.Query(ctx, `
		SELECT request_id, approver FROM approvals
		WHERE treasury_address = $1 AND request_id = ANY($2)
		ORDER BY approved_ledger, approver
	`, treasury, ids)
	if err != nil {
		return fmt.Errorf("load approvals %s: %w", treasury, err)
	}
	defer rows.Close()

	for rows.Next() {
		var requestID int64
		var approver string
		if err := rows.Scan(&requestID, &approver); err != nil {
			return fmt.Errorf("scan approval: %w", err)
		}
		if i, ok := index[requestID]; ok {
			requests[i].Approvals = append(requests[i].Approvals, approver)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate approvals: %w", err)
	}
	return nil
}

// approvalsFor returns the approver list for a single request in approval order.
func (d *DB) approvalsFor(ctx context.Context, treasury string, requestID int64) ([]string, error) {
	rows, err := d.pool.Query(ctx, `
		SELECT approver FROM approvals
		WHERE treasury_address = $1 AND request_id = $2
		ORDER BY approved_ledger, approver
	`, treasury, requestID)
	if err != nil {
		return nil, fmt.Errorf("load approvals %s/%d: %w", treasury, requestID, err)
	}
	defer rows.Close()

	approvals := make([]string, 0)
	for rows.Next() {
		var approver string
		if err := rows.Scan(&approver); err != nil {
			return nil, fmt.Errorf("scan approver: %w", err)
		}
		approvals = append(approvals, approver)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate approvers: %w", err)
	}
	return approvals, nil
}
