# Submitting a Request

A request is a proposal to move funds out of the treasury, drawn against one
budget category. Anyone with a connected wallet can submit one — you do not have
to be an admin or an approver to request money. The request stays **Pending**
until approvers reach the threshold, at which point it executes and pays out.
This page walks through submitting one.

## Before you start

- **Connect your wallet.** The request form needs a connected account to record
  as the requester and to sign the transaction.
- **There must be an active category.** Requests draw against a category, and
  only active ones are offered. If every category is paused or none exists yet,
  the form tells you: *"There are no active categories to request against. Ask
  an admin to create one or resume a paused category first."*

## Filling in the request

From the treasury dashboard, choose **New request**. The modal explains the
action: *"Propose a disbursement. It stays pending until approvers reach the
threshold."* Four fields:

- **Category** — a dropdown of the active categories. Each shows how much has
  been spent of its cap, so you can see the room left before you draw against
  it.
- **Recipient** — the Stellar account or contract that receives the funds.
  Charter validates this as either a `G…` account address or a `C…` contract
  address; anything else is rejected before you can submit.
- **Amount** — how much to disburse, in token units (e.g. `1,000.00`). This is
  drawn against the category's remaining cap. You enter human-readable units and
  Charter converts to the token's smallest unit; the reference token has 7
  decimals, so `1,000.00` becomes `10000000000` on-chain.
- **Memo** — a short, optional note (e.g. `Q3 contractor invoice`). It is capped
  at **64 bytes**. Leave it empty and the request records no memo.

Submit with **Submit request** ("Submitting…" while it confirms). You sign once.

## What the cap check means for you

The category cap is enforced **at submission**, not later. If your amount
exceeds the category's remaining room (`cap − spent`), the contract rejects the
request outright — it is never created in a state that would overspend. If that
happens, either request a smaller amount or ask the admin to raise the
category's cap. This is deliberate: a request that exists is always a request
the category could actually pay.

## After you submit

Your request appears in the treasury's request list as **Pending**, with your
wallet recorded as the requester. From here:

- Approvers decide. When approvals reach the threshold, the request **executes
  in the same step** — the funds move to the recipient and the category's spent
  total goes up. There is no separate "pay out" action after the final approval.
- A single approver can **reject** it, which is terminal.
- You, as the requester, can **cancel** it while it is still Pending.

Those actions are covered on [Approving, Rejecting, and
Cancelling](approving-rejecting-and-cancelling.md). The full set of states a
request can move through is on the [Request
Lifecycle](../protocol/request-lifecycle.md) page.
