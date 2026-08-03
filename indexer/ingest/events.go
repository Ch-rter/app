// Package ingest polls Soroban RPC for contract events and folds them into the
// indexer's read-model tables.
//
// Design:
//   - The raw event log (charter_events) is the source of truth. Every event is
//     stored verbatim before any fold runs, and InsertEvent dedupes on the RPC
//     paging token, so the loop is safe to re-run over an overlapping range.
//   - Read-model folds are best-effort projections of the raw log. Each fold
//     reads named fields defensively from the decoded event body and skips
//     quietly when a field is absent, so a single unexpected event shape can
//     never wedge ingestion — the raw log still captured it and a projection
//     can be rebuilt later.
//
// Amounts (contract i128) are carried as decimal strings end to end; they are
// never parsed into float64.
package ingest

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"time"

	"github.com/Ch-rter/app/indexer/db"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/xdr"
)

// Event type symbols, matched against the first event topic. Kept in one place
// so the fold switch and any future filtering stay in sync.
const (
	evtTreasuryDeployed  = "treasury_deployed"
	evtCategoryCreated   = "category_created"
	evtCategoryCapUpdate = "category_cap_updated"
	evtCategoryActiveSet = "category_active_set"
	evtRequestSubmitted  = "request_submitted"
	evtRequestApproved   = "request_approved"
	evtRequestExecuted   = "request_executed"
	evtRequestRejected   = "request_rejected"
	evtRequestCancelled  = "request_cancelled"
)

// Ingester owns one polling loop.
type Ingester struct {
	db        *db.DB
	rpc       *RPCClient
	factoryID string
	log       *slog.Logger
}

// New builds an Ingester. factoryID is the contract the watch list bootstraps
// from; it is registered as a watched contract on the first poll.
func New(database *db.DB, rpc *RPCClient, factoryID string, log *slog.Logger) *Ingester {
	return &Ingester{db: database, rpc: rpc, factoryID: factoryID, log: log}
}

