# Environment Variables

Charter has two configuration surfaces: the web app and the indexer. Each ships
a committed `.env.example` you copy and fill in. No secrets are committed to
either repository, and none should be — the one genuinely sensitive value, the
indexer's database URL, stays out of version control.

## Web app (`apps/web/.env.local`)

Every web variable is public. They are all `NEXT_PUBLIC_*`, which Next.js inlines
into the client bundle at build time. Nothing here is a secret — these values
ship to the browser by design.

Two things follow from that build-time inlining, both of which the code depends
on:

- The variables are read through **static** `process.env.NEXT_PUBLIC_*` property
  accesses, never a dynamic `process.env[name]` lookup. Next.js only inlines a
  public var when it can see the literal property name at build time; a dynamic
  lookup compiles to `undefined` in the browser. This is why
  `packages/sdk/src/rpc.ts` reads each name literally.
- There is **no localhost fallback**. A missing required value throws at the
  point of use rather than quietly defaulting to a local URL that could ship to
  production. Set them, or the app fails loudly.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint the SDK simulates and submits against. |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Network passphrase every transaction is signed against. |
| `NEXT_PUBLIC_FACTORY_CONTRACT_ID` | The factory the new-org flow deploys treasuries through. |
| `NEXT_PUBLIC_TREASURY_WASM_HASH` | Treasury wasm hash — informational, shown in the new-org flow. |
| `NEXT_PUBLIC_INDEXER_API_URL` | Base URL of the indexer REST API the app reads from. |
| `NEXT_PUBLIC_READ_ONLY_SOURCE_ACCOUNT` | Any account public key, used only as the source for read-only simulations. |

The reference `.env.example` values for testnet:

```bash
NEXT_PUBLIC_SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_FACTORY_CONTRACT_ID=""
NEXT_PUBLIC_TREASURY_WASM_HASH=""
NEXT_PUBLIC_INDEXER_API_URL="http://localhost:8080"
NEXT_PUBLIC_READ_ONLY_SOURCE_ACCOUNT=""
```

> Keep `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` **quoted**. The passphrase
> contains a semicolon (`Test SDF Network ; September 2015`), which breaks
> unquoted shell sourcing of the file.

The `NEXT_PUBLIC_READ_ONLY_SOURCE_ACCOUNT` is worth a note: read simulations
never touch the ledger, so the account only needs to be a valid `G…` strkey —
it does not need to exist or be funded. Leave it blank and the SDK derives a
deterministic unfunded placeholder from an all-zero seed.

## Indexer (`indexer/.env`)

The indexer is a server-side service, so its configuration is **not** public.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. **Sensitive** — keep it out of version control. |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint the poller reads events from. |
| `NETWORK_PASSPHRASE` | Network passphrase. |
| `FACTORY_CONTRACT_ID` | The factory the treasury watch list is bootstrapped from. |
| `PORT` | REST API port (default `8080`). |
| `POLL_INTERVAL_SECONDS` | How often the ingestion loop polls `getEvents` (default `5`). |

The reference `.env.example` (with a throwaway local database URL — a real
deployment uses a private connection string that is never committed):

```bash
DATABASE_URL="postgres://charter:charter@localhost:5432/charter?sslmode=disable"
SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
FACTORY_CONTRACT_ID=""
PORT="8080"
POLL_INTERVAL_SECONDS="5"
```

Same quoting rule applies to `NETWORK_PASSPHRASE` — the semicolon breaks
unquoted sourcing.

## What points at what

The web app never talks to Postgres and never writes to the indexer. It reads
display data from `NEXT_PUBLIC_INDEXER_API_URL` and sends writes through the SDK
to `NEXT_PUBLIC_SOROBAN_RPC_URL`. The indexer reads events from its own
`SOROBAN_RPC_URL` and writes them to `DATABASE_URL`. The one value they must
agree on is the network — both passphrases, and both RPC URLs, should point at
the same network, and both `FACTORY_CONTRACT_ID` values at the same factory.
