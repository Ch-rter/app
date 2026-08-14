'use client';

/**
 * Treasury dashboard — the operating view for a single organization.
 *
 * Four data sources converge here:
 *   - the indexer's org metadata (name, admin) — {@link orgQuery}
 *   - the treasury's live on-chain balance — {@link balanceQuery} (a free read)
 *   - the indexer's budget categories with cap/spent — {@link categoriesQuery}
 *   - the indexer's disbursement requests — {@link requestsQuery}
 *
 * Amounts are raw i128 strings throughout; every display value passes through
 * {@link formatAmount} so the full range survives without a float. Categories
 * and requests render as rows (not cards). Admin-only category actions and the
 * member submit-request flow are gated on the connected wallet; the contract
 * enforces authorization regardless.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  orgQuery,
  categoriesQuery,
  balanceQuery,
  requestsQuery,
  thresholdQuery,
  approversQuery,
} from '../lib/queries';
import { formatAmount, truncateAddress, cn } from '../lib/format';
import type { Category, Org, Request } from '../lib/indexer';
import { useWalletStore } from '../store/wallet';
import { CopyAddress } from './copy-address';
import { CategoryFormModal } from './category-form-modal';
import { CategoryAdminActions } from './category-admin-actions';
import { SubmitRequestModal } from './submit-request-modal';
import { RequestStatusBadge } from './request-status-badge';
import { RequestActions } from './request-actions';
import { ApprovalProgress } from './approval-progress';
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

/**
 * Each category's cap as a percentage of the summed caps across all categories,
 * for the allocation overview bar. Bigint math throughout (scaled by 10_000)
 * so no i128 cap is coerced to a float. Categories with a non-positive or
 * unparseable cap contribute nothing. Returns an empty array when the total is
 * zero, so callers can withhold the bar entirely.
 */
