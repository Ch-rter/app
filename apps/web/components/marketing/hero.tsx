/**
 * Hero — the landing page's opening statement. Two columns on large screens:
 * the headline, subhead, and CTAs on the left; a single card demonstrating the
 * approval-threshold meter on the right. The meter is the page's one animated
 * element (fills once on mount, honours prefers-reduced-motion inside the
 * component). Copy is grounded in the repository's own framing of Charter as an
 * enforcement layer over a bare multisig.
 */
import { CtaButton } from './cta';
import { DOCS_URL } from './links';
import { ThresholdMeter } from './threshold-meter';

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div>
          <h1 className="font-display font-bold leading-[1.05] tracking-[-0.02em] text-[40px] sm:text-[52px] lg:text-[64px]">
            A treasury operations layer for Stellar-based organizations
          </h1>
          <p className="mt-6 max-w-xl text-[20px] leading-snug text-ink/70">
            Budget categories, spend caps, and approval thresholds enforced
            on-chain, instead of a bare multisig.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaButton href="/app" variant="primary" size="md">
              Open the App
            </CtaButton>
            <CtaButton href={DOCS_URL} variant="secondary" size="md" external>
              Read the Docs
            </CtaButton>
          </div>
        </div>

        <div className="rounded-card border-2 border-ink bg-paper-raised p-6 shadow-brutal">
          <p className="font-mono text-[13px] font-medium uppercase tracking-[0.08em] text-ink/70">
            Approval threshold
          </p>
          <ThresholdMeter
            className="mt-4"
            filled={3}
            total={5}
            animate
            label="3 of 5 approvals"
          />
          <p className="mt-4 text-[15px] leading-snug text-ink/70">
            A release executes only once the category&apos;s required approvals
            are collected on-chain.
          </p>
        </div>
      </div>
    </section>
  );
}
