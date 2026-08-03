// Package api serves the Charter read models over a small REST surface.
//
// Every handler is read-only: the frontend reads org/category/request state
// from here but never writes, so there are no mutating endpoints. All state
// changes go through Soroban via the user's wallet.
//
// Routes:
//
//	GET /health            — liveness + database reachability
//	GET /orgs              — every indexed organization, newest first
//	GET /orgs/{treasury}   — one organization by treasury address
//	GET /orgs/{treasury}/categories — that treasury's budget categories
//	GET /orgs/{treasury}/requests[?status=] — that treasury's requests
//	GET /orgs/{treasury}/requests/{id}      — one request with approvals
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/Ch-rter/app/indexer/db"
)

// API holds the dependencies shared by every handler.
type API struct {
	db  *db.DB
	log *slog.Logger
}

// NewRouter builds the HTTP handler for the read API. CORS is permissive for
// reads because the data served is public on-chain state; there is nothing to
// protect and no cookies or credentials are ever involved.
func NewRouter(database *db.DB, logger *slog.Logger) http.Handler {
	a := &API{db: database, log: logger}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", a.handleHealth)
	mux.HandleFunc("GET /orgs", a.handleListOrgs)
	mux.HandleFunc("GET /orgs/{treasury}", a.handleGetOrg)
	mux.HandleFunc("GET /orgs/{treasury}/categories", a.handleListCategories)
	mux.HandleFunc("GET /orgs/{treasury}/requests", a.handleListRequests)
	mux.HandleFunc("GET /orgs/{treasury}/requests/{requestId}", a.handleGetRequest)

	return withCORS(mux)
}

// -- Health ------------------------------------------------------------------

// handleHealth reports liveness plus database reachability, so a load balancer
// or deploy check can distinguish "process up" from "process up but DB down".
func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := a.db.Ping(r.Context()); err != nil {
		a.log.Error("health check: database unreachable", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "database": "unreachable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// -- Orgs --------------------------------------------------------------------

func (a *API) handleListOrgs(w http.ResponseWriter, r *http.Request) {
	orgs, err := a.db.ListOrgs(r.Context())
	if err != nil {
		a.internalError(w, "list orgs", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"orgs": orgs})
}

func (a *API) handleGetOrg(w http.ResponseWriter, r *http.Request) {
	treasury := r.PathValue("treasury")
	org, err := a.db.GetOrg(r.Context(), treasury)
	if errors.Is(err, db.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "organization not found"})
		return
	}
	if err != nil {
		a.internalError(w, "get org", err)
		return
	}
	writeJSON(w, http.StatusOK, org)
}

// -- Categories --------------------------------------------------------------

func (a *API) handleListCategories(w http.ResponseWriter, r *http.Request) {
	treasury := r.PathValue("treasury")
	categories, err := a.db.ListCategories(r.Context(), treasury)
	if err != nil {
		a.internalError(w, "list categories", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"categories": categories})
}

// -- Requests ----------------------------------------------------------------

// validStatuses is the closed set of request lifecycle states the API accepts
// as a query filter.
var validStatuses = map[string]bool{
	"Pending": true, "Executed": true, "Rejected": true, "Cancelled": true,
}

func (a *API) handleListRequests(w http.ResponseWriter, r *http.Request) {
	treasury := r.PathValue("treasury")
	status := r.URL.Query().Get("status")
	if status != "" && !validStatuses[status] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status filter"})
		return
	}

	requests, err := a.db.ListRequests(r.Context(), treasury, status)
	if err != nil {
		a.internalError(w, "list requests", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"requests": requests})
}

func (a *API) handleGetRequest(w http.ResponseWriter, r *http.Request) {
	treasury := r.PathValue("treasury")
	requestID, err := strconv.ParseInt(r.PathValue("requestId"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request id"})
		return
	}

	request, err := a.db.GetRequest(r.Context(), treasury, requestID)
	if errors.Is(err, db.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "request not found"})
		return
	}
	if err != nil {
		a.internalError(w, "get request", err)
		return
	}
	writeJSON(w, http.StatusOK, request)
}

// -- Plumbing ----------------------------------------------------------------

// internalError logs the full error with structured fields and returns a
// generic 500 body, so internal details never leak to the client.
func (a *API) internalError(w http.ResponseWriter, op string, err error) {
	a.log.Error("request failed", "op", op, "err", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}

// withCORS allows browser reads from any origin. Only safe methods are exposed.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// writeJSON writes v as a JSON response with the given status. A marshalling
// failure is logged and downgraded to a 500 so a handler never panics on write.
func writeJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		http.Error(w, `{"error":"internal encoding error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}