// Run polls on the given interval until ctx is cancelled. A failed poll is
// logged and retried on the next tick rather than aborting the loop, so a
// transient RPC error does not take ingestion down.
func (in *Ingester) Run(ctx context.Context, interval time.Duration) error {
	if err := in.db.AddWatchedContract(ctx, in.factoryID, "factory"); err != nil {
		return fmt.Errorf("register factory contract: %w", err)
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	in.log.Info("ingestion loop started", "interval", interval.String(), "factory", in.factoryID)

	// Poll once immediately so a fresh process does not idle for a full interval.
	if err := in.poll(ctx); err != nil {
		in.log.Error("initial poll failed", "err", err)
	}

	for {
		select {
		case <-ctx.Done():
			in.log.Info("ingestion loop stopping", "reason", ctx.Err())
			return nil
		case <-ticker.C:
			if err := in.poll(ctx); err != nil {
				in.log.Error("poll failed", "err", err)
			}
		}
	}
}

// poll fetches events since the cursor for every watched contract and folds
// them, advancing the cursor to the latest ledger the RPC has seen.
func (in *Ingester) poll(ctx context.Context) error {
	cursor, err := in.db.GetCursor(ctx)
	if err != nil {
		return err
	}

	watched, err := in.db.ListWatchedContracts(ctx)
	if err != nil {
		return err
	}
	contractIDs := make([]string, 0, len(watched))
	for _, w := range watched {
		contractIDs = append(contractIDs, w.ContractID)
	}

	// On a cold start (no cursor) begin from the RPC's latest ledger so the loop
	// tracks live activity instead of failing against the retention window.
	startLedger := cursor + 1
	if cursor == 0 {
		latest, err := in.rpc.LatestLedger(ctx)
		if err != nil {
			return err
		}
		startLedger = latest
	}

	page, err := in.rpc.GetEvents(ctx, startLedger, contractIDs)
	if err != nil {
		return err
	}

	for i := range page.Events {
		if err := in.handleEvent(ctx, &page.Events[i]); err != nil {
			// Fold errors are non-fatal: the raw event is already persisted, so we
			// log and continue rather than stalling the whole batch.
			in.log.Error("fold event failed",
				"paging_token", page.Events[i].ID,
				"type", page.Events[i].EventType(),
				"err", err)
		}
	}

	if page.LatestLedger > cursor {
		if err := in.db.SetCursor(ctx, page.LatestLedger); err != nil {
			return err
		}
	}

	if len(page.Events) > 0 {
		in.log.Info("ingested events", "count", len(page.Events), "latest_ledger", page.LatestLedger)
	}
	return nil
}

// handleEvent stores the raw event, then dispatches on its type. Folds only run
// for first-seen events so replays never double-count spend totals.
func (in *Ingester) handleEvent(ctx context.Context, ev *RPCEvent) error {
	body, err := ev.decode()
	if err != nil {
		return fmt.Errorf("decode event %s: %w", ev.ID, err)
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal event payload %s: %w", ev.ID, err)
	}

	fresh, err := in.db.InsertEvent(ctx, db.Event{
		ContractID:  ev.ContractID,
		EventType:   body.Type,
		Ledger:      ev.Ledger,
		TxHash:      ev.TxHash,
		PagingToken: ev.ID,
		Payload:     payload,
	})
	if err != nil {
		return err
	}
	if !fresh {
		return nil
	}

	return in.fold(ctx, ev, body)
}

// fold projects a first-seen event into the read models.
func (in *Ingester) fold(ctx context.Context, ev *RPCEvent, body *eventBody) error {
	v := body.fields()
	switch body.Type {
	case evtTreasuryDeployed:
		treasury := v.str("treasury")
		if treasury == "" {
			return nil
		}
		if err := in.db.UpsertOrg(ctx, v.str("name"), treasury, v.str("admin"), ev.Ledger); err != nil {
			return err
		}
		// Newly deployed treasuries join the watch list so their own events are
		// picked up from the next poll onward.
		return in.db.AddWatchedContract(ctx, treasury, "treasury")

	case evtCategoryCreated:
		return in.db.UpsertCategory(ctx, ev.ContractID, v.int("category_id"), v.str("name"), v.amount("cap"), v.boolean("active", true))

	case evtCategoryCapUpdate:
		return in.db.UpdateCategoryCap(ctx, ev.ContractID, v.int("category_id"), v.amount("cap"))

	case evtCategoryActiveSet:
		return in.db.SetCategoryActive(ctx, ev.ContractID, v.int("category_id"), v.boolean("active", false))

	case evtRequestSubmitted:
		return in.db.UpsertRequest(ctx, ev.ContractID, v.int("request_id"), v.int("category_id"),
			v.str("recipient"), v.amount("amount"), v.str("memo"), v.str("requester"), ev.Ledger)

	case evtRequestApproved:
		return in.db.AddApproval(ctx, ev.ContractID, v.int("request_id"), v.str("approver"), ev.Ledger)

	case evtRequestExecuted:
		return in.foldExecuted(ctx, ev.ContractID, v.int("request_id"))

	case evtRequestRejected:
		return in.db.SetRequestStatus(ctx, ev.ContractID, v.int("request_id"), "Rejected")

	case evtRequestCancelled:
		return in.db.SetRequestStatus(ctx, ev.ContractID, v.int("request_id"), "Cancelled")

	default:
		// Unknown event: already captured in the raw log, nothing to project.
		return nil
	}
}

// foldExecuted marks a request Executed and adds its amount to the owning
// category's spent total, using the amount already recorded at submission time.
func (in *Ingester) foldExecuted(ctx context.Context, treasury string, requestID int64) error {
	if err := in.db.SetRequestStatus(ctx, treasury, requestID, "Executed"); err != nil {
		return err
	}
	amount, categoryID, ok, err := in.db.RequestAmount(ctx, treasury, requestID)
	if err != nil {
		return err
	}
	if !ok {
		in.log.Warn("executed request not yet indexed; spent total not updated",
			"treasury", treasury, "request_id", requestID)
		return nil
	}
	return in.db.IncrementCategorySpent(ctx, treasury, categoryID, amount)
}

// -- Decoded event body ------------------------------------------------------

// eventBody is the decoded form of a contract event: the type (first topic) and
// the decoded value. Stored as the raw payload and read by the folds.
type eventBody struct {
	Type   string        `json:"type"`
	Topics []any         `json:"topics"`
	Value  any           `json:"value"`
	fieldM map[string]any `json:"-"`
}

// fields returns the event's value as a keyed accessor. Charter events carry
// their data as an ScMap, so the decoded value is a map[string]any; a non-map
// value yields an accessor over an empty map (every lookup returns a zero).
func (b *eventBody) fields() fieldView {
	if b.fieldM == nil {
		if m, ok := b.Value.(map[string]any); ok {
			b.fieldM = m
		} else {
			b.fieldM = map[string]any{}
		}
	}
	return fieldView{b.fieldM}
}

// fieldView reads typed values out of a decoded event map, defaulting on any
// missing or mistyped field so a fold never panics on an unexpected shape.
type fieldView struct{ m map[string]any }

func (f fieldView) str(key string) string {
	if s, ok := f.m[key].(string); ok {
		return s
	}
	return ""
}

// int reads an integer field. Integers decode to strings (u64/i128) or JSON
// numbers depending on width, so both are accepted.
func (f fieldView) int(key string) int64 {
	switch v := f.m[key].(type) {
	case string:
		if n, ok := new(big.Int).SetString(v, 10); ok {
			return n.Int64()
		}
	case float64:
		return int64(v)
	case json.Number:
		if n, err := v.Int64(); err == nil {
			return n
		}
	}
	return 0
}

// amount reads a wide integer field as a decimal string, preserving the full
// i128 range. Missing fields become "0".
func (f fieldView) amount(key string) string {
	switch v := f.m[key].(type) {
	case string:
		if _, ok := new(big.Int).SetString(v, 10); ok {
			return v
		}
	case float64:
		return new(big.Int).SetInt64(int64(v)).String()
	case json.Number:
		return v.String()
	}
	return "0"
}

func (f fieldView) boolean(key string, def bool) bool {
	if b, ok := f.m[key].(bool); ok {
		return b
	}
	return def
}

// -- Soroban RPC client ------------------------------------------------------

// RPCClient is a minimal Soroban JSON-RPC client over net/http.
type RPCClient struct {
	url    string
	http   *http.Client
	nextID int
}

// NewRPCClient builds a client against the given Soroban RPC endpoint.
func NewRPCClient(url string) *RPCClient {
	return &RPCClient{url: url, http: &http.Client{Timeout: 30 * time.Second}}
}

type jsonRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *jsonRPCError) Error() string {
	return fmt.Sprintf("rpc error %d: %s", e.Code, e.Message)
}

