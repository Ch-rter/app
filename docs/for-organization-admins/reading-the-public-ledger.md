# Reading the Public Ledger

Everything a Charter treasury does is public. The contracts store their state
on-chain, the indexer mirrors it, and the web app reads it without a wallet.
Anyone can audit an organization's spending: its categories, its caps, its
balance, and every request with the addresses that approved it. This page is
about reading that record — no wallet needed, nothing to sign.

## The organization directory

The home page lists every indexed organization. An orientation line at the top
states what Charter is: *"Charter is a treasury operations layer for Stellar
organizations. Set budget caps, route disbursements through approvals, and
settle on-chain."* Below it, under the **Organizations** heading ("Stellar
treasuries indexed on-chain"), each row shows the org name, the admin address
(truncated), the treasury address, and the ledger it was created at. Selecting a
row opens that treasury's dashboard. If nothing is indexed yet, the list says
"No organizations yet."

## The treasury dashboard

Open a treasury and you see its whole state at a glance:

- **Treasury balance** — a panel labeled *"Live from the treasury contract"*
  showing the current token balance. This reads the contract directly, so it is
  the live number, not a cached one.
- **Summary chips** — how many categories exist, how many requests are pending,
  and the approval rule ("N of M approvals required").
- **Budget categories** — each category's name, its spent-of-cap figure, a
  percentage bar, and a **Paused** badge on any deactivated category. An
  allocation bar shows how the categories divide the budget. A category over
  ~90% of its cap carries a near-cap warning.
- **Requests** — the list of disbursement requests, each with its status.

You do not need to be the admin or an approver to see any of this. The
admin-only and approver-only buttons (create category, new request, approve)
simply don't appear when you are not that party — but the full record is
visible to everyone.

## Reading a request

Open a request to see its detail: the header **Request #N**, a status badge
(Pending, Executed, Rejected, or Cancelled), which category it draws against,
and the disbursement amount. Below that:

- **Recipient** — the account or contract that receives the funds.
- **Requested by** — the address that raised it.
- **Memo** — the note attached at submission, or "None" if there wasn't one.
- **Created** — the ledger the request was submitted at.
- **Approvals** — a progress indicator toward the threshold and a roster of
  approvers, each marked "Approved" or "Awaiting," with "Requester" and "Former
  approver" badges where they apply.

An invalid request id shows "Request not found."

## One thing to know when auditing approvals

For a request that **executed**, the on-chain record — and therefore the ledger
you are reading — shows exactly one approval, even if more approvers signed. This
is not data loss. The approval that meets the threshold executes the request in
the same step, and the contract emits a `RequestExecuted` event for it rather
than a `RequestApproved` event. The indexer counts approvals from
`RequestApproved` events only, so the final, decisive approval isn't counted as
an approval. A 2-of-2 request that executed will show one recorded approval plus
the execution.

If you are reconciling "who approved this," read an **executed** request as: the
listed approver(s), plus whoever triggered execution. The mechanism is described
from the contract side on the [Treasury
Contract](../smart-contracts/treasury.md) page and from the API side on the [API
Reference](../developer-guide/api-reference.md) page.

## Reading it without the web app

The same data is available directly from the indexer's REST API — organizations,
categories, requests, and single requests — with no authentication. If you want
to pull the ledger into your own tooling or a spreadsheet, the endpoints and
their exact responses are documented on the [API
Reference](../developer-guide/api-reference.md) page.
