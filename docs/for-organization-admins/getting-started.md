# Getting Started

This section is for the person who sets up an organization on Charter: you
deploy the treasury, define who can approve spending, and set the rule for how
many approvals a disbursement needs. You do not need to write code. You do need
a Stellar wallet and some testnet funds.

## What you need first

- **A Stellar wallet** that Charter can connect to through the wallet dialog —
  Freighter is the common choice on testnet. You connect it with the **Connect
  wallet** button in the top right.
- **Testnet XLM** in that wallet to pay transaction fees. On testnet you can
  fund an account from the Stellar friendbot for free.
- **A token address** for the asset the treasury will hold and pay out. This is
  a Stellar Asset Contract (SAC) address — a `C…` contract address, or the `G…`
  issuer form the form also accepts. The treasury holds and disburses this one
  token.
- **The addresses of your approvers.** These are the people who sign off on
  disbursements. Have their `G…` addresses ready. Your own connected wallet is
  added as the first approver automatically; you can add more.

## Deploying your treasury

From the home page, choose **New organization**. If your wallet is not
connected yet, the page tells you so — "Connect your wallet to create an
organization" — and you connect first.

The deploy form (the page header reads: *"Deploy a treasury contract. You'll be
its admin, and the approver set you define governs every disbursement."*) has
four things to fill in:

- **Organization name** — a plain label, e.g. `Acme Treasury`. This is stored
  on-chain in the factory's org record and shown in the public directory.
- **Token address** — the SAC token address this treasury holds and disburses.
  Enter the `C…` (or `G…`) address of your asset.
- **Approvers** — the addresses that can approve or reject disbursement
  requests. Your connected wallet is pre-filled as the first approver. Use **Add
  approver** to add more. These are the only accounts that will be able to
  approve or reject; choose them deliberately, because changing the set later is
  itself an admin action on-chain.
- **Approval threshold** — how many approvers must sign off before a request
  executes. The form phrases it as "of N approvers," where N is the number of
  approver rows you have filled. A threshold of 2 with 2 approvers means both
  must approve.

Submit with **Deploy treasury**. The button shows "Deploying…" while the
transaction is in flight.

### This transaction needs two signatures

Deploying goes through the factory contract, and it asks your wallet to sign
**twice** in one flow. That is expected, not a bug. The factory authorizes you
as the deployer, and the new treasury's own `initialize` step requires the
admin — you — to authorize it as a sub-call. Approve both prompts. If you only
approve the first, the deploy will not complete.

When it finishes, Charter sends you to your new organization's page at
`/org/<treasury address>`. That address is your treasury; bookmark it.

## What you are now

The wallet you deployed with is the treasury's **admin**. Being admin is what
lets you create budget categories, adjust caps, pause and resume categories, and
change the approver list and threshold. Approvers (including you, since you were
added as the first approver) can approve and reject requests. Anyone at all can
read the treasury's state — balances, categories, and every request — because it
all lives on-chain and the indexer serves it publicly.

The next page, [Setting Up Categories and
Approvers](setting-up-categories-and-approvers.md), covers the admin actions you
will take right after deploying: creating the categories money is spent against,
and adjusting the approver set.
