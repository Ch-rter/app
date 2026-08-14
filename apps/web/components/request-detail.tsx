'use client';

/**
 * Request detail — the full view of a single disbursement request.
 *
 * Four reads converge: the request itself (indexer), the treasury's approval
 * threshold and approver set (live on-chain), and the parent category (indexer,
 * for a human label). Together they drive the approval-progress meter and the
 * approver roster, which shows every approver and whether they've signed yet.
 *
 * The same approve / reject / cancel controls from the dashboard row are offered
 * here on a pending request, gated on the connected wallet's role. Amounts are
 * raw i128 strings formatted bigint-safe; the request id arrives as a route
 * string and is parsed to a number before any query runs.
 */
import Link from 'next/link';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  requestQuery,
  thresholdQuery,
  approversQuery,
  categoriesQuery,
} from '../lib/queries';
import { formatAmount, cn } from '../lib/format';
import type { Category, Request } from '../lib/indexer';
import { useWalletStore } from '../store/wallet';
import { CopyAddress } from './copy-address';
import { RequestStatusBadge } from './request-status-badge';
import { ApprovalProgress } from './approval-progress';
import { RequestActions } from './request-actions';
import { Skeleton, ErrorState } from './states';

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function RequestDetail({
  treasury,
  requestId,
}: {
  treasury: string;
  requestId: string;
}) {
  // The id is part of the URL; a non-numeric segment can't map to a request.
  const parsedId = Number(requestId);
  const idValid = Number.isInteger(parsedId) && parsedId >= 0;

  const request = useQuery({ ...requestQuery(treasury, parsedId), enabled: idValid });
  const threshold = useQuery(thresholdQuery(treasury));
  const approvers = useQuery(approversQuery(treasury));
  const categories = useQuery(categoriesQuery(treasury));

  const address = useWalletStore((s) => s.address);

  const backLink = (
    <nav>
      <Link
        href={`/org/${treasury}`}
        className="inline-flex items-center gap-1.5 rounded-badge border-2 border-ink bg-paper-raised px-3 py-2 text-sm font-medium text-ink shadow-[2px_2px_0_#14171F] transition-[background-color,box-shadow,transform] duration-150 hover:bg-canvas-overlay hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to organization
      </Link>
    </nav>
  );

  if (!idValid) {
    return (
      <div className="space-y-8">
        {backLink}
        <ErrorState
          title="Request not found"
          body={`"${requestId}" is not a valid request id.`}
          onRetry={() => void 0}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {backLink}

      {request.isPending && <RequestDetailSkeleton />}

      {request.isError && (
        <ErrorState
          title="Could not load this request"
          body={errorText(request.error, 'The request could not be loaded from the indexer.')}
          onRetry={() => void request.refetch()}
        />
      )}

      {request.isSuccess && (
        <RequestBody
          request={request.data}
          treasury={treasury}
          walletAddress={address}
          threshold={threshold}
          approvers={approvers}
          categories={categories}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loaded request
// ---------------------------------------------------------------------------

function RequestBody({
  request,
  treasury,
  walletAddress,
  threshold,
  approvers,
  categories,
}: {
  request: Request;
  treasury: string;
  walletAddress: string | null;
  threshold: UseQueryResult<number>;
  approvers: UseQueryResult<string[]>;
  categories: UseQueryResult<Category[]>;
}) {
  const isPending = request.status === 'Pending';
  const approverList = approvers.data ?? [];
  const isApprover = walletAddress !== null && approverList.includes(walletAddress);

  const categoryName =
    categories.data?.find((c) => c.categoryId === request.categoryId)?.name ??
    `Category ${request.categoryId}`;

  return (
    <div className="space-y-8">
      {/* Header — identity and headline amount */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-4xl leading-none text-ink">Request #{request.requestId}</h1>
            <RequestStatusBadge status={request.status} />
          </div>
          <p className="text-sm text-ink-muted">
            Against <span className="text-ink">{categoryName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl font-medium tabular-nums text-ink">
            {formatAmount(request.amount)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">Disbursement amount</p>
        </div>
      </header>

      {/* Detail fields */}
      <section className="overflow-hidden rounded-card border-2 border-ink bg-paper-raised shadow-brutal">
        <dl className="divide-y-2 divide-ink">
          <DetailRow label="Recipient">
            <CopyAddress address={request.recipient} />
          </DetailRow>
          <DetailRow label="Requested by">
            <CopyAddress address={request.requester} />
          </DetailRow>
          <DetailRow label="Memo">
            {request.memo.trim() === '' ? (
              <span className="text-ink-faint">None</span>
            ) : (
              <span className="text-ink">{request.memo}</span>
            )}
          </DetailRow>
          <DetailRow label="Created">
            <span className="font-mono tabular-nums text-ink-muted">
              Ledger {request.createdLedger.toLocaleString()}
            </span>
          </DetailRow>
        </dl>
      </section>

      {/* Approvals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl text-ink">Approvals</h2>
          <ApprovalProgress
            approvals={request.approvals.length}
            threshold={threshold.data ?? null}
          />
        </div>

        <ApproverRoster
          approvers={approvers}
          approved={request.approvals}
          requester={request.requester}
        />

        {isPending && walletAddress !== null && (
          <div className="flex flex-col items-stretch justify-end gap-4 rounded-card border-2 border-ink bg-ledger-gold/25 px-5 py-4 shadow-brutal sm:flex-row sm:items-center">
            <span className="mr-auto text-sm text-ink-muted">
              {isApprover
                ? request.approvals.includes(walletAddress)
                  ? 'You have approved this request.'
                  : 'Your signature is needed to move this request forward.'
                : walletAddress === request.requester
                  ? 'You raised this request. You can cancel it while it is pending.'
                  : 'Only approvers and the requester can act on this request.'}
            </span>
            <RequestActions
              treasuryId={treasury}
              requestId={request.requestId}
              requester={request.requester}
              approvals={request.approvals}
              walletAddress={walletAddress}
              isApprover={isApprover}
            />
          </div>
        )}

        {isPending && walletAddress === null && (
          <p className="rounded-card border-2 border-ink bg-paper-raised px-5 py-4 text-sm text-ink-muted shadow-brutal">
            Connect a wallet to approve, reject, or cancel this request.
          </p>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
      <dt className="text-sm text-ink-faint">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approver roster — every approver, and whether they've signed
// ---------------------------------------------------------------------------

function ApproverRoster({
  approvers,
  approved,
  requester,
}: {
  approvers: UseQueryResult<string[]>;
  approved: string[];
  requester: string;
}) {
  if (approvers.isPending) {
    return (
      <ul className="divide-y-2 divide-ink overflow-hidden rounded-card border-2 border-ink bg-paper-raised shadow-brutal">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-center justify-between px-5 py-3.5">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (approvers.isError) {
    return (
      <ErrorState
        title="Could not load approvers"
        body={errorText(approvers.error, "The treasury's approver set could not be read.")}
        onRetry={() => void approvers.refetch()}
      />
    );
  }

  const list = approvers.data ?? [];

  // An approver may have signed even if the set changed since; surface any
  // approving address not currently in the approver set as well.
  const extras = approved.filter((a) => !list.includes(a));
  const rows = [...list.map((a) => ({ address: a, inSet: true })), ...extras.map((a) => ({ address: a, inSet: false }))];

  if (rows.length === 0) {
    return (
      <p className="rounded-card border-2 border-ink bg-paper-raised px-5 py-4 text-sm text-ink-muted shadow-brutal">
        This treasury has no approvers configured yet.
      </p>
    );
  }

  return (
    <ul className="divide-y-2 divide-ink overflow-hidden rounded-card border-2 border-ink bg-paper-raised shadow-brutal">
      {rows.map(({ address, inSet }) => {
        const hasApproved = approved.includes(address);
        return (
          <li key={address} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2">
              <CopyAddress address={address} />
              {address === requester && (
                <span className="rounded-pill border-2 border-ink bg-canvas-overlay px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                  Requester
                </span>
              )}
              {!inSet && (
                <span className="rounded-pill border-2 border-ink bg-canvas-overlay px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                  Former approver
                </span>
              )}
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium',
                hasApproved ? 'text-ok' : 'text-ink-faint',
              )}
            >
              {hasApproved ? (
                <>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                    <path d="M13 4.5 6.5 11 3 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Approved
                </>
              ) : (
                'Awaiting'
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RequestDetailSkeleton() {
  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </header>
      <div className="overflow-hidden rounded-card border-2 border-ink bg-paper-raised shadow-brutal">
        <div className="divide-y-2 divide-ink">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32 rounded" />
        <ul className="divide-y-2 divide-ink overflow-hidden rounded-card border-2 border-ink bg-paper-raised shadow-brutal">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between px-5 py-3.5">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
