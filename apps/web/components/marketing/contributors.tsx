/**
 * For-contributors section — sits directly above the footer.
 *
 * Charter's application layer and its Soroban contracts live in separate repos
 * (Ch-rter/app and Ch-rter/contract, both verified against the README and
 * SECURITY.md). The cards link to each repo, to open issues filtered to the
 * real `good first issue` label, and to the README's Contributing section.
 * Every destination is off-site, so each card carries the ↗ convention.
 */
import { CONTRIBUTING_URL, GOOD_FIRST_ISSUES_URL, MAINTAINER_HANDLE, MAINTAINER_URL, REPO_APP_URL, REPO_CONTRACT_URL } from './links';

const CARDS = [
  {
    title: 'Application layer',
    meta: 'github.com/Ch-rter/app',
    body: 'SDK, web dashboard, and event indexer — this repository.',
    href: REPO_APP_URL,
  },
  {
    title: 'Soroban contracts',
    meta: 'github.com/Ch-rter/contract',
    body: 'The on-chain policy contracts every treasury runs on.',
    href: REPO_CONTRACT_URL,
  },
  {
    title: 'Good first issues',
    meta: 'Issues · good first issue',
    body: 'Start here — open issues scoped for a first contribution.',
    href: GOOD_FIRST_ISSUES_URL,
  },
  {
    title: 'Contributing guide',
    meta: 'README · Contributing',
    body: 'Conventions for the two data paths, branch names, and PRs.',
    href: CONTRIBUTING_URL,
  },
] as const;

export function Contributors() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <h2 className="max-w-3xl font-display text-[28px] font-bold leading-tight tracking-[-0.01em]">
        Built in the open
      </h2>
      <p className="mt-4 max-w-2xl text-[20px] leading-snug text-ink/70">
        Charter is open source, maintained by{' '}
        <a
          href={MAINTAINER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm font-medium text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          @{MAINTAINER_HANDLE}
        </a>
        . The application layer and the Soroban contracts live in separate repos.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <a
            key={card.title}
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-card border-2 border-ink bg-paper-raised p-5 shadow-brutal transition-[transform,box-shadow] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-brutal-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper motion-reduce:transition-none"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-[20px] font-bold leading-snug tracking-[-0.01em]">
                {card.title}
              </h3>
              <span aria-hidden className="text-[18px] text-ink/70">
                ↗
              </span>
            </div>
            <p className="mt-1 font-mono text-[13px] text-ink/50">{card.meta}</p>
            <p className="mt-3 text-[16px] leading-snug text-ink/70">{card.body}</p>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ))}
      </div>
    </section>
  );
}
