/**
 * Problem section — establishes the stakes before the how-it-works walk.
 *
 * The heading states the scale claim generally; three stat cards give concrete
 * (publicly reported, illustrative) examples of on-chain treasury size. These
 * figures are third-party and volatile — they are framed as illustrative here
 * and are NOT presented as Charter's own live data. The closing line turns the
 * scale into the problem: today's tooling reports after the fact rather than
 * enforcing policy at the moment funds move.
 *
 * The dollar figures are unverified against the repository (they came from the
 * build brief) and are flagged for sourcing/dating in the PR.
 */
const STATS = [
  { figure: '$4.8B', org: 'Uniswap' },
  { figure: '$200M+', org: 'Optimism' },
  { figure: '$40M–$200M', org: 'Arbitrum' },
] as const;

export function Problem() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <h2 className="max-w-3xl font-display text-[28px] font-bold leading-tight tracking-[-0.01em]">
        Organizations already run treasuries worth hundreds of millions — sometimes
        billions — on-chain.
      </h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {STATS.map((stat) => (
          <div
            key={stat.org}
            className="rounded-card border-2 border-ink bg-paper-raised p-6 shadow-brutal"
          >
            <p className="font-display text-[40px] font-bold leading-none tracking-[-0.02em]">
              {stat.figure}
            </p>
            <p className="mt-3 text-[13px] font-medium uppercase tracking-[0.08em] text-ink/60">
              {stat.org}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 font-mono text-[13px] text-ink/50">
        Publicly reported DAO treasuries · illustrative
      </p>

      <p className="mt-8 max-w-2xl text-[20px] leading-snug text-ink/80">
        Today that money is tracked with after-the-fact reporting — not policy
        enforced at the moment funds move.
      </p>
    </section>
  );
}
