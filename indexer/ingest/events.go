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
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/Ch-rter/app/indexer/db"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/xdr"
)

// Event type symbols, matched against the first event topic. Each is the
// snake_case of its #[contractevent] struct name (the soroban-sdk default) and
// must track the struct names in
// charter-contract/contracts/{factory,treasury}/src/events.rs.
const (
	evtTreasuryDeployed  = "treasury_deployed"
	evtCategoryCreated   = "category_created"
	evtCategoryCapUpdate = "cap_updated"
	evtCategoryActiveSet = "active_changed"
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
	// tracks live activity instead of failing against the retention window. The
	// latest ledger reported by getLatestLedger can sit one or more ledgers ahead
	// of the ceiling getEvents will accept (they advance independently), so we do
	// not trust a single guess: getEventsInWindow retries with a decremented
	// startLedger until the RPC accepts it.
	startLedger := cursor + 1
	if cursor == 0 {
		latest, err := in.rpc.LatestLedger(ctx)
		if err != nil {
			return err
		}
		startLedger = latest
	}

	page, err := in.getEventsInWindow(ctx, startLedger, contractIDs)
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

// maxWindowRetries bounds how far getEventsInWindow will walk startLedger back
// when the RPC rejects it as outside the retained ledger range. A handful of
// attempts covers the small race between getLatestLedger and getEvents' ceiling
// without turning a genuinely stale cursor into a long backward scan.
const maxWindowRetries = 10

// getEventsInWindow calls getEvents, retrying with a decremented startLedger
// when the RPC rejects the ledger as outside its retained window. Only that
// specific error is retried; any other error, exhausting the retry budget, or
// reaching ledger 1 returns the error unchanged so the caller can log it and
// try again next tick.
func (in *Ingester) getEventsInWindow(ctx context.Context, startLedger int64, contractIDs []string) (*EventPage, error) {
	for attempt := 0; ; attempt++ {
		page, err := in.rpc.GetEvents(ctx, startLedger, contractIDs)
		if err == nil {
			return page, nil
		}
		if !isLedgerWindowError(err) || attempt >= maxWindowRetries || startLedger <= 1 {
			return nil, err
		}
		in.log.Warn("getEvents startLedger outside window; retrying lower",
			"start_ledger", startLedger, "attempt", attempt+1)
		startLedger--
	}
}

// isLedgerWindowError reports whether err is the RPC's "startLedger outside the
// retained range" rejection, the one case getEventsInWindow retries.
func isLedgerWindowError(err error) bool {
	var rpcErr *jsonRPCError
	if errors.As(err, &rpcErr) {
		return strings.Contains(rpcErr.Message, "must be within the ledger range")
	}
	return false
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
//
// Charter's contract events are emitted with #[contractevent(data_format =
// "vec" | "single-value")], never "map", so their layout is positional, not
// keyed:
//   - Topics[0] is the event-name symbol; each #[topic] field follows in
//     declaration order, so topicArg(0) == Topics[1].
//   - A "vec" event carries its non-topic fields as an ordered vec in Value,
//     read by declaration order via vecArg(i).
//   - A "single-value" event carries its one non-topic field as the bare Value
//     scalar, read via singleValue().
//
// Each case documents the exact on-chain field order it depends on. That order
// lives in charter-contract/contracts/{factory,treasury}/src/events.rs and this
// switch is fragile to reordering a struct's fields or changing its
// data_format there.
func (in *Ingester) fold(ctx context.Context, ev *RPCEvent, body *eventBody) error {
	switch body.Type {
	case evtTreasuryDeployed:
		// TreasuryDeployed (vec): topic[0]=org_id(u32);
		// value=[name(String), treasury(Address), admin(Address)].
		treasury := asStr(body.vecArg(1))
		if treasury == "" {
			return nil
		}
		if err := in.db.UpsertOrg(ctx, asStr(body.vecArg(0)), treasury, asStr(body.vecArg(2)), ev.Ledger); err != nil {
			return err
		}
		// Newly deployed treasuries join the watch list so their own events are
		// picked up from the next poll onward.
		return in.db.AddWatchedContract(ctx, treasury, "treasury")

	case evtCategoryCreated:
		// CategoryCreated (vec): topic[0]=category_id(u32);
		// value=[name(String), cap(i128)]. A new category is active.
		return in.db.UpsertCategory(ctx, ev.ContractID, asInt(body.topicArg(0)),
			asStr(body.vecArg(0)), asAmount(body.vecArg(1)), true)

	case evtCategoryCapUpdate:
		// CapUpdated (single-value): topic[0]=category_id(u32); value=new_cap(i128).
		return in.db.UpdateCategoryCap(ctx, ev.ContractID, asInt(body.topicArg(0)), asAmount(body.singleValue()))

	case evtCategoryActiveSet:
		// ActiveChanged (single-value): topic[0]=category_id(u32); value=active(bool).
		return in.db.SetCategoryActive(ctx, ev.ContractID, asInt(body.topicArg(0)), asBool(body.singleValue(), false))

	case evtRequestSubmitted:
		// RequestSubmitted (vec): topic[0]=request_id(u32);
		// value=[category_id(u32), recipient(Address), amount(i128)]. The event
		// carries no memo or requester, so those columns are left empty.
		return in.db.UpsertRequest(ctx, ev.ContractID, asInt(body.topicArg(0)), asInt(body.vecArg(0)),
			asStr(body.vecArg(1)), asAmount(body.vecArg(2)), "", "", ev.Ledger)

	case evtRequestApproved:
		// RequestApproved (single-value): topic[0]=request_id(u32); value=approver(Address).
		return in.db.AddApproval(ctx, ev.ContractID, asInt(body.topicArg(0)), asStr(body.singleValue()), ev.Ledger)

	case evtRequestExecuted:
		// RequestExecuted (vec): topic[0]=request_id(u32);
		// value=[recipient(Address), amount(i128)]. The spent total is taken from
		// the amount stored at submission, so only request_id is needed here.
		return in.foldExecuted(ctx, ev.ContractID, asInt(body.topicArg(0)))

	case evtRequestRejected:
		// RequestRejected (single-value): topic[0]=request_id(u32);
		// value=approver(Address), not needed here.
		return in.db.SetRequestStatus(ctx, ev.ContractID, asInt(body.topicArg(0)), "Rejected")

	case evtRequestCancelled:
		// RequestCancelled (single-value): topic[0]=request_id(u32); no data fields.
		return in.db.SetRequestStatus(ctx, ev.ContractID, asInt(body.topicArg(0)), "Cancelled")

	default:
		// Unknown or unprojected event (e.g. deposited, which has no read model):
		// already captured in the raw log, nothing to project.
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

// eventBody is the decoded form of a contract event: the event-name symbol
// (first topic), the full decoded topic list, and the decoded data value.
// Stored as the raw payload and read positionally by the folds.
type eventBody struct {
	Type   string `json:"type"`
	Topics []any  `json:"topics"`
	Value  any    `json:"value"`
}

// topicArg returns the i-th #[topic] field of the event: the topic after the
// event-name symbol, so topicArg(0) == Topics[1]. Returns nil if absent.
func (b *eventBody) topicArg(i int) any {
	idx := i + 1
	if idx < 0 || idx >= len(b.Topics) {
		return nil
	}
	return b.Topics[idx]
}

// vecArg returns the i-th element of a data_format="vec" event's value, or nil
// if the value is not a vec or the index is out of range.
func (b *eventBody) vecArg(i int) any {
	vec, ok := b.Value.([]any)
	if !ok || i < 0 || i >= len(vec) {
		return nil
	}
	return vec[i]
}

// singleValue returns a data_format="single-value" event's payload: the bare
// data scalar, emitted directly rather than wrapped in a vec.
func (b *eventBody) singleValue() any {
	return b.Value
}

// asStr reads a decoded ScVal as a string. Symbols, strings, and strkey-encoded
// addresses all decode to Go strings; anything else yields "".
func asStr(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// asInt reads a decoded ScVal as an int64. Narrow integers (u32/i32) decode to
// int64; wide integers (u64/i128) decode to decimal strings; a JSON round-trip
// of the stored payload can yield float64/json.Number. All are accepted;
// anything else is 0.
func asInt(v any) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case int:
		return int64(n)
	case float64:
		return int64(n)
	case json.Number:
		if x, err := n.Int64(); err == nil {
			return x
		}
	case string:
		if x, ok := new(big.Int).SetString(n, 10); ok {
			return x.Int64()
		}
	}
	return 0
}

// asAmount reads a decoded ScVal as a decimal string, preserving the full i128
// range (wide integers already decode to strings). Missing/other values are "0".
func asAmount(v any) string {
	switch n := v.(type) {
	case string:
		if _, ok := new(big.Int).SetString(n, 10); ok {
			return n
		}
	case int64:
		return big.NewInt(n).String()
	case int:
		return big.NewInt(int64(n)).String()
	case float64:
		return big.NewInt(int64(n)).String()
	case json.Number:
		return n.String()
	}
	return "0"
}

// asBool reads a decoded ScVal as a bool, falling back to def.
func asBool(v any, def bool) bool {
	if b, ok := v.(bool); ok {
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