function allocationSegments(
  categories: Category[],
): Array<{ categoryId: number; name: string; pct: number; active: boolean }> {
  const withCaps = categories.map((c) => {
    let cap: bigint;
    try {
      const v = BigInt(c.cap);
      cap = v > 0n ? v : 0n;
    } catch {
      cap = 0n;
    }
    return { category: c, cap };
  });
  const total = withCaps.reduce((sum, { cap }) => sum + cap, 0n);
  if (total <= 0n) return [];

  return withCaps
    .map(({ category, cap }) => ({
      categoryId: category.categoryId,
      name: category.name,
      active: category.active,
      pct: Math.max(0, Number((cap * 10_000n) / total) / 100),
    }))
    .filter((s) => s.pct > 0);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function TreasuryDashboard({ treasury }: { treasury: string }) {
  const org = useQuery(orgQuery(treasury));
  const balance = useQuery(balanceQuery(treasury));
  const categories = useQuery(categoriesQuery(treasury));
  const requests = useQuery(requestsQuery(treasury));
  const threshold = useQuery(thresholdQuery(treasury));
  const approvers = useQuery(approversQuery(treasury));

  // The connected wallet is the admin only when it exactly matches the org's
  // on-chain admin address. Admin-only affordances (create/edit/pause) are
  // gated on this — the contract enforces it regardless, but the UI shouldn't
  // offer actions that will be rejected.
  const address = useWalletStore((s) => s.address);
  const adminAddress = org.data?.adminAddress ?? null;
  const isAdmin = address !== null && adminAddress !== null && address === adminAddress;

  return (
    <div className="space-y-12">
      <nav>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-badge border-2 border-ink bg-paper-raised px-3 py-2 text-sm font-medium text-ink shadow-[2px_2px_0_#14171F] transition-[background-color,box-shadow,transform] duration-150 hover:bg-canvas-overlay hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All organizations
        </Link>
      </nav>

      <OrgHeader treasury={treasury} org={org} />

      <BalancePanel
        balance={balance}
        categoryCount={categories.data?.length ?? null}
        pendingCount={
          requests.data ? requests.data.filter((r) => r.status === 'Pending').length : null
        }
        threshold={threshold.data ?? null}
        approverCount={approvers.data?.length ?? null}
      />

      <CategoriesSection
        categories={categories}
        treasuryId={treasury}
        admin={adminAddress}
        isAdmin={isAdmin}
      />

      <RequestsSection
        requests={requests}
        categories={categories}
        treasuryId={treasury}
        requester={address}
        threshold={threshold.data ?? null}
        approvers={approvers.data ?? []}
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
    <header className="flex items-start gap-4 border-b-2 border-ink pb-8">
      <span
        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-card border-2 border-ink bg-ledger-gold font-display text-xl text-ink shadow-brutal"
        aria-hidden
      >
        {org.data.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 space-y-2">
        <h1 className="truncate font-display text-4xl leading-none text-ink">{org.data.name}</h1>
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
  categoryCount,
  pendingCount,
  threshold,
  approverCount,
}: {
  balance: UseQueryResult<string>;
  categoryCount: number | null;
  pendingCount: number | null;
  threshold: number | null;
  approverCount: number | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-canvas-raised to-canvas-raised/95 px-6 py-6 shadow-inner-highlight">
      {/* Decorative accent glow behind the figure. Collapses under reduced-transparency. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.12),transparent_70%)] blur-2xl [@media(prefers-reduced-transparency:reduce)]:hidden"
      />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Treasury balance
        </p>
        <div className="mt-2">
          {balance.isPending && <Skeleton className="h-11 w-52 rounded-lg" />}

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
            <p className="font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums text-ink">
              {formatAmount(balance.data)}
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">Live from the treasury contract.</p>

        {/* At-a-glance treasury state. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <SummaryChip label="categories" value={categoryCount} />
          <SummaryChip
            label={pendingCount === 1 ? 'pending request' : 'pending requests'}
            value={pendingCount}
            tone={pendingCount !== null && pendingCount > 0 ? 'info' : 'neutral'}
          />
          <SummaryChip
            label="approvals required"
            value={threshold}
            suffix={approverCount !== null ? ` of ${approverCount}` : undefined}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * A compact stat pill for the balance hero: a mono figure plus a label. Shows a
 * skeleton in place of the figure while the value is still loading (null).
 */
function SummaryChip({
  value,
  label,
  suffix,
  tone = 'neutral',
}: {
  value: number | null;
  label: string;
  suffix?: string;
  tone?: 'neutral' | 'info';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs',
        tone === 'info'
          ? 'border-info/30 bg-info/10 text-info'
          : 'border-line bg-canvas-overlay text-ink-muted',
      )}
    >
      {value === null ? (
        <Skeleton className="h-3 w-4 rounded" />
      ) : (
        <span
          className={cn(
            'font-mono font-medium tabular-nums',
            tone === 'info' ? 'text-info' : 'text-ink',
          )}
        >
          {value}
          {suffix ?? ''}
        </span>
      )}
      <span>{label}</span>
    </span>
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
        <AllocationBar categories={categories.data} />
      )}

      {categories.isSuccess && categories.data.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised shadow-inner-highlight">
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

/**
 * A slim horizontal stacked bar showing how the total budget is committed
 * across categories — cap proportions, not spend. Purely additive context above
 * the detailed rows; withheld entirely when no category carries a positive cap.
 * Paused categories read at reduced opacity so the eye lands on live budget.
 */
function AllocationBar({ categories }: { categories: Category[] }) {
  const segments = allocationSegments(categories);
  if (segments.length === 0) return null;

  // A small fixed cycle of accent-family tints keeps adjacent segments legible
  // without introducing a second hue — the palette stays teal end to end.
  const tints = ['bg-accent', 'bg-accent/70', 'bg-accent/45', 'bg-info/60', 'bg-info/40'];

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-canvas-overlay shadow-inner-highlight">
        {segments.map((seg, i) => (
          <div
            key={seg.categoryId}
            className={cn(
              'h-full first:rounded-l-full last:rounded-r-full',
              tints[i % tints.length],
              !seg.active && 'opacity-40',
            )}
            style={{ width: `${seg.pct}%` }}
            title={`${seg.name} · ${Math.round(seg.pct)}% of budget`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg, i) => (
          <span key={seg.categoryId} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <span className={cn('h-2 w-2 rounded-full', tints[i % tints.length], !seg.active && 'opacity-40')} aria-hidden />
            {seg.name}
            <span className="font-mono tabular-nums text-ink-faint">{Math.round(seg.pct)}%</span>
          </span>
        ))}
      </div>
    </div>
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
    <li className="px-6 py-5">
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
          className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-overlay shadow-inner-highlight"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${category.name} cap usage`}
        >
          <div
            className={cn(
              'h-full rounded-full bg-gradient-to-r transition-[width] duration-300 ease-out motion-reduce:transition-none',
              nearCap
                ? 'from-warn to-warn shadow-glow-warn'
                : 'from-accent to-accent-hover',
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
    <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised shadow-inner-highlight">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="space-y-2.5 px-6 py-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

function RequestsSection({
  requests,
  categories,
  treasuryId,
  requester,
  threshold,
  approvers,
}: {
  requests: UseQueryResult<Request[]>;
  categories: UseQueryResult<Category[]>;
  treasuryId: string;
  requester: string | null;
  threshold: number | null;
  approvers: string[];
}) {
  const [creating, setCreating] = useState(false);

  // A request can only be raised by a connected wallet against an active
  // category. When either is missing the submit affordance is withheld — the
  // contract would reject the call regardless.
  const activeCategories = (categories.data ?? []).filter((c) => c.active);
  const canSubmit = requester !== null && activeCategories.length > 0;

  // Whether the connected wallet is an approver on this treasury drives which
  // per-request actions (approve/reject) are offered.
  const isApprover = requester !== null && approvers.includes(requester);

  // Category names for row labels, resolved from the categories query.
  const categoryName = (categoryId: number): string =>
    categories.data?.find((c) => c.categoryId === categoryId)?.name ?? `Category ${categoryId}`;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">Requests</h2>
        {canSubmit && (
          <PrimaryButton onClick={() => setCreating(true)}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            New request
          </PrimaryButton>
        )}
      </div>

      {requests.isPending && <RequestsSkeleton />}

      {requests.isError && (
        <ErrorState
          title="Could not load requests"
          body={errorText(requests.error, "This treasury's requests could not be loaded.")}
          onRetry={() => void requests.refetch()}
        />
      )}

      {requests.isSuccess && requests.data.length === 0 && (
        <EmptyState
          title="No requests yet"
          body="Requests propose a disbursement against a category. They stay pending until approvers reach the treasury's threshold, then execute on-chain."
          action={
            canSubmit ? (
              <PrimaryButton onClick={() => setCreating(true)}>New request</PrimaryButton>
            ) : undefined
          }
        />
      )}

      {requests.isSuccess && requests.data.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised shadow-inner-highlight">
          {requests.data.map((request) => (
            <RequestRow
              key={request.requestId}
              request={request}
              categoryName={categoryName(request.categoryId)}
              treasuryId={treasuryId}
              walletAddress={requester}
              isApprover={isApprover}
              threshold={threshold}
            />
          ))}
        </ul>
      )}

      {requester !== null && (
        <SubmitRequestModal
          open={creating}
          onClose={() => setCreating(false)}
          treasuryId={treasuryId}
          requester={requester}
          categories={categories.data ?? []}
        />
      )}
    </section>
  );
}

function RequestRow({
  request,
  categoryName,
  treasuryId,
  walletAddress,
  isApprover,
  threshold,
}: {
  request: Request;
  categoryName: string;
  treasuryId: string;
  walletAddress: string | null;
  isApprover: boolean;
  threshold: number | null;
}) {
  const isPending = request.status === 'Pending';

  return (
    <li className="flex items-center justify-between gap-4 px-6 py-5">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/org/${treasuryId}/requests/${request.requestId}`}
            className="truncate rounded text-sm font-medium text-ink transition-colors duration-150 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {categoryName}
          </Link>
          <RequestStatusBadge status={request.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
          <span>
            To <span className="font-mono text-ink-faint">{truncateAddress(request.recipient, 6, 6)}</span>
          </span>
          {request.memo.trim() !== '' && (
            <>
              <span aria-hidden className="text-ink-faint">·</span>
              <span className="truncate">{request.memo}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-sm font-medium tabular-nums text-ink">
            {formatAmount(request.amount)}
          </span>
          {isPending && (
            <ApprovalProgress approvals={request.approvals.length} threshold={threshold} />
          )}
        </div>

        {isPending && walletAddress !== null && (
          <RequestActions
            treasuryId={treasuryId}
            requestId={request.requestId}
            requester={request.requester}
            approvals={request.approvals}
            walletAddress={walletAddress}
            isApprover={isApprover}
          />
        )}
      </div>
    </li>
  );
}

function RequestsSkeleton() {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-canvas-raised shadow-inner-highlight">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center justify-between px-6 py-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-52 rounded" />
          </div>
          <Skeleton className="h-4 w-20 rounded" />
        </li>
      ))}
    </ul>
  );
}
