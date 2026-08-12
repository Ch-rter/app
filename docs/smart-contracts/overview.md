# Smart Contracts Overview

Charter is two Soroban contracts. The **factory** deploys and tracks treasuries;
each **treasury** holds one organization's policy and funds. This page explains
how they fit together and where the source lives. The per-function reference is
on the [treasury](treasury.md) and [factory](factory.md) pages.

## Two contracts, two jobs

The **factory** is deployed once. It stores the hash of the treasury wasm, the
address authorized to deploy (the deployer), and a running count of orgs. When
someone deploys a treasury through it, the factory assigns the next org id,
uses that id as the deploy salt so the treasury address is deterministic,
initializes the new treasury in the same transaction, and records an
`OrgRecord` for it. It is the on-chain registry: given an org id, it returns
that org's name, treasury address, admin, and the ledger it was created at.

A **treasury** is deployed once per organization. It holds that org's approver
list, approval threshold, budget categories, and the bound token's balance. All
of the money mechanics — categories, caps, requests, approvals, execution —
live here. One treasury never reads or writes another's state; the factory is
the only thing that knows about all of them.

## Deployed addresses (testnet)

Both contracts run on the Stellar testnet, network passphrase
`Test SDF Network ; September 2015`.

| Contract | Address |
| --- | --- |
| Factory | `CCUQBFFRGR4RUWHKLWSRWKBL3WORHNTHFLTKMHTNUZL4T5733ODN5WD4` |
| Reference treasury | `CAH4PUADD2X3K52TKETWTIL4GHPZT55LWUEVVOSH6B3D3KA2ZH7HQGTT` |

The factory was initialized with the treasury wasm hash
`e6ee93a93dd18927abab8dc1c4f95ec820da020310b2b2a45a0588b91581df8a`. The
reference treasury runs wasm hash
`b72f664802f395192375b4fca2e0930cff6f994a8053ca568d4f96eb0032ba6c`.

## Where the code is

The contracts live in the `charter-contract` repository, written in Rust
against the Soroban SDK:

- `contracts/treasury/src/lib.rs` — the treasury contract functions.
- `contracts/treasury/src/types.rs` — `Category`, `Request`, `RequestStatus`.
- `contracts/treasury/src/errors.rs` — the treasury error enum.
- `contracts/treasury/src/events.rs` — the events the treasury emits.
- `contracts/factory/src/lib.rs` — the factory contract functions.
- `contracts/factory/src/types.rs` — `OrgRecord` and storage keys.
- `contracts/factory/src/errors.rs` — the factory error enum.
- `contracts/factory/src/events.rs` — the `TreasuryDeployed` event.

The suite runs 47 treasury tests and 11 factory tests, 58 in total.

## How the indexer sees the contracts

The contracts emit events on every state change — `CategoryCreated`,
`RequestSubmitted`, `RequestApproved`, `RequestExecuted`, and so on. The
[indexer](../developer-guide/api-reference.md) polls Soroban for these events,
writes them to Postgres, and serves them over a read-only REST API. The
contracts are the source of truth; the indexer is a queryable mirror of the
events they emit. One consequence of building from events shows up on the API
Reference page: a request that executes on its threshold-meeting approval emits
`RequestExecuted` rather than `RequestApproved`, so the indexer records one
fewer approval than the number of approvers who actually signed.
