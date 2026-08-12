/**
 * Landing-page top navigation: wordmark left, Docs link and the primary
 * "Open the App" button right. Distinct from the dashboard's SiteHeader — no
 * wallet control, light theme, and a hard ink underline framing the bar. Sticky
 * so the app entry point stays reachable while scrolling.
 */
import Link from 'next/link';

import { CtaButton, ExternalLink } from './cta';
import { DOCS_URL } from './links';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-sticky border-b-2 border-ink bg-paper">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
      >
        <Link
          href="/"
          className="rounded-sm font-display text-[20px] font-bold tracking-[-0.01em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          Charter
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <ExternalLink href={DOCS_URL} className="text-[15px] font-medium text-ink">
            Docs
          </ExternalLink>
          <CtaButton href="/app" variant="primary" size="sm">
            Open the App
          </CtaButton>
        </div>
      </nav>
    </header>
  );
}
