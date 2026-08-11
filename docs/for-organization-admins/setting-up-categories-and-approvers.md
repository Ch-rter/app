# Setting Up Categories and Approvers

Right after you deploy, your treasury has an approver set and a threshold but no
budget categories. Money is spent against categories, so nothing can be
requested until you create at least one. This page covers the admin actions you
take from the treasury dashboard. All of them require the admin wallet to sign;
if you are not connected as the admin, the buttons that trigger them do not
appear.

## Creating a category

On the treasury dashboard, under the **Budget categories** heading, choose **New
category**. The modal explains itself: *"Create a budget category. Requests draw
against its cap."* Two fields:

- **Name** — what the category is, e.g. `Engineering`. The name is set once at
  creation and cannot be changed afterward. Choose it carefully.
- **Spending cap** — the maximum this category can disburse, in whole token
  units (e.g. `10,000.00`). You enter human-readable units; Charter converts to
  the token's smallest unit for you (the reference token has 7 decimals). The
  cap must be greater than zero.

Submit with **Create category**. The button reads "Creating…" while the
transaction confirms.

### What the cap means

A category's cap is a **lifetime total**, not a monthly or quarterly allowance.
The category tracks a `spent` figure that only ever goes up; `cap − spent` is
what remains available to request. When the running total approaches the cap you
raise the cap — spending does not reset on any schedule. This is covered in more
depth on the [Category Mechanics](../protocol/category-mechanics.md) page.

## Adjusting a cap

To change a cap, use the inline **Edit** action on a category row. The modal
title becomes **Edit category cap** and tells you: *"Adjust the spending cap. The
category name cannot be changed."* The name field is locked; only the cap is
editable.

You can raise a cap to any higher value. You can lower it only down to what the
category has already spent — never below. The contract rejects a cap below the
current `spent`, because `spent` records money that already left the treasury and
the cap must not contradict that record. Save with **Save cap** ("Saving…" while
in flight).

## Pausing and resuming a category

Each category row has an inline **Pause** action (and **Resume** once paused). A
paused category shows a **Paused** badge and stops accepting new requests — the
submit-request form will not offer it. Everything already requested against it
is unaffected, and its full history stays queryable. There is no delete: a
category that ever funded a request stays on the books so past spending remains
attributable. Pausing is how you retire a category without erasing its record.

## Reading the category display

The dashboard shows an allocation bar across all categories and, per row, the
category name, a spent-of-cap figure, and a percentage progress bar. When a
category crosses about 90% of its cap it gets a near-cap warning — your cue to
either raise the cap or let it fill and stop. Chips at the top of the dashboard
summarize the treasury: number of categories, number of pending requests, and
the approvals-required rule shown as "N of M."

## Changing approvers and the threshold

The approver list and threshold are set at deploy time, and both are admin
controls on-chain (`add_approver`, `remove_approver`, `set_threshold` on the
treasury contract — see the [Treasury Contract](../smart-contracts/treasury.md)
page). Two rules the contract enforces, worth knowing before you change
anything:

- You cannot set a threshold of zero, and you cannot set it higher than the
  number of approvers.
- You cannot remove an approver if doing so would leave fewer approvers than the
  current threshold. If you need to drop below that count, lower the threshold
  first, then remove the approver. This exists so a treasury can never be
  stranded needing more approvals than it has approvers.

The threshold is a **count**, not a percentage: "2 of 3" means any two of the
three approvers. See [Approval Threshold
Model](../protocol/approval-threshold-model.md) for the reasoning.

With categories created and approvers set, requesters can start submitting
disbursements. That flow is covered in [Submitting a
Request](../for-approvers-and-requesters/submitting-a-request.md).
