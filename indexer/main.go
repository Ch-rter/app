// Command indexer is the Charter read-side service.
//
// It continuously ingests Soroban contract events into Postgres (see
// ingest/events.go and db/queries.go). The REST API that serves the resulting
// read models to the frontend is wired in alongside this loop; see
// api/handlers.go. The frontend never writes here — all state changes go
// through Soroban via the user's wallet.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Ch-rter/app/indexer/db"
	"github.com/Ch-rter/app/indexer/ingest"
)

// env reads a required environment variable, failing loudly if it is missing or
// blank. Configuration mistakes surface at startup, never silently at runtime.
func env(name string) string {
	value := os.Getenv(name)
	if value == "" {
		fmt.Fprintf(os.Stderr, "missing required environment variable %s\n", name)
		os.Exit(1)
	}
	return value
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Configuration.
	databaseURL := env("DATABASE_URL")
	rpcURL := env("SOROBAN_RPC_URL")
	factoryID := env("FACTORY_CONTRACT_ID")

	// Connect to Postgres and apply the schema (idempotent).
	database, err := db.Connect(ctx, databaseURL)
	if err != nil {
		logger.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer database.Close()
	if err := database.ApplySchema(ctx); err != nil {
		logger.Error("schema apply failed", "err", err)
		os.Exit(1)
	}

	// The poller that folds Soroban events into the read models. It owns the
	// process lifetime here; the REST API server is wired in with the handlers.
	ingester := ingest.New(database, ingest.NewRPCClient(rpcURL), factoryID, logger)
	if err := ingester.Run(ctx, pollInterval()); err != nil {
		logger.Error("ingestion loop failed", "err", err)
		os.Exit(1)
	}
}

// pollInterval reads POLL_INTERVAL_SECONDS with a sane default of 5 seconds.
func pollInterval() time.Duration {
	seconds := os.Getenv("POLL_INTERVAL_SECONDS")
	if seconds == "" {
		return 5 * time.Second
	}
	d, err := time.ParseDuration(seconds + "s")
	if err != nil {
		slog.Warn("invalid POLL_INTERVAL_SECONDS, defaulting to 5s", "value", seconds)
		return 5 * time.Second
	}
	return d
}
