# How It Works

Charter moves money through six steps, from deploying a treasury to a category
recording what it has spent. The numbers below come from Charter's own
verified testnet runs.

1. **An organization deploys a treasury instance through the factory**
   (`CCUQBFFRGR4RUWHKLWSRWKBL3WORHNTHFLTKMHTNUZL4T5733ODN5WD4` on testnet),
   naming an admin, a list of approvers, an approval threshold, and the token
   it will hold.

2. **The admin creates budget categories** — a name and a spend cap each.
   Charter's own verified testnet run created a category named "Ops Budget"
   with a cap of 1,000,000,000 units, later raised to 2,000,000,000.

3. **Anyone deposits funds into the treasury** against its bound token.

4. **A contributor submits a disbursement request against a category** — who
   gets paid, how much, and why. Charter's test run submitted a request for
   314,159,265 units against the "Payroll" category.

5. **Approvers review and either approve or reject.** Once enough approvals are
   collected to meet the threshold — Charter's reference deployment used a
   2-of-2 threshold — the transfer executes automatically in the same
   transaction as the final approval. No separate "release funds" step exists;
   crossing the threshold *is* the release.

6. **The category's spent total increases** by the request amount, permanently
   capping what else that category can pay out until the admin raises the cap.

## Amounts are in the token's smallest unit

Every figure above is in the token's smallest unit, not a decimal amount. The
token Charter's test runs used has 7 decimals, so 314,159,265 units is
31.4159265 tokens. Contract calls and the indexer's API always work in these
integer base units; the web dashboard is what converts them to and from the
decimal amounts a person reads. This keeps money exact — it is an integer end
to end and never a floating-point value.

Each step has a page that covers it in full: category caps and the raise/lower
rules under [Category Mechanics](../protocol/category-mechanics.md), the
approve/reject/cancel rules under [Request Lifecycle](../protocol/request-lifecycle.md),
and the count-based threshold under [Approval Threshold Model](../protocol/approval-threshold-model.md).
