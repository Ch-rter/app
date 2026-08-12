# Category Mechanics

A category holds a `name`, a `cap`, a `spent` total, and an `active` flag.
`cap - spent` at any moment is what remains available for new requests.

## A worked example: "Ops Budget"

Walk through Charter's own test category, "Ops Budget": created with a cap of
1,000,000,000. The admin later raised the cap to 2,000,000,000 via
`update_category_cap` — always legal, since a cap can only be raised or lowered
down to (never below) the current `spent` value. If a category has already
spent 314,159,265, the admin cannot set its cap below that number; the contract
rejects it.

## Deactivating a category

Deactivating a category (`set_category_active` with `active: false`) blocks new
`submit_request` calls against it but does not affect requests already in
flight. There is deliberately no delete function — a category that funded past
requests must stay queryable so historical spend stays attributable, even after
the org stops using it for new requests.

## Caps are lifetime totals

A category's `spent` is cumulative and never resets. The cap is not a
per-month or per-quarter allowance; it is the total this category may ever pay
out at its current cap setting. When a category is close to its cap, the admin
raises the cap to make more room — the spent history stays intact underneath.
This is why lowering a cap below `spent` is rejected: `spent` is a record of
money that already moved, and the cap can never be set to contradict it.
