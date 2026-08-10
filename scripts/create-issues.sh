#!/usr/bin/env bash
# Batch-create the initial candidate issues for the Charter application layer.
#
# These four issues capture known gaps in the SDK / web / indexer that are real,
# scoped, and ready for a contributor to pick up. Each is written with a Summary,
# Acceptance Criteria, and the relevant Tech Stack so it can stand alone.
#
# Creating issues is not idempotent (re-running makes duplicates), so this is
# intended to be run once against a fresh repo. Pass --dry-run to print what
# would be created without touching the repo.
#
# Usage:
#   ./scripts/create-issues.sh            # create the issues on $REPO
#   ./scripts/create-issues.sh --dry-run  # print what would be created
#   REPO=Ch-rter/app ./scripts/create-issues.sh
#
# Requires: gh (authenticated with repo scope).
set -euo pipefail

REPO="${REPO:-Ch-rter/app}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# Labels used below beyond the GitHub defaults (bug, documentation, enhancement,
# good first issue, help wanted). Create them if missing; --force is a no-op when
# the label already exists.
ensure_label() {
  local name="$1" color="$2" desc="$3"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "gh label create \"$name\" --repo \"$REPO\" --color \"$color\" --description \"$desc\" --force"
    return
  fi
  gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" --force >/dev/null
}

ensure_label "indexer" "1d76db" "The Go event indexer and its REST API"
ensure_label "web"     "5319e7" "The Next.js web dashboard"
ensure_label "sdk"     "0e8a16" "The @charter/sdk TypeScript package"
ensure_label "tests"   "fbca04" "Test coverage and regression suites"

# Create one issue. Args: title, label-csv, body.
create_issue() {
  local title="$1" labels="$2" body="$3"
  if [[ "$DRY_RUN" == "1" ]]; then
    printf 'gh issue create --repo %s --title %q --label %q  (body: %d chars)\n' \
      "$REPO" "$title" "$labels" "${#body}"
    return
  fi
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$body"
}

# ---------------------------------------------------------------------------
# 1. Read model for `deposited` events
# ---------------------------------------------------------------------------
create_issue \
  "indexer: add a read model for deposited events" \
  "indexer,enhancement,good first issue" \
  "## Summary

The indexer decodes and raw-logs \`deposited\` events but has no read model for
them — they fall through to the default case in the event fold and are only
stored in the raw \`charter_events\` table. There is no way to query a treasury's
deposit history over the REST API, so the web app cannot show funding activity.

Add a \`deposits\` read-model table populated from \`deposited\` events, plus a
read-only endpoint to serve it.

## Acceptance criteria

- [ ] A \`deposits\` table keyed by treasury, with amount stored as
      \`NUMERIC(30,0)\` (never a float) and the source/from address, ledger, and
      timestamp.
- [ ] The event fold handles \`deposited\` explicitly instead of falling to the
      default (raw-log-only) case; ingestion stays idempotent on
      \`paging_token\`.
- [ ] \`GET /orgs/{treasury}/deposits\` returns deposits newest-first, amounts as
      decimal **strings**.
- [ ] The schema change is applied by the idempotent startup migration.

## Tech stack

Go 1.26 indexer (\`indexer/\`), Postgres. Follow the existing decoder/fold
pattern in \`events.go\` and the read-model handlers in the REST layer."

# ---------------------------------------------------------------------------
# 2. Populate memo / requester on requests
# ---------------------------------------------------------------------------
create_issue \
  "indexer: populate memo and requester on requests" \
  "indexer,documentation,help wanted" \
  "## Summary

The \`requests\` read model exposes \`memo\` and \`requester\` fields, but they
are currently always empty: the \`request_submitted\` contract event does not
carry them, so the indexer has nothing to fold in. This is a **contract-level
limitation**, not an indexer bug — the data does not exist in the on-chain event
today.

We should (a) document this clearly so consumers don't treat the empty fields as
a regression, and (b) track the contract change needed to emit them.

## Acceptance criteria

- [ ] The API docs / README note that \`memo\` and \`requester\` are populated
      only once the contract emits them, and are empty for events emitted by the
      current contract.
- [ ] A companion issue is opened on
      [\`charter-contract\`](https://github.com/Ch-rter/contract) to add
      \`memo\` and \`requester\` to the \`request_submitted\` event.
- [ ] Once the contract emits them, the decoder folds them into the \`requests\`
      read model (no schema change expected — the columns already exist).

## Tech stack

Go 1.26 indexer (\`indexer/\`, \`events.go\`); coordination with the Soroban
contracts in \`charter-contract\`."

# ---------------------------------------------------------------------------
# 3. Automated tests for the event decoders
# ---------------------------------------------------------------------------
create_issue \
  "indexer: add automated tests for the event decoders" \
  "indexer,tests,help wanted" \
  "## Summary

The indexer has nine event decoders (\`treasury_deployed\`, \`category_created\`,
\`cap_updated\`, \`active_changed\`, \`request_submitted\`, \`request_approved\`,
\`request_executed\`, \`request_rejected\`, \`request_cancelled\`). They were
verified by hand against live testnet events but have **no regression suite**, so
a change to one decoder can silently break another.

Add table-driven Go tests that decode captured event payloads and assert the
resulting struct fields — especially the \`i128\` → \`NUMERIC(30,0)\` amount path,
which must never go through a float.

## Acceptance criteria

- [ ] A table-driven test per decoder using representative captured XDR/event
      payloads as fixtures.
- [ ] Amount fields assert exact decimal-string values (no float rounding).
- [ ] The unknown-event path (default fold case, e.g. \`deposited\` today) is
      covered so it degrades gracefully.
- [ ] \`go test ./...\` runs in CI alongside \`go vet\` and \`go build\`.

## Tech stack

Go 1.26 standard \`testing\` (table-driven), \`indexer/events.go\`. Wire into the
existing \`Indexer (vet · build)\` CI job."

# ---------------------------------------------------------------------------
# 4. Web: loading / error state when the indexer is unreachable
# ---------------------------------------------------------------------------
create_issue \
  "web: show loading and error states when the indexer is unreachable" \
  "web,enhancement,good first issue" \
  "## Summary

The web dashboard reads all display data from the indexer's REST API. When the
indexer is slow or down, the UI has no dedicated loading or error state — the
user sees an empty or broken view with no explanation and no way to retry.

Add explicit loading and error states to the indexer-backed views so an
unreachable indexer is communicated clearly.

## Acceptance criteria

- [ ] Indexer-backed views show a loading indicator while fetching.
- [ ] On fetch failure, the view shows a clear error message (distinguishing
      \"indexer unreachable\" from \"no data yet\") with a retry affordance.
- [ ] No uncaught promise rejections; a failed read never renders a blank page.
- [ ] No \`any\` types introduced; \`npm run typecheck\` and \`npm run lint\` stay
      clean.

## Tech stack

Next.js 15 App Router (\`apps/web\`), TypeScript. Reads go through the existing
indexer REST client — do not add a Soroban RPC read path."

echo
echo "Done. Created 4 issues on ${REPO} (or printed them with --dry-run)."