// call issues one JSON-RPC request and unmarshals the result into out.
func (c *RPCClient) call(ctx context.Context, method string, params any, out any) error {
	c.nextID++
	reqBody, err := json.Marshal(jsonRPCRequest{JSONRPC: "2.0", ID: c.nextID, Method: method, Params: params})
	if err != nil {
		return fmt.Errorf("marshal %s request: %w", method, err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("build %s request: %w", method, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return fmt.Errorf("%s request: %w", method, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: unexpected HTTP status %d", method, resp.StatusCode)
	}

	var envelope struct {
		Result json.RawMessage `json:"result"`
		Error  *jsonRPCError   `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return fmt.Errorf("decode %s response: %w", method, err)
	}
	if envelope.Error != nil {
		return fmt.Errorf("%s: %w", method, envelope.Error)
	}
	if out != nil {
		if err := json.Unmarshal(envelope.Result, out); err != nil {
			return fmt.Errorf("decode %s result: %w", method, err)
		}
	}
	return nil
}

// LatestLedger returns the sequence number of the most recent closed ledger.
func (c *RPCClient) LatestLedger(ctx context.Context) (int64, error) {
	var result struct {
		Sequence int64 `json:"sequence"`
	}
	if err := c.call(ctx, "getLatestLedger", struct{}{}, &result); err != nil {
		return 0, err
	}
	return result.Sequence, nil
}

// EventPage is one page of getEvents results.
type EventPage struct {
	Events       []RPCEvent
	LatestLedger int64
}

// RPCEvent is a raw event as returned by getEvents. Topics and Value are
// base64-encoded XDR ScVals.
type RPCEvent struct {
	Type        string   `json:"type"`
	Ledger      int64    `json:"ledger"`
	ContractID  string   `json:"contractId"`
	ID          string   `json:"id"`
	PagingToken string   `json:"pagingToken"`
	Topic       []string `json:"topic"`
	Value       string   `json:"value"`
	TxHash      string   `json:"txHash"`
}

// GetEvents fetches contract events from startLedger for the given contracts.
// When no contracts are supplied it returns an empty page (nothing to watch).
func (c *RPCClient) GetEvents(ctx context.Context, startLedger int64, contractIDs []string) (*EventPage, error) {
	if len(contractIDs) == 0 {
		return &EventPage{}, nil
	}

	params := map[string]any{
		"startLedger": startLedger,
		"filters": []map[string]any{
			{"type": "contract", "contractIds": contractIDs},
		},
		"pagination": map[string]any{"limit": 200},
	}

	var result struct {
		Events       []RPCEvent `json:"events"`
		LatestLedger int64      `json:"latestLedger"`
	}
	if err := c.call(ctx, "getEvents", params, &result); err != nil {
		return nil, err
	}
	return &EventPage{Events: result.Events, LatestLedger: result.LatestLedger}, nil
}

// EventType decodes just the event's first topic symbol, for logging without a
// full decode.
func (ev *RPCEvent) EventType() string {
	if len(ev.Topic) == 0 {
		return ""
	}
	if s, err := decodeSymbol(ev.Topic[0]); err == nil {
		return s
	}
	return ""
}

// decode turns an RPCEvent's base64 XDR topics and value into native Go values.
func (ev *RPCEvent) decode() (*eventBody, error) {
	topics := make([]any, 0, len(ev.Topic))
	for _, t := range ev.Topic {
		native, err := decodeScValBase64(t)
		if err != nil {
			return nil, fmt.Errorf("decode topic: %w", err)
		}
		topics = append(topics, native)
	}

	value, err := decodeScValBase64(ev.Value)
	if err != nil {
		return nil, fmt.Errorf("decode value: %w", err)
	}

	eventType := ""
	if len(topics) > 0 {
		if s, ok := topics[0].(string); ok {
			eventType = s
		}
	}

	return &eventBody{Type: eventType, Topics: topics, Value: value}, nil
}

// -- XDR ScVal decoding ------------------------------------------------------

func decodeSymbol(b64 string) (string, error) {
	native, err := decodeScValBase64(b64)
	if err != nil {
		return "", err
	}
	if s, ok := native.(string); ok {
		return s, nil
	}
	return "", fmt.Errorf("topic is not a symbol")
}

// decodeScValBase64 unmarshals a base64 XDR ScVal and converts it to a native
// Go value.
func decodeScValBase64(b64 string) (any, error) {
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, fmt.Errorf("base64 decode scval: %w", err)
	}
	var val xdr.ScVal
	if err := xdr.SafeUnmarshal(raw, &val); err != nil {
		return nil, fmt.Errorf("unmarshal scval: %w", err)
	}
	return scValToNative(val)
}

// scValToNative converts an XDR ScVal into a JSON-friendly Go value. Wide
// integers become decimal strings so no precision is lost; addresses become
// their strkey form; maps become map[string]any keyed by symbol/string keys.
func scValToNative(v xdr.ScVal) (any, error) {
	switch v.Type {
	case xdr.ScValTypeScvBool:
		return v.MustB(), nil
	case xdr.ScValTypeScvVoid:
		return nil, nil
	case xdr.ScValTypeScvU32:
		return int64(v.MustU32()), nil
	case xdr.ScValTypeScvI32:
		return int64(v.MustI32()), nil
	case xdr.ScValTypeScvU64:
		return fmt.Sprintf("%d", v.MustU64()), nil
	case xdr.ScValTypeScvI64:
		return fmt.Sprintf("%d", v.MustI64()), nil
	case xdr.ScValTypeScvU128:
		return u128String(v.MustU128()), nil
	case xdr.ScValTypeScvI128:
		return i128String(v.MustI128()), nil
	case xdr.ScValTypeScvSymbol:
		return string(v.MustSym()), nil
	case xdr.ScValTypeScvString:
		return string(v.MustStr()), nil
	case xdr.ScValTypeScvBytes:
		return fmt.Sprintf("%x", []byte(v.MustBytes())), nil
	case xdr.ScValTypeScvAddress:
		return addressString(v.MustAddress())
	case xdr.ScValTypeScvVec:
		return vecToNative(derefVec(v.Vec))
	case xdr.ScValTypeScvMap:
		return mapToNative(derefMap(v.Map))
	default:
		// Any type the read models do not consume is preserved as its XDR string
		// form; the raw log keeps the exact bytes regardless.
		return v.String(), nil
	}
}

// derefVec unwraps the optional pointer stellar/go uses for ScVal.Vec.
func derefVec(v **xdr.ScVec) *xdr.ScVec {
	if v == nil {
		return nil
	}
	return *v
}

// derefMap unwraps the optional pointer stellar/go uses for ScVal.Map.
func derefMap(v **xdr.ScMap) *xdr.ScMap {
	if v == nil {
		return nil
	}
	return *v
}

func vecToNative(vec *xdr.ScVec) (any, error) {
	if vec == nil {
		return []any{}, nil
	}
	out := make([]any, 0, len(*vec))
	for _, item := range *vec {
		native, err := scValToNative(item)
		if err != nil {
			return nil, err
		}
		out = append(out, native)
	}
	return out, nil
}

func mapToNative(m *xdr.ScMap) (any, error) {
	out := map[string]any{}
	if m == nil {
		return out, nil
	}
	for _, entry := range *m {
		key, err := scValToNative(entry.Key)
		if err != nil {
			return nil, err
		}
		val, err := scValToNative(entry.Val)
		if err != nil {
			return nil, err
		}
		keyStr, ok := key.(string)
		if !ok {
			keyStr = fmt.Sprintf("%v", key)
		}
		out[keyStr] = val
	}
	return out, nil
}

func addressString(addr xdr.ScAddress) (string, error) {
	switch addr.Type {
	case xdr.ScAddressTypeScAddressTypeAccount:
		return addr.MustAccountId().Address(), nil
	case xdr.ScAddressTypeScAddressTypeContract:
		contractID := addr.MustContractId()
		return strkey.Encode(strkey.VersionByteContract, contractID[:])
	default:
		return "", fmt.Errorf("unsupported address type %s", addr.Type)
	}
}

// i128String renders a signed 128-bit integer as a decimal string.
func i128String(parts xdr.Int128Parts) string {
	hi := big.NewInt(int64(parts.Hi))
	lo := new(big.Int).SetUint64(uint64(parts.Lo))
	result := new(big.Int).Lsh(hi, 64)
	result.Add(result, lo)
	return result.String()
}

// u128String renders an unsigned 128-bit integer as a decimal string.
func u128String(parts xdr.UInt128Parts) string {
	hi := new(big.Int).SetUint64(uint64(parts.Hi))
	lo := new(big.Int).SetUint64(uint64(parts.Lo))
	result := new(big.Int).Lsh(hi, 64)
	result.Add(result, lo)
	return result.String()
}
