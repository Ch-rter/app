# What is Charter

> Charter is a treasury operations layer for Stellar-based organizations.
> Instead of a bare multisig wallet, funds are held under a policy contract
> with defined budget categories, spend limits, and approval thresholds.
> Contributors submit disbursement requests against a category; designated
> approvers sign off within the policy's rules; once the threshold is met,
> funds release automatically. Every category, request, and disbursement is
> publicly readable on-chain.
>
> Charter is two things: a `treasury` contract, one instance per
> organization, that holds the actual policy and funds; and a `factory`
> contract that deploys new treasury instances and keeps a public registry
> of every organization using Charter.

## Two contracts, one system

An organization's treasury and the factory that created it do different jobs.

The **treasury** is where an organization's money and rules live. One
treasury belongs to one organization. It holds a single token, tracks that
organization's budget categories and their caps, keeps the approver list and
the approval threshold, and records every disbursement request and its
approvals. Reads and writes for day-to-day operations go straight to the
treasury.

The **factory** deploys treasuries and keeps a registry of them. Every
treasury is deployed from the same reviewed contract code, so an outside
observer can confirm that every organization on Charter runs identical rules.
The factory is the only part of the system involved in creating a treasury;
after that, an organization interacts with its own treasury directly.

## Who this documentation is for

- **Organization admins** set up a treasury, define budget categories, and
  manage the approver set. Start with [Getting Started](for-organization-admins/getting-started.md).
- **Approvers and requesters** submit disbursement requests and sign off on
  them. Start with [Submitting a Request](for-approvers-and-requesters/submitting-a-request.md).
- **Developers and reviewers** evaluating the code will find the contract
  reference under [Smart Contracts](smart-contracts/overview.md) and
  integration details under the [Developer Guide](developer-guide/local-setup.md).

Charter runs on Stellar testnet and has not been audited. It is experimental
software; do not use it to custody real value.
