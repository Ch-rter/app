# Security Policy

Charter holds organization funds under a Soroban policy contract, so we take
security seriously across the whole application layer. This document covers the
code in this repository — the SDK, the web dashboard, and the indexer. The
Soroban contracts themselves live in
[`charter-contract`](https://github.com/Ch-rter/contract) and are covered by
that repository's policy.

## Supported versions

Charter is pre-1.0 and currently targets **Stellar testnet only**. There is no
mainnet deployment and no stable release line yet, so only the latest `main` is
supported. Fixes land on `main`; there are no backports.

| Version | Supported |
| ------- | --------- |
| `main` (testnet) | ✅ |
| Any tagged pre-release (`v0.x`) | Latest only |
| Mainnet | ❌ Not yet deployed |

## Audit status

**Charter has not been audited.** Neither the application layer in this
repository nor the contracts in `charter-contract` have undergone a third-party
security audit. Do not use Charter to custody real value on mainnet. Treat every
deployment as experimental testnet software.

## Scope

**In scope** — vulnerabilities in the code in this repository:

- `packages/sdk` — transaction construction, simulation, and the sign/submit
  flow (e.g. a bug that could cause the SDK to build or submit a transaction the
  user did not intend).
- `apps/web` — the dashboard (e.g. XSS, leaking configuration, or presenting
  misleading state that could induce a harmful signature).
- `indexer/` — the Go service and its REST API (e.g. SQL injection, serving
  incorrect read-model data, or a denial-of-service in the ingestion loop).

**Out of scope:**

- The Soroban contracts in
  [`charter-contract`](https://github.com/Ch-rter/contract) — report those
  against that repository.
- Third-party dependencies (wallets such as Freighter, `stellar-wallets-kit`,
  Soroban RPC providers, Postgres). Report those to their respective
  maintainers; if a Charter default configuration makes such an issue materially
  worse, we still want to hear about it.
- Findings that require a compromised host, a malicious wallet, or physical
  access.
- Testnet-only issues with no mainnet analogue, and missing hardening that has
  no concrete exploit.

## Reporting a vulnerability

**Please do not open a public issue for security reports.**

Report privately through GitHub's
[Security Advisories](https://github.com/Ch-rter/app/security/advisories/new)
("Report a vulnerability" on the repository's **Security** tab). This keeps the
report private between you and the maintainers until a fix is available.

A useful report includes:

- the component (SDK, web, or indexer) and affected file or endpoint,
- a description of the impact and how to reproduce it,
- any proof-of-concept, logs, or transaction hashes,
- your assessment of severity.

Please give us a reasonable window to investigate and ship a fix before any
public disclosure. We support coordinated disclosure and will credit reporters
who want it.

## Response timeline

| Stage | Target |
| ----- | ------ |
| Acknowledge your report | within **48 hours** |
| Initial assessment (validity + severity) | within **5 days** |
| Fix or mitigation, and coordinated disclosure | within **30 days** |

These are targets for a volunteer-maintained, pre-1.0 project, not a contractual
SLA. If a fix will take longer, we will say so in the advisory thread and keep
you updated.
