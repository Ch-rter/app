// Command indexer is the Charter read-side service.
//
// It continuously ingests Soroban contract events into Postgres (see
// ingest/events.go and db/queries.go) and serves the resulting read models to
// the frontend over the REST API in api/handlers.go. The frontend never writes
// here — all state changes go through Soroban via the user's wallet.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Ch-rter/app/indexer/api"
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
	port := env("PORT")

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

	// The poller that folds Soroban events into the read models, running in the
	// background so it shares the process with the API server.
	ingester := ingest.New(database, ingest.NewRPCClient(rpcURL), factoryID, logger)
	go func() {
		if err := ingester.Run(ctx, pollInterval()); err != nil {
			logger.Error("ingestion loop failed", "err", err)
			stop()
		}
	}()

	// The REST API that serves the read models to the frontend, running in the
	// foreground so the process stays alive for both.
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           api.NewRouter(database, logger),
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		logger.Info("API server listening", "port", port)
		errCh <- server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("API server failed", "err", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	}

	// Graceful shutdown: stop accepting new requests and give in-flight work a
	// moment to drain before the process exits.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("API server shutdown failed", "err", err)
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
