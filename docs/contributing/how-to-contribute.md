# How to Contribute

Contributions are welcome. Charter is two repositories — the application layer
and the contracts — and this page covers how to work in either. The conventions
here restate what each repository's `README` and `CONTRIBUTING` enforce; where
this page and a repository differ, the repository is the source of truth.

## The two repositories

- **[`Ch-rter/app`](https://github.com/Ch-rter/app)** — the SDK, web app, and
  indexer. TypeScript and Go.
- **[`Ch-rter/contract`](https://github.com/Ch-rter/contract)** — the treasury
  and factory Soroban contracts. Rust.

## Finding something to work on

Start with the open issues labeled `good first issue`:

- [`app` good first issues](https://github.com/Ch-rter/app/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- [`contract` good first issues](https://github.com/Ch-rter/contract/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

If you want to work on something not yet filed, open an issue first so the
approach can be agreed before you write code.

## Branch naming

Branch off `main` with a type prefix that matches the change:

```
feat/<short-desc>
fix/<short-desc>
docs/<short-desc>
chore/<short-desc>
```

## Commit format

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope,
for example:

```
feat(sdk): add batch approval helper
fix(indexer): decode contract events positionally
docs(web): document the read-only source account
```

## Pull requests

`main` is protected. A pull request must have an approving review and its status
checks must pass before it can merge; stale approvals are dismissed when new
commits land, and open review conversations must be resolved. The checks that
run on every push and PR:

- **Web (lint · typecheck · build)** — `npm ci`, `npm run lint`,
  `npm run typecheck`, `npm run build:web`.
- **Indexer (vet · build)** — `go vet ./...` and `go build ./...` in `indexer/`.

Run those locally before you push and you will not be surprised by CI.

### Checklist before opening a PR

- [ ] `npm run lint` and `npm run typecheck` pass.
- [ ] `npm run build:web` succeeds (for web or SDK changes).
- [ ] `go vet ./...` is clean (for indexer changes).
- [ ] No `any` types introduced in TypeScript.
- [ ] Writes still go through `packages/sdk`; reads still come from the indexer.

That last point is the one architectural rule worth repeating: the web app never
calls a state-changing contract method directly and never reads display data
from Soroban RPC. Writes go through the SDK; reads come from the indexer. A
change that blurs those two paths will be asked to change, however well it works.

## Working on the contracts

Contract changes live in `Ch-rter/contract` and carry an extra responsibility:
the application layer documents contract behavior — function signatures, error
discriminants, events — from the contract source. If you change a function
signature, an error enum, or an event's shape, the [Smart
Contracts](../smart-contracts/overview.md) pages and the SDK's mirrored types
need to change with it. Note the change in your PR description so the
application-layer docs and `packages/sdk/src/types.ts` are updated to match.

## Reporting a security issue

Do not open a public issue for a vulnerability. Each repository's
`SECURITY.md` explains how to report one privately. See
[`app`'s SECURITY.md](https://github.com/Ch-rter/app/blob/main/SECURITY.md).
