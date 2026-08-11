# The Problem

DAO and grant-funded treasuries operate at real scale with limited built-in
accountability tooling.

- Uniswap's DAO treasury holds roughly **$4.8B**, predominantly in UNI
  tokens, with the Uniswap Foundation handling a roughly **$45M** annual
  operating budget and a roughly **$40M** annual grant program.
- Optimism's RetroPGF rounds have distributed over **$200M** across more than
  **2,000 projects** since 2022.
- Arbitrum's STIP and LTIPP programs have moved **$40M–$200M** per funding
  round.

Each of these programs relies on published quarterly reports, treasury
committees, or foundation-level bookkeeping to demonstrate accountability
after the fact — not a protocol that enforces budget limits or approval
thresholds at the point money moves.

## A multisig is not a budget

A bare multisig wallet solves who can sign, not what a signature is allowed to
authorize. It has no concept of a budget category, no cap on how much a given
category can spend, and no way for an outside observer to check "was this
transfer actually within policy" without trusting a manually published report.

Charter puts that policy on-chain, so the constraint is enforced by the
contract at the moment funds move, not reconstructed afterward from a
spreadsheet. A request that would push a category past its cap does not get a
warning in a later audit — it is rejected by the treasury when it is
submitted. And because every category, cap, request, and approval is stored
on-chain and publicly readable, verifying that spending stayed within policy
means reading the ledger, not trusting a summary of it.

The mechanics of how that enforcement works are covered in [How It Works](how-it-works.md)
and, in full, under [Protocol](../protocol/request-lifecycle.md).
