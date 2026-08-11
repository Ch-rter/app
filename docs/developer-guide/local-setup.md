# Local Setup

This page gets the Charter application layer running on your machine: the web
app, the SDK it depends on, and the indexer that feeds it read data. It mirrors
the repository's own quick start; where this page and the repo `README` differ,
the `README` is the source of truth.

The three parts live in the [`Ch-rter/app`](https://github.com/Ch-rter/app)
repository. The contracts they talk to live separately in
[`Ch-rter/contract`](https://github.com/Ch-rter/contract).

## Prerequisites

- **Node.js ≥ 20** and npm.
- **Go ≥ 1.26** — only if you want to run the indexer locally.
- **PostgreSQL** reachable via a connection string — again, only for the
  indexer.
- **A Stellar wallet** supported by
  [`stellar-wallets-kit`](https://github.com/Creit-Tech/Stellar-Wallets-Kit)
  (Freighter, for example), on the network your config points at. You need this
  only to sign transactions; browsing the read-only UI needs no wallet.

## Install the workspace

`packages/*` and `apps/*` are one npm workspace with a single root lockfile.
From the repository root:

```bash
npm ci
```

The SDK (`packages/sdk`) is consumed as TypeScript source and transpiled by
Next.js. There is no separate SDK build step to run before starting the web app
— `npm ci` at the root is enough.

## Run the indexer (optional for read-only UI)

The indexer is a standalone Go module. It needs a Postgres database and the
deployed factory contract id. A throwaway local database using the credentials
from `indexer/.env.example`:

```bash
docker run --name charter-pg -e POSTGRES_USER=charter \
  -e POSTGRES_PASSWORD=charter -e POSTGRES_DB=charter \
  -p 5432:5432 -d postgres:16
```

Then configure and start it:

```bash
cd indexer
cp .env.example .env        # then fill in FACTORY_CONTRACT_ID
go run .
```

The database schema is applied on startup and the operation is idempotent, so
there is no separate migration step. The service ingests events in the
background and serves the REST API on `PORT` (default `8080`).

If you only want to work on the UI against an already-running indexer, you can
skip this section and point the web app at that indexer's URL instead — see the
next step.

## Run the web app

```bash
cd apps/web
cp .env.example .env.local   # then fill in the values
```

Point `NEXT_PUBLIC_INDEXER_API_URL` at your indexer — `http://localhost:8080`
for a local one, or a hosted indexer URL. Then, from the repository root:

```bash
npm run dev:web
```

The app starts on <http://localhost:3000>. Until a factory contract is deployed
and configured you can leave `NEXT_PUBLIC_FACTORY_CONTRACT_ID` blank and browse
the read-only UI; deploying a treasury or raising a request needs the real
factory id and a funded wallet.

Every variable in both `.env` files is explained on the [Environment
Variables](environment-variables.md) page.

## Useful scripts

Run from the repository root:

| Command | Does |
| --- | --- |
| `npm run dev:web` | Start the web app in development. |
| `npm run build:web` | Production build of the web app. |
| `npm run build:sdk` | Type-check the SDK. |
| `npm run typecheck` | Type-check every workspace. |
| `npm run lint` | Lint every workspace. |

For the indexer, from `indexer/`: `go vet ./...`, `go build ./...`, `go run .`.

These are the same jobs CI runs on every pull request — "Web (lint · typecheck ·
build)" and "Indexer (vet · build)" — so running them locally before you push
saves a round trip.
