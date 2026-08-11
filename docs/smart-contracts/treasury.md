# Treasury Contract

One treasury holds a single organization's approver list, approval threshold,
budget categories, and the balance of one bound token. Every function below is
taken from `contracts/treasury/src/lib.rs`. Amounts are `i128` in the token's
smallest unit; the reference token uses 7 decimals, so 314,159,265 means
31.4159265 tokens.

Functions that change state require the relevant party to sign. Admin-only
functions call an internal `require_admin` check that panics `NotInitialized`
if the contract was never initialized, then `NotAdmin` if the caller is not the
stored admin.

## Setup

### `initialize(admin, approvers, threshold, token)`

Sets the treasury's admin, approver list, approval threshold, and bound token.
Requires `admin` to sign.

- Panics `AlreadyInitialized` if called a second time.
- Panics `InvalidThreshold` if `threshold == 0` or `threshold > approvers.len()`.

The factory calls this automatically inside `deploy_treasury`, so a treasury
deployed through the factory is already initialized.

## Approvers and threshold

### `add_approver(admin, approver)`

Admin adds an approver. If the address is already an approver, the call is a
no-op rather than an error.

### `remove_approver(admin, approver)`

Admin removes an approver.

- Panics `InvalidThreshold` if removing the approver would leave fewer
  approvers than the current threshold. You cannot strand a treasury in a state
  where its threshold can never be met — lower the threshold first, then remove
  the approver.

### `set_threshold(admin, threshold)`

Admin changes the number of approvals required.

- Panics `InvalidThreshold` if `threshold < 1` or `threshold > approvers.len()`.

## Categories

### `create_category(admin, name, cap) -> u32`

Admin creates a budget category with a name and a spend cap. Returns the new
category id.

- Panics `InvalidAmount` if `cap <= 0`.

### `update_category_cap(admin, category_id, new_cap)`

Admin changes a category's cap.

- Panics `InvalidAmount` if the category does not exist, or if `new_cap` is
  below the category's current `spent`. A cap can be raised freely and lowered
  only down to what has already been spent — never below it.

### `set_category_active(admin, category_id, active)`

Admin activates or deactivates a category. A deactivated category rejects new
requests but keeps its history; there is no delete.

- Panics `InvalidAmount` if the category does not exist.

## Funds

### `deposit(from, amount)`

Moves `amount` of the bound token from `from` into the treasury's balance.
Requires `from` to sign.

- Panics `InvalidAmount` if `amount <= 0`.

## Requests

### `submit_request(requester, category_id, recipient, amount, memo) -> u32`

Requester submits a disbursement request against a category. Returns the new
request id. Requires `requester` to sign.

- Panics `InvalidAmount` if the category does not exist.
- Panics `CategoryInactive` if the category is deactivated.
- Panics `InvalidAmount` if `amount <= 0`, or if the request amount exceeds the
  category's remaining room (`cap - spent < amount`). The cap is enforced here,
  at submission — not caught later in an audit.

### `approve_request(approver, request_id)`

An approver signs off on a pending request. Requires `approver` to sign.

- Panics `NotApprover` if the caller is not in the approver list.
- Panics `RequestNotPending` if the request is not Pending.
- Panics `AlreadyApproved` if this approver already approved it.

When the recorded approvals reach the threshold, the contract executes the
request in the same call: it transfers `amount` to the recipient, adds `amount`
to the category's `spent`, and sets the request to Executed. Execution and the
final approval are one atomic step.

### `reject_request(approver, request_id)`

An approver rejects a pending request. Requires `approver` to sign. A single
rejection is terminal — rejection needs no threshold.

- Panics `NotApprover` if the caller is not in the approver list.
- Panics `RequestNotPending` if the request is not Pending.

### `cancel_request(requester, request_id)`

The original requester withdraws their own pending request. Requires
`requester` to sign.

- Panics `RequestNotPending` if the request is not Pending.
- Panics `NotRequester` if the caller is not the address that submitted it.

## Views

These read state and take no signature.

| Function | Returns | Notes |
| --- | --- | --- |
| `get_category(category_id)` | `Category` | Panics `InvalidAmount` if missing. |
| `get_categories()` | `Vec<Category>` | All categories. |
| `get_request(request_id)` | `Request` | Panics `RequestNotPending` if missing. |
| `get_requests_by_category(category_id)` | `Vec<Request>` | |
| `get_balance()` | `i128` | Treasury's token balance. |
| `get_approvers()` | `Vec<Address>` | |
| `get_threshold()` | `u32` | |

## Types

```rust
struct Category {
    name: String,
    cap: i128,
    spent: i128,
    active: bool,
}

enum RequestStatus {
    Pending,
    Executed,
    Rejected,
    Cancelled,
}

struct Request {
    id: u32,
    category_id: u32,
    recipient: Address,
    amount: i128,
    memo: String,
    requester: Address,
    approvals: Vec<Address>,
    status: RequestStatus,
    created_ledger: u32,
}
```

## Errors

The treasury error enum, with its on-chain discriminants:

| Error | # | Meaning |
| --- | --- | --- |
| `AlreadyInitialized` | 1 | `initialize` called twice. |
| `NotInitialized` | 2 | Called before `initialize`. |
| `NotAdmin` | 3 | Caller is not the admin. |
| `NotApprover` | 4 | Caller is not an approver. |
| `CategoryInactive` | 5 | Request against a deactivated category. |
| `CapExceeded` | 6 | Reserved for cap-overflow conditions. |
| `RequestNotPending` | 7 | Action on a non-pending (or missing) request. |
| `InvalidThreshold` | 8 | Threshold zero, above approver count, or would strand approvers. |
| `AlreadyApproved` | 9 | Approver approved the same request twice. |
| `NotRequester` | 10 | Cancel attempted by someone other than the requester. |
| `InvalidAmount` | 11 | Non-positive amount/cap, missing category, or cap below spent. |

Note that the SDK's `TreasuryError` enum in `packages/sdk/src/types.ts` does not
currently match this list one-for-one. When you need the authoritative mapping,
use `errors.rs` and this table, not the SDK enum.

## Events

The treasury emits an event on every state change. The indexer reads these:

| Event | Topic | Data |
| --- | --- | --- |
| `CategoryCreated` | `category_id` | `name`, `cap` |
| `CapUpdated` | `category_id` | `new_cap` |
| `ActiveChanged` | `category_id` | `active` |
| `Deposited` | `from` | `amount` |
| `RequestSubmitted` | `request_id` | `category_id`, `recipient`, `amount` |
| `RequestApproved` | `request_id` | `approver` |
| `RequestExecuted` | `request_id` | `recipient`, `amount` |
| `RequestRejected` | `request_id` | `approver` |
| `RequestCancelled` | `request_id` | — |

`RequestApproved` and `RequestExecuted` are separate events. An approval that
meets the threshold emits `RequestExecuted`, not `RequestApproved` — which is
why the indexer's approval count for an executed request is one lower than the
number who signed. This is described on the
[API Reference](../developer-guide/api-reference.md) page.
