# Approving, Rejecting, and Cancelling

Once a request is Pending, three actions can move it out of that state:
approval, rejection, and cancellation. They are not symmetric — they need
different people and different levels of agreement, on purpose. This page
covers who can do what, and what happens on-chain when they do.

## Who can act

On a request detail page (**Request #N**), the available actions depend on who
you are:

- **Approvers who haven't yet signed** see **Approve** and **Reject**.
- **The requester** sees **Cancel**, while the request is Pending.
- If you are connected but are neither an approver nor the requester, the page
  tells you: *"Only approvers and the requester can act on this request."*
- If no wallet is connected: *"Connect a wallet to approve, reject, or cancel
  this request."*

The page also gives you a contextual line about your own standing — for example
"You have approved this request," "Your signature is needed to move this request
forward," or "You raised this request. You can cancel it while it is pending."

## Approving

**Approve** records your signature on the request. Each approver can approve
once; a second attempt from the same approver is rejected by the contract
(`AlreadyApproved`). The **Approvals** section shows progress toward the
threshold and a roster marking each approver "Approved" or "Awaiting."

When your approval is the one that meets the threshold, the request **executes
in the same transaction**. The contract transfers the amount to the recipient,
adds it to the category's spent total, and sets the request to **Executed**.
There is no separate payout step — the final approval and the disbursement are
one atomic action. If anything in that execution would fail, the whole approval
fails with it; the request does not end up half-done.

### Why an executed request shows one approval

Because the threshold-meeting approval executes the request, the contract emits
a `RequestExecuted` event for it rather than a `RequestApproved` event. The
indexer counts approvals from `RequestApproved` events, so an executed request
shows one fewer recorded approval than the number of people who actually signed.
A 2-of-2 request that executed displays a single recorded approval. This is a
read-model detail, not a lost signature — see the [API
Reference](../developer-guide/api-reference.md) page.

## Rejecting

**Reject** is available to any approver, and a single rejection is **terminal**:
the request moves straight to **Rejected** and cannot return to Pending.
Rejection deliberately needs no threshold. Authorizing money to move is the
high-coordination action and takes the full set of approvals; blocking a bad
disbursement should not need the same coordination — if any one approver sees a
problem, they can stop it alone.

A rejected request cannot be re-opened or re-approved. If the disbursement is
still wanted, someone submits a new request.

## Cancelling

**Cancel** is for the **requester only**, and only while the request is Pending.
It lets the person who raised a request withdraw it before an approval decision
is forced. An approver cannot cancel someone else's request (the contract raises
`NotRequester`), and a request that has already executed, been rejected, or been
cancelled cannot be cancelled again (`RequestNotPending`).

## The one-way rule

All three transitions are final. A request leaves Pending exactly once — to
Executed, Rejected, or Cancelled — and never comes back. There is no editing a
Pending request either; to change an amount, recipient, or memo, cancel it and
submit a new one. The complete state machine is drawn on the [Request
Lifecycle](../protocol/request-lifecycle.md) page.
