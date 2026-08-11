# SDK Reference

`@charter/sdk` (`packages/sdk`) is the TypeScript layer for talking to the
Charter contracts. It is the only path in the app allowed to call
state-changing contract methods, so the whole simulate → prepare → sign → send →
poll sequence lives in one place. The web app calls these functions; it never
assembles a contract call itself.

The SDK is wallet-agnostic. Writes take a `signXdr` callback, so `packages/sdk`
never depends on the wallet library — the web layer plugs one in. Signatures on
this page are copied from the source in `packages/sdk/src`.

## Reads and writes

- **Reads** are free simulations: no wallet, no signature, no fee. They return
  decoded domain types.
- **Writes** take the caller's public key and a `signXdr` callback, and return
  the confirmed transaction hash (the factory's `deployTreasury` also returns
  the new treasury address). Under the hood each write simulates first — so a
  contract error surfaces before the user is asked to sign — then prepares,
  signs, submits, and polls to a definitive success or failure.

### The `signXdr` callback

Every write ends in a signature. Its type:

```ts
type SignXdr = (
  xdrBase64: string,
  options: { networkPassphrase: string },
) => Promise<string>;
```

It takes a base64 transaction envelope and returns the signed envelope. The web
layer implements this on top of the connected wallet; the SDK just calls it.

### Amounts are `bigint`

Token amounts (`cap`, `amount`) are `bigint` in the token's smallest unit — never
JavaScript numbers, never floats. The reference token has 7 decimals, so
`31.4159265` tokens is `314159265n`. Convert human input with `parseAmount` and
display with `formatAmount` (both in the web layer's `lib/format.ts`), which are
bigint-safe across the full `i128` range.

## Factory client

Imported as `import { factory } from '@charter/sdk'`.

### Writes

```ts
factory.initialize(
  factoryId: string,
  deployer: string,
  wasmHash: string | Uint8Array,
  signXdr: SignXdr,
): Promise<string>

factory.deployTreasury(
  factoryId: string,
  admin: string,
  name: string,
  approvers: string[],
  threshold: number,
  token: string,
  signXdr: SignXdr,
): Promise<DeployTreasuryResult>
```

`initialize` registers the treasury wasm the factory deploys from; it is an
admin-only, run-once setup call, surfaced here for tooling.

`deployTreasury` deploys a per-org treasury and returns both the transaction
hash and the new treasury address:

```ts
interface DeployTreasuryResult {
  hash: string;
  treasuryAddress: string;
}
```

Note the argument order: the caller passes `admin` and the SDK uses it as the
account that authorizes and pays. This is the call the new-org form makes.
Because the treasury's own `initialize` runs as a sub-call that requires the
admin's authorization, the wallet is asked to sign twice — see [Getting
Started](../for-organization-admins/getting-started.md).

### Reads

```ts
factory.getOrg(factoryId: string, orgId: number): Promise<OrgRecord>
factory.getOrgCount(factoryId: string): Promise<number>
factory.getOrgs(factoryId: string, start: number, limit: number): Promise<OrgRecord[]>
```

## Treasury client

Imported as `import { treasury } from '@charter/sdk'`.

### Admin — approvers and threshold

```ts
treasury.addApprover(treasuryId, admin, approver, signXdr): Promise<string>
treasury.removeApprover(treasuryId, admin, approver, signXdr): Promise<string>
treasury.setThreshold(treasuryId, admin, threshold: number, signXdr): Promise<string>
```

### Admin — categories

```ts
treasury.createCategory(treasuryId, admin, name: string, cap: bigint, signXdr): Promise<string>
treasury.updateCategoryCap(treasuryId, admin, categoryId: number, newCap: bigint, signXdr): Promise<string>
treasury.setCategoryActive(treasuryId, admin, categoryId: number, active: boolean, signXdr): Promise<string>
```

### Funds and requests

```ts
treasury.deposit(treasuryId, from, amount: bigint, signXdr): Promise<string>
treasury.submitRequest(
  treasuryId, requester, categoryId: number, recipient: string,
  amount: bigint, memo: string, signXdr,
): Promise<string>
treasury.approveRequest(treasuryId, approver, requestId: number, signXdr): Promise<string>
treasury.rejectRequest(treasuryId, approver, requestId: number, signXdr): Promise<string>
treasury.cancelRequest(treasuryId, requester, requestId: number, signXdr): Promise<string>
```

In each write, the second argument (`admin`, `from`, `requester`, or `approver`)
is both the address recorded on-chain for that action and the account that signs
and pays. `approveRequest` may execute the request in the same call: when the
approval meets the threshold, the contract transfers the funds and marks the
request Executed atomically.

### Views — free reads, no signature

```ts
treasury.getCategory(treasuryId, categoryId: number): Promise<Category>
treasury.getCategories(treasuryId): Promise<Category[]>
treasury.getRequest(treasuryId, requestId: number): Promise<Request>
treasury.getRequestsByCategory(treasuryId, categoryId: number): Promise<Request[]>
treasury.getBalance(treasuryId): Promise<bigint>
treasury.getApprovers(treasuryId): Promise<string[]>
treasury.getThreshold(treasuryId): Promise<number>
```

`getBalance` returns a `bigint`; the two view collections decode into the
`Category` and `Request` types the contract defines (see the [Treasury
Contract](../smart-contracts/treasury.md) page for their fields).

## Errors

A contract failure surfaces as a typed error with a plain-English message, so
callers never handle a raw contract string:

- `treasury.TreasuryCallError` — carries the numeric contract error `code` (when
  one can be parsed from the RPC message) and a human-readable message.
- `factory.FactoryCallError` — the same, for factory calls.

Both wrap the lower-level `ContractError` thrown by the RPC layer. The numeric
`code` is the contract's `#[contracterror]` discriminant, parsed from Soroban's
`Error(Contract, #N)` message.

> **Known drift.** The SDK's own `TreasuryError` / `FactoryError` enums in
> `packages/sdk/src/types.ts` do not currently line up one-for-one with the
> contract's `errors.rs`. When you need the authoritative code-to-meaning
> mapping, use the contract source and the tables on the
> [treasury](../smart-contracts/treasury.md) and
> [factory](../smart-contracts/factory.md) pages, not the SDK enum. This is a
> tracked bug, not a documentation gap.

## Reads for display come from the indexer, not the SDK

The SDK's view functions read live contract state by simulation. The web app
uses them where it needs the current on-chain value (the treasury balance panel,
for instance). For lists and history — organizations, categories, requests — the
app reads the indexer's REST API instead, which is faster and queryable. That
API is documented on the [API Reference](api-reference.md) page.
