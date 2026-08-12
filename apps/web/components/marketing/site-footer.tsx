/**
 * Footer — the one surface that inverts to bg-ink / text-paper (the sole
 * exception to the light theme), set in mono. Groups the outbound links:
 * the app, the docs, both source repos, open issues, and the maintainer.
 *
 * No license is shown: the repository has no LICENSE file, so rather than
 * invent one ("MIT" etc.) the footer omits it entirely. The absence is called
 * out in the PR so a real license can be added deliberately. Focus rings use
 * the paper colour against the ink ground so keyboard focus stays visible.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  DOCS_URL,
  ISSUES_URL,
  MAINTAINER_HANDLE,
  MAINTAINER_URL,
  REPO_APP_URL,
  REPO_CONTRACT_URL,
} from './links';

const LINK_CLASS =
  'inline-flex items-center gap-1 rounded-sm text-[13px] text-paper/75 underline-offset-4 transition-colors hover:text-paper hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink motion-reduce:transition-none';

function FooterLink({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {children}
        <span aria-hidden>↗</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={href} className={LINK_CLASS}>
      {children}
    </Link>
  );
}

function ColumnHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-paper/50">
      {children}
    </h2>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink font-mono text-paper">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="font-display text-[20px] font-bold tracking-[-0.01em] text-paper">
              Charter
            </p>
            <p className="mt-3 max-w-xs text-[13px] leading-snug text-paper/60">
              On-chain treasury policy for Stellar organizations. Never custodies
              funds or keys.
            </p>
          </div>

          <nav aria-label="Product" className="flex flex-col gap-3">
            <ColumnHeading>Product</ColumnHeading>
            <FooterLink href="/app">Open the App</FooterLink>
            <FooterLink href={DOCS_URL} external>
              Docs
            </FooterLink>
          </nav>

          <nav aria-label="Source" className="flex flex-col gap-3">
            <ColumnHeading>Source</ColumnHeading>
            <FooterLink href={REPO_APP_URL} external>
              Application layer
            </FooterLink>
            <FooterLink href={REPO_CONTRACT_URL} external>
              Soroban contracts
            </FooterLink>
            <FooterLink href={ISSUES_URL} external>
              Issues
            </FooterLink>
          </nav>

          <nav aria-label="Project" className="flex flex-col gap-3">
            <ColumnHeading>Project</ColumnHeading>
            <FooterLink href={MAINTAINER_URL} external>
              Maintainer · @{MAINTAINER_HANDLE}
            </FooterLink>
          </nav>
        </div>

        <p className="mt-10 border-t-2 border-paper/15 pt-6 text-[13px] text-paper/50">
          Runs on Stellar testnet. Unaudited, experimental software — not for
          mainnet or real value.
        </p>
      </div>
    </footer>
  );
}
