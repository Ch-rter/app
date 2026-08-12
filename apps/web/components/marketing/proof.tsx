/**
 * Proof section — the honest counterweight to the pitch.
 *
 * The factory contract id is read from NEXT_PUBLIC_FACTORY_CONTRACT_ID at
 * build/render time (a public, build-inlined value — never a live fetch, and
 * never the throwing factoryContractId() accessor). When set it links to the
 * contract on Stellar Expert (testnet) so a visitor can verify the deployment
 * themselves; when blank the section says so plainly and points at read-only
 * browse mode, matching the README.
 *
 * The always-visible testnet/unaudited/experimental badge restates SECURITY.md
 * verbatim in spirit ("Charter has not been audited", "Stellar testnet only",
 * "Treat every deployment as experimental testnet software"). The meter here is
 * explicitly illustrative — no real default-threshold value is exposed at build
 * time, so it stands in as an example of what a satisfied policy looks like on
 * the contract itself.
 */
import { ThresholdMeter } from './threshold-meter';

export function Proof() {
  const factoryId = process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID?.trim() ?? '';
  const explorerUrl = factoryId
    ? `https://stellar.expert/explorer/testnet/contract/${factoryId}`
    : null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <span className="inline-flex items-center rounded-pill border-2 border-ink bg-flag-red px-4 py-1.5 text-[13px] font-medium text-paper">
        Runs on Stellar testnet. Unaudited. Experimental.
      </span>

      <h2 className="mt-6 max-w-3xl font-display text-[28px] font-bold leading-tight tracking-[-0.01em]">
        See it on-chain
      </h2>
      <p className="mt-4 max-w-2xl text-[20px] leading-snug text-ink/70">
        The factory every treasury is deployed through is public on Stellar
        testnet — verify the deployment in a block explorer, not a screenshot.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border-2 border-ink bg-paper-raised p-6 shadow-brutal">
          <p className="font-mono text-[13px] font-medium uppercase tracking-[0.08em] text-ink/70">
            Factory contract
          </p>

          {explorerUrl ? (
            <>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-start gap-1 rounded-sm font-mono text-[15px] leading-snug text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                <span className="break-all">{factoryId}</span>
                <span aria-hidden>↗</span>
                <span className="sr-only">
                  {' '}
                  (view on Stellar Expert, opens in a new tab)
                </span>
              </a>
              <p className="mt-4 text-[15px] leading-snug text-ink/70">
                Open it on Stellar Expert to inspect every treasury this factory
                has deployed.
              </p>
            </>
          ) : (
            <p className="mt-3 font-mono text-[15px] leading-snug text-ink/70">
              Not configured in this build — Charter runs in read-only browse
              mode until NEXT_PUBLIC_FACTORY_CONTRACT_ID points at a deployed
              factory.
            </p>
          )}
        </div>

        <div className="rounded-card border-2 border-ink bg-paper-raised p-6 shadow-brutal">
          <p className="font-mono text-[13px] font-medium uppercase tracking-[0.08em] text-ink/70">
            Example policy state
          </p>
          <ThresholdMeter
            className="mt-4"
            filled={5}
            total={5}
            label="5 of 5 approvals"
          />
          <p className="mt-4 text-[15px] leading-snug text-ink/70">
            Illustrative — real approval thresholds are set per category on the
            contract itself.
          </p>
        </div>
      </div>
    </section>
  );
}
