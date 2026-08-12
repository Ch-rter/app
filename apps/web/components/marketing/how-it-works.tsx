/**
 * How-it-works — the deploy → categories → deposit → request → approve → release
 * flow, grounded in the repository's own description (every step is a Soroban
 * contract call the user's wallet authorizes; Charter never custodies funds).
 *
 * The first four setup steps are compact cards read in order — no 01/02/03
 * markers; sequence is carried by reading order and the copy. The final two
 * steps (collect approvals, release) are paired in a wider card next to a static
 * fully-met ThresholdMeter, so the payoff — funds move only once the threshold
 * clears on-chain — is shown, not just stated.
 */
import { ThresholdMeter } from './threshold-meter';

const SETUP_STEPS = [
  {
    title: 'Deploy a treasury',
    body: 'Spin up a policy-governed treasury through the Charter factory contract — your wallet keeps custody the whole time.',
  },
  {
    title: 'Set budget categories',
    body: 'Divide the treasury into budget categories, each with its own spend limit and approval threshold.',
  },
  {
    title: 'Deposit funds',
    body: 'Move tokens into the treasury contract. Balances live on-chain, not in a spreadsheet.',
  },
  {
    title: 'Request a spend',
    body: 'A member raises a request to move funds out of a category. It stays pending until it clears policy.',
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <h2 className="max-w-3xl font-display text-[28px] font-bold leading-tight tracking-[-0.01em]">
        How Charter works
      </h2>
      <p className="mt-4 max-w-2xl text-[20px] leading-snug text-ink/70">
        From deploying a treasury to releasing funds, every step is a contract
        call authorized by your own wallet.
      </p>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SETUP_STEPS.map((step) => (
          <li
            key={step.title}
            className="rounded-card border-2 border-ink bg-paper-raised p-5 shadow-brutal"
          >
            <h3 className="font-display text-[20px] font-bold leading-snug tracking-[-0.01em]">
              {step.title}
            </h3>
            <p className="mt-2 text-[16px] leading-snug text-ink/70">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-8 rounded-card border-2 border-ink bg-paper-raised p-6 shadow-brutal lg:grid-cols-2 lg:items-center">
        <ol className="flex flex-col gap-5">
          <li>
            <h3 className="font-display text-[20px] font-bold leading-snug tracking-[-0.01em]">
              Collect approvals
            </h3>
            <p className="mt-2 text-[16px] leading-snug text-ink/70">
              Approvers sign off until the category&apos;s approval threshold is
              met — checked by the contract, not by convention.
            </p>
          </li>
          <li>
            <h3 className="font-display text-[20px] font-bold leading-snug tracking-[-0.01em]">
              Release funds
            </h3>
            <p className="mt-2 text-[16px] leading-snug text-ink/70">
              With the threshold met, the transfer executes on-chain. Below it,
              nothing moves.
            </p>
          </li>
        </ol>

        <div className="rounded-card border-2 border-ink bg-paper p-6">
          <p className="font-mono text-[13px] font-medium uppercase tracking-[0.08em] text-ink/70">
            Approval threshold
          </p>
          <ThresholdMeter
            className="mt-4"
            filled={5}
            total={5}
            label="5 of 5 approvals"
          />
          <p className="mt-4 text-[15px] leading-snug text-ink/70">
            Threshold met — the release executes on-chain.
          </p>
        </div>
      </div>
    </section>
  );
}
