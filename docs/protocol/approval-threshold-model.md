# Approval Threshold Model

The threshold is a count of approvals required, not a percentage — a treasury
with 5 approvers and a threshold of 2 needs any 2 of those 5 to agree, not 40%
of some larger pool. Charter's reference deployment used a 2-of-2 threshold:
both configured approvers had to sign off before execution.

The admin can add or remove approvers and change the threshold at any time,
with one constraint enforced on-chain: removing an approver is rejected if it
would drop the approver count below the current threshold. A treasury can never
be left in a state where the required number of approvals is mathematically
unreachable.

## Approve, reject, and cancel are not symmetric

The three ways a pending request can leave the Pending state need different
levels of agreement, on purpose:

- **Approval** requires the full threshold. Authorizing money to move is the
  high-coordination action, so it takes the agreed-upon number of approvers.
- **Rejection** requires a single approver. Blocking a bad disbursement should
  not need the same coordination as authorizing one — if any one approver sees
  a problem, they can stop it.
- **Cancellation** is requester-only, and only while the request is Pending.
  The person who raised a request can withdraw it before any approval decision
  forces the issue.

This is the reasoning behind the transitions drawn on the
[Request Lifecycle](request-lifecycle.md) page.
