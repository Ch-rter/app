# Charter

Charter is a treasury operations layer for Stellar-based organizations. An
organization deploys a **treasury** contract, funds it, defines **budget
categories** with spending caps, and members raise **disbursement requests**
that execute on-chain once a threshold of approvers signs off. Every state
change is a Soroban contract call authorized by the user's own wallet — Charter
never custodies funds or keys.

This repository (`charter-app`) is the **application layer**: the client SDK, the
web app, and the read-side indexer. The contracts themselves live in a separate
repository (`charter-contract`); this app talks to them once they are deployed.

## Architecture

```
                 signs & submits tx
   Wallet  ─────────────────────────────►  Soroban  ◄──────────┐
     ▲                                     (contracts)          │ polls
     │ connect                                  │ emits events  │ getEvents
     │                                          ▼               │
  ┌──────────────┐   reads (REST)   ┌──────────────────────────┴─┐
  │  apps/web    │ ───────────────► │  indexer/ (Go + Postgres)   │
  │  (Next.js)   │                  │  read models over REST      │
  └──────┬───────┘                  └─────────────────────────────┘
         │ writes go through
         ▼
  ┌──────────────┐
  │ packages/sdk │  contract clients: simulate → prepare → sign → send → poll
  └──────────────┘
```

Two data paths, kept strictly separate:

- **Writes** flow through `packages/sdk` — the only path allowed to call
  state-changing contract methods. The SDK simulates, prepares, hands the XDR to
  the wallet to sign, submits, and polls for confirmation. The web app never
  invokes a mutating method directly.
- **Reads** flow from the indexer's REST API. The indexer folds Soroban events
  into Postgres read models and serves them; the frontend only ever reads from
  it and never writes to its database.

### The money model

Contract amounts are `i128`. They survive end to end without ever becoming a
float: the indexer stores them as `NUMERIC(30,0)`, the API returns them as
decimal **strings**, and the web app formats them with bigint-safe helpers
(`formatAmount` / `parseAmount`). Token amounts use 7 decimals (`TOKEN_DECIMALS`).

## Repository layout

| Path            | What it is                                                             |
| --------------- | --------------------------------------------------------------------- |
| `packages/sdk`  | `@charter/sdk` — factory + treasury contract clients over Soroban RPC |
| `apps/web`      | `@charter/web` — the Next.js 15 (App Router) frontend                 |
| `indexer/`      | Go service: event ingestion into Postgres + read-only REST API        |

`packages/*` and `apps/*` form an npm workspace (single root lockfile). The
indexer is a standalone Go module (`github.com/Ch-rter/app/indexer`).

## Prerequisites

- **Node.js ≥ 20** and npm
- **Go ≥ 1.26** (for the indexer)
- **PostgreSQL** reachable via `DATABASE_URL` (for the indexer)
- A Stellar wallet supported by
  [`stellar-wallets-kit`](https://github.com/Creit-Tech/Stellar-Wallets-Kit)
  (e.g. Freighter) for signing, on the network your config points at

## Local setup

From the repository root:

```bash
npm ci   # installs the workspace (sdk + web) from the committed lockfile
```

The SDK is consumed directly as TypeScript source and transpiled by Next.js —
there is no separate build step to run before starting the web app.

### 1. Indexer (Go + Postgres)

The indexer needs a Postgres database and the deployed factory contract id. A
throwaway local database with the credentials from `.env.example`:

```bash
docker run --name charter-pg -e POSTGRES_USER=charter \
  -e POSTGRES_PASSWORD=charter -e POSTGRES_DB=charter \
  -p 5432:5432 -d postgres:16
```

Then configure and run it:

```bash
cd indexer
cp .env.example .env        # then fill in FACTORY_CONTRACT_ID
# export the vars however you prefer, e.g. with a dotenv runner, then:
go run .
```

The schema is applied automatically on startup (idempotent), so there is no
separate migration step. The service ingests events in the background and serves
the REST API on `PORT` (default `8080`).

### 2. Web app (Next.js)

```bash
cd apps/web
cp .env.example .env.local   # then fill in the deployed contract id
```

Point `NEXT_PUBLIC_INDEXER_API_URL` at the indexer (`http://localhost:8080` for
local dev). From the repository root:

```bash
npm run dev:web
```

The app starts on <http://localhost:3000>. Until `charter-contract` is deployed
you can leave `NEXT_PUBLIC_FACTORY_CONTRACT_ID` blank and browse the read-only
UI; deploying a treasury or raising a request requires the real id and a funded
wallet.

## Configuration

### Web (`apps/web/.env.local`)

All web config is public (`NEXT_PUBLIC_*`), inlined at build time. There is no
localhost fallback for the indexer URL — a missing value fails loudly rather than
silently shipping to production.

| Variable                                | Purpose                                             |
| --------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`           | Soroban RPC endpoint                                |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`| Network passphrase every tx is signed against       |
| `NEXT_PUBLIC_FACTORY_CONTRACT_ID`       | Factory the new-org flow deploys treasuries through |
| `NEXT_PUBLIC_TREASURY_WASM_HASH`        | Treasury wasm hash (informational, shown in the UI) |
| `NEXT_PUBLIC_INDEXER_API_URL`           | Base URL of the indexer REST API                    |
| `NEXT_PUBLIC_READ_ONLY_SOURCE_ACCOUNT`  | Any account key used only as the source for reads   |

> Keep `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` quoted — the semicolon breaks
> unquoted shell sourcing.

### Indexer (`indexer/.env`)

| Variable                | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `DATABASE_URL`          | Postgres connection string                       |
| `SOROBAN_RPC_URL`       | Soroban RPC endpoint the poller reads events from|
| `NETWORK_PASSPHRASE`    | Network passphrase                               |
| `FACTORY_CONTRACT_ID`   | Factory the treasury watch list is bootstrapped from |
| `PORT`                  | REST API port (default `8080`)                   |
| `POLL_INTERVAL_SECONDS` | How often the ingestion loop polls (default `5`) |

## Indexer REST API

Every endpoint is read-only. Amounts are returned as decimal strings.

| Method & path                                   | Returns                                   |
| ----------------------------------------------- | ----------------------------------------- |
| `GET /health`                                   | Liveness + database reachability          |
| `GET /orgs`                                      | Every indexed organization, newest first  |
| `GET /orgs/{treasury}`                           | One organization by treasury address      |
| `GET /orgs/{treasury}/categories`                | That treasury's budget categories         |
| `GET /orgs/{treasury}/requests[?status=]`        | That treasury's requests (optional filter)|
| `GET /orgs/{treasury}/requests/{id}`             | One request with its approvals            |

The `status` filter accepts `Pending`, `Executed`, `Rejected`, or `Cancelled`.

## Scripts

Run from the repository root:

| Command                | Does                                             |
| ---------------------- | ------------------------------------------------ |
| `npm run dev:web`      | Start the web app in development                 |
| `npm run build:web`    | Production build of the web app                  |
| `npm run build:sdk`    | Type-check the SDK                               |
| `npm run typecheck`    | Type-check every workspace                       |
| `npm run lint`         | Lint every workspace                             |

Indexer (from `indexer/`): `go vet ./...`, `go build ./...`, `go run .`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request against `main`:
the web/SDK workspace is linted, type-checked, and built; the indexer is vetted
and built. The two jobs run in parallel.
