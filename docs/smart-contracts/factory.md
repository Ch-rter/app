# Factory Contract

The factory deploys treasuries and keeps the on-chain registry of them. It is
deployed once and initialized once; after that, every treasury an organization
creates goes through it. Every function below is taken from
`contracts/factory/src/lib.rs`.

The factory stores three things in instance storage — the deployer address, the
treasury wasm hash, and the running org count — and one `OrgRecord` per org in
persistent storage.

## `initialize(deployer, wasm_hash)`

Sets the address authorized to deploy treasuries and the hash of the treasury
wasm the factory will deploy. Requires `deployer` to sign.

- Panics `AlreadyInitialized` if called a second time.

## `deploy_treasury(name, admin, approvers, threshold, token) -> u32`

Deploys a new treasury and initializes it in the same transaction. Returns the
new org id.

The factory assigns the next org id (starting at 1), uses that id as a 32-byte
deploy salt so the treasury's address is deterministic, deploys the stored
treasury wasm, then calls the new treasury's `initialize` with the supplied
admin, approvers, threshold, and token. It records an `OrgRecord`, increments
the org count, and emits `TreasuryDeployed`.

**This call needs two signatures.** The stored deployer must sign — it is
authorized against the factory. And the `admin` must also sign, because the
treasury's own `initialize` calls `admin.require_auth()` as a sub-call;
requiring the admin's signature at the top ties that authorization to the root
transaction so the sub-call succeeds.

- Panics `NotInitialized` if the factory has not been initialized.
- The treasury's `initialize` runs as part of this call, so its own panics
  apply too — for example `InvalidThreshold` if `threshold == 0` or
  `threshold > approvers.len()`.

## `get_org(org_id) -> OrgRecord`

Returns the record for one org.

- Panics `OrgNotFound` if the org id does not exist.

## `get_org_count() -> u32`

Returns the number of orgs deployed so far. Org ids run from 1 to this count.

## `get_orgs(start, limit) -> Vec<OrgRecord>`

Returns a page of org records beginning at `start` (inclusive, clamped to a
minimum of 1). `limit` is capped at 50 — requesting more returns 50.

## Types

```rust
struct OrgRecord {
    name: String,
    treasury: Address,
    admin: Address,
    created_ledger: u32,
}
```

## Errors

| Error | # | Meaning |
| --- | --- | --- |
| `NotInitialized` | 1 | Called before `initialize`. |
| `AlreadyInitialized` | 2 | `initialize` called twice. |
| `NotDeployer` | 3 | Reserved for deployer-authorization failures. |
| `OrgNotFound` | 4 | Requested org id does not exist. |

The discriminants here differ from the treasury's — the factory's
`NotInitialized` is 1 and `AlreadyInitialized` is 2, the reverse of the
treasury enum. When decoding a contract error, check which contract raised it.

## Events

| Event | Topic | Data |
| --- | --- | --- |
| `TreasuryDeployed` | `org_id` | `name`, `treasury`, `admin` |

The indexer reads `TreasuryDeployed` to populate its list of organizations,
which is what the `/orgs` endpoint on the
[API Reference](../developer-guide/api-reference.md) page returns.
