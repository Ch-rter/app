'use client';

/**
 * Organization directory: every indexed treasury, newest first.
 *
 * Layout is a table-like row list — not cards. Each row links to the treasury
 * dashboard (built in Step 12). A "New organization" affordance sits in the
 * section header; it links to /new (built in Step 11).
 *
 * Loading: three skeleton rows that mirror the real row height so layout does
 * not jump. Error: full-width error panel with retry. Empty: teaching panel
 * that explains what an org is and offers the creation action.
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { orgsQuery } from '../lib/queries';
import { truncateAddress } from '../lib/format';
import { Skeleton, EmptyState, ErrorState } from './states';
import type { Org } from '../lib/indexer';

export function OrgDirectory() {
  const { data: orgs, isPending, isError, error, refetch } = useQuery(orgsQuery());

  return (
    <section>
      {/* Orientation band: one line on what Charter is, for first-time visitors. */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-canvas-raised px-5 py-4 shadow-inner-highlight">
        <span
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent"
          aria-hidden
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
            <path d="M8 1 2 4v4c0 3.3 2.6 6.3 6 7 3.4-.7 6-3.7 6-7V4L8 1zm0 2.2 4 2v2.8c0 2.3-1.7 4.4-4 5-2.3-.6-4-2.7-4-5V5.2l4-2z" />
          </svg>
        </span>
        <p className="text-sm leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Charter</span> is a treasury operations
          layer for Stellar organizations. Set budget caps, route disbursements through
          approvals, and settle on-chain.
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Organizations</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Stellar treasuries indexed on-chain
          </p>
        </div>
        <Link
          href="/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-accent-hover active:translate-y-[0.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New organization
        </Link>
      </div>

      {isPending && <OrgListSkeleton />}

      {isError && (
        <ErrorState
          body={
            error instanceof Error
              ? error.message
              : 'The organization list could not be loaded.'
          }
          onRetry={() => void refetch()}
        />
      )}

      {!isPending && !isError && orgs.length === 0 && (
        <EmptyState
          title="No organizations yet"
          body="Deploy a treasury contract to create your first organization. Each org gets its own budget categories and approval workflow."
          action={
            <Link
              href="/new"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-accent-hover active:translate-y-[0.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Create organization
            </Link>
          }
        />
      )}

      {!isPending && !isError && orgs.length > 0 && (
        <OrgList orgs={orgs} />
      )}
    </section>
  );
}

function OrgList({ orgs }: { orgs: Org[] }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised shadow-inner-highlight">
      {orgs.map((org) => (
        <OrgRow key={org.id} org={org} />
      ))}
    </ul>
  );
}

function OrgRow({ org }: { org: Org }) {
  return (
    <li>
      <Link
        href={`/org/${org.treasuryAddress}`}
        className="group flex items-center gap-4 px-6 py-5 transition-colors duration-150 hover:bg-canvas-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent first:rounded-t-xl last:rounded-b-xl"
      >
        {/* Org initial avatar */}
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-sm font-semibold text-accent"
          aria-hidden
        >
          {org.name.charAt(0).toUpperCase()}
        </span>

        {/* Name + admin */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink group-hover:text-accent transition-colors duration-150">
            {org.name}
          </p>
          <p className="mt-0.5 font-mono text-xs text-ink-faint">
            {truncateAddress(org.adminAddress)}
          </p>
        </div>

        {/* On-chain identifiers: treasury address and the ledger it was created at. */}
        <div className="hidden flex-col items-end gap-0.5 text-right sm:flex">
          <span className="font-mono text-xs text-ink-muted">
            {truncateAddress(org.treasuryAddress)}
          </span>
          <span className="font-mono text-[11px] text-ink-faint">
            Ledger {org.createdLedger}
          </span>
        </div>

        {/* Chevron */}
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5"
          fill="none"
          aria-hidden
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </li>
  );
}

function OrgListSkeleton() {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised shadow-inner-highlight">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-6 py-5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
          <Skeleton className="hidden h-3 w-24 rounded sm:block" />
        </li>
      ))}
    </ul>
  );
}
