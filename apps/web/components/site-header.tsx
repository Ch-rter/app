'use client';

/**
 * Top navigation bar. Persistent across every route: wordmark on the left,
 * wallet control on the right. Sticky so the account stays reachable while
 * scrolling long request lists.
 */
import Link from 'next/link';

import { WalletButton } from './wallet-button';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-sticky border-b-2 border-ink bg-paper-raised">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          href="/app"
          className="group inline-flex items-center gap-2.5 rounded-badge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-badge border-2 border-ink bg-ledger-gold font-display text-base text-ink shadow-[2px_2px_0_#14171F] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:translate-y-0.5">
            C
          </span>
          <span className="font-display text-lg text-ink">Charter</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/app"
            className="hidden min-h-10 items-center rounded-card border-2 border-ink bg-ledger-gold px-4 text-sm font-medium text-ink shadow-brutal transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#E2B84F] hover:text-ink hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-brutal-pressed active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised sm:inline-flex"
          >
            Organizations
          </Link>
          <a
            href="https://chusdrter.gitbook.io/chusdrter-docs"
            target="_blank"
            rel="noreferrer"
            className="hidden min-h-10 items-center rounded-card border-2 border-ink bg-paper-raised px-4 text-sm font-medium text-ink shadow-brutal transition-[background-color,box-shadow,transform] duration-150 hover:bg-ledger-gold/25 hover:text-ink hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-brutal-pressed active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised sm:inline-flex"
          >
            Docs <span aria-hidden className="ml-1">↗</span>
          </a>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
