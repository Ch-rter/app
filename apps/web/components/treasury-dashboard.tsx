'use client';

/**
 * Treasury dashboard — the operating view for a single organization.
 *
 * Three data sources converge here:
 *   - the indexer's org metadata (name, admin) — {@link orgQuery}
 *   - the treasury's live on-chain balance — {@link balanceQuery} (a free read)
 *   - the indexer's budget categories with cap/spent — {@link categoriesQuery}
 *
 * Amounts are raw i128 strings throughout; every display value passes through
 * {@link formatAmount} so the full range survives without a float. Categories
 * render as rows (not cards), each showing a cap-usage bar built from bigint
 * math. Admin-only actions (create/edit categories) arrive in Step 13; this
 * view is read-only.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { orgQuery, categoriesQuery, balanceQuery } from '../lib/queries';
import { formatAmount, cn } from '../lib/format';
import type { Category, Org } from '../lib/indexer';
import { useWalletStore } from '../store/wallet';
import { CopyAddress } from './copy-address';
import { CategoryFormModal } from './category-form-modal';
import { CategoryAdminActions } from './category-admin-actions';
import { PrimaryButton } from './form';
import { Skeleton, EmptyState, ErrorState } from './states';

// ---------------------------------------------------------------------------
// Bigint-safe cap usage
// ---------------------------------------------------------------------------

/**
 * Fraction of a category's cap that has been spent, as a 0–100 percentage.
 * Computed with bigint math (scaled by 10_000 for two decimals of precision)
 * so no i128 value is ever coerced to a float. A zero or absent cap yields 0.
 */
function usagePercent(cap: string, spent: string): number {
  let capInt: bigint;
  let spentInt: bigint;
  try {
    capInt = BigInt(cap);
    spentInt = BigInt(spent);
  } catch {
    return 0;
  }
  if (capInt <= 0n) return 0;
  const scaled = (spentInt * 10_000n) / capInt;
  const pct = Number(scaled) / 100;
  return Math.min(100, Math.max(0, pct));
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function TreasuryDashboard({ treasury }: { treasury: string }) {
  const org = useQuery(orgQuery(treasury));
  const balance = useQuery(balanceQuery(treasury));
  const categories = useQuery(categoriesQuery(treasury));

  // The connected wallet is the admin only when it exactly matches the org's
  // on-chain admin address. Admin-only affordances (create/edit/pause) are
  // gated on this — the contract enforces it regardless, but the UI shouldn't
  // offer actions that will be rejected.
  const address = useWalletStore((s) => s.address);
  const adminAddress = org.data?.adminAddress ?? null;
  const isAdmin = address !== null && adminAddress !== null && address === adminAddress;

  return (
    <div className="space-y-8">
      <nav>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded text-sm text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All organizations
        </Link>
      </nav>

      <OrgHeader treasury={treasury} org={org} />

      <BalancePanel balance={balance} />

      <CategoriesSection
        categories={categories}
        treasuryId={treasury}
        admin={adminAddress}
        isAdmin={isAdmin}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header — org identity
// ---------------------------------------------------------------------------

function OrgHeader({
  treasury,
  org,
}: {
  treasury: string;
  org: UseQueryResult<Org>;
}) {
  if (org.isPending) {
    return (
      <header className="space-y-3">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded" />
      </header>
    );
  }

  if (org.isError) {
    return (
      <ErrorState
        title="Could not load this organization"
        body={errorText(org.error, 'The organization could not be loaded from the indexer.')}
        onRetry={() => void org.refetch()}
      />
    );
  }

  return (
    <header className="flex items-start gap-4">
      <span
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-lg font-semibold text-accent"
        aria-hidden
      >
        {org.data.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 space-y-2">
        <h1 className="truncate text-2xl font-semibold text-ink">{org.data.name}</h1>
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <div className="flex items-center gap-2">
            <dt className="text-ink-faint">Treasury</dt>
            <dd>
              <CopyAddress address={treasury} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-ink-faint">Admin</dt>
            <dd>
              <CopyAddress address={org.data.adminAddress} />
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

function BalancePanel({
  balance,
}: {
  balance: UseQueryResult<string>;
}) {
  return (
    <section className="rounded-xl border border-line bg-canvas-raised px-6 py-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        Treasury balance
      </p>
      <div className="mt-2">
        {balance.isPending && <Skeleton className="h-9 w-40 rounded-lg" />}

        {balance.isError && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-danger">
              {errorText(balance.error, 'The on-chain balance is currently unavailable.')}
            </p>
            <button
              type="button"
              onClick={() => void balance.refetch()}
              className="rounded-md text-xs font-medium text-accent transition-colors duration-150 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Retry
            </button>
          </div>
        )}

        {balance.isSuccess && (
          <p className="font-mono text-3xl font-semibold tabular-nums text-ink">
            {formatAmount(balance.data)}
          </p>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">Live from the treasury contract.</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function CategoriesSection({
  categories,
  treasuryId,
  admin,
  isAdmin,
}: {
  categories: UseQueryResult<Category[]>;
  treasuryId: string;
  admin: string | null;
  isAdmin: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const canManage = isAdmin && admin !== null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">Budget categories</h2>
        {canManage && (
          <PrimaryButton onClick={() => setCreating(true)}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            New category
          </PrimaryButton>
        )}
      </div>

      {categories.isPending && <CategoriesSkeleton />}

      {categories.isError && (
        <ErrorState
          title="Could not load categories"
          body={errorText(categories.error, "This treasury's categories could not be loaded.")}
          onRetry={() => void categories.refetch()}
        />
      )}

      {categories.isSuccess && categories.data.length === 0 && (
        <EmptyState
          title="No categories yet"
          body="Budget categories cap how much each part of the org can disburse. The admin creates them; requests draw against them."
          action={
            canManage ? (
              <PrimaryButton onClick={() => setCreating(true)}>Create category</PrimaryButton>
            ) : undefined
          }
        />
      )}

      {categories.isSuccess && categories.data.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised">
          {categories.data.map((category) => (
            <CategoryRow
              key={category.categoryId}
              category={category}
              treasuryId={treasuryId}
              admin={admin}
              canManage={canManage}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <CategoryFormModal
          open={creating}
          onClose={() => setCreating(false)}
          treasuryId={treasuryId}
          admin={admin}
          mode={{ kind: 'create' }}
        />
      )}
    </section>
  );
}

function CategoryRow({
  category,
  treasuryId,
  admin,
  canManage,
}: {
  category: Category;
  treasuryId: string;
  admin: string | null;
  canManage: boolean;
}) {
  const pct = usagePercent(category.cap, category.spent);
  const nearCap = pct >= 90;

  return (
    <li className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-ink">{category.name}</span>
          {!category.active && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              Paused
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="font-mono text-xs tabular-nums text-ink-muted">
            <span className={cn(nearCap ? 'text-warn' : 'text-ink')}>
              {formatAmount(category.spent)}
            </span>
            <span className="text-ink-faint"> / {formatAmount(category.cap)}</span>
          </p>
          {canManage && admin !== null && (
            <CategoryAdminActions treasuryId={treasuryId} admin={admin} category={category} />
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas-overlay"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${category.name} cap usage`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none',
              nearCap ? 'bg-warn' : 'bg-accent',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-ink-faint">
          {Math.round(pct)}%
        </span>
      </div>
    </li>
  );
}

function CategoriesSkeleton() {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="space-y-2.5 px-5 py-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </li>
      ))}
    </ul>
  );
}
