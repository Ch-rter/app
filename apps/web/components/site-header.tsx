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
          className="group inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent-muted text-accent">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M8 1 2 4v4c0 3.3 2.6 6.3 6 7 3.4-.7 6-3.7 6-7V4L8 1zm0 2.2 4 2v2.8c0 2.3-1.7 4.4-4 5-2.3-.6-4-2.7-4-5V5.2l4-2z" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Charter</span>
        </Link>

        <WalletButton />
      </div>
    </header>
  );
}
