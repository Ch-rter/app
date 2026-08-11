# Request Lifecycle

Every disbursement is a request, and every request moves through a small state
machine. A request starts Pending and ends in exactly one of three terminal
states: Executed, Rejected, or Cancelled. It cannot move backward.

## Pending

The state every request starts in on `submit_request`. Any approver in the
treasury's approver list can approve or reject a pending request; the original
requester can cancel their own pending request. A request cannot move directly
to Executed without passing through approvals being collected one at a time.

## Executed

Reached only when `approve_request` pushes the approval count to meet or exceed
the treasury's threshold. Execution and the final approval happen atomically —
there's no window where a request is "fully approved but not yet paid." The
recipient receives the funds, and the category's `spent` field increases by the
exact request amount, in the same transaction.

## Rejected

A terminal state reached by any single approver calling `reject_request` on a
pending request. Unlike approval, rejection needs no threshold — one approver's
rejection is final, by design, since blocking a bad disbursement should not
require the same coordination as authorizing one.

## Cancelled

A terminal state reachable only by the original requester, only while the
request is still Pending. Once any approval has been recorded or the request
has moved to any other state, cancellation is no longer available.

## No return to Pending

A request cannot re-enter Pending from any terminal state. A new request must
be submitted.

```
                 approve_request (meets threshold)
        ┌──────────────────────────────────────────► Executed
        │
Pending ─┼──────── reject_request (any 1 approver) ──► Rejected
        │
        └──────── cancel_request (requester only) ───► Cancelled
```

The asymmetry between these transitions — approval needs the full threshold,
rejection needs one approver, cancellation is requester-only — is deliberate.
The reasoning is on the [Approval Threshold Model](approval-threshold-model.md)
page.
