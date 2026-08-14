/**
 * Shared state surfaces for data-backed views: skeleton (loading), empty
 * (nothing to show yet), and error (fetch failed). Every list and detail view
 * uses these so loading and failure never fall back to a bare spinner or a
 * silent blank.
 *
 * Skeletons mirror the shape of the content they stand in for, so layout does
 * not jump when data arrives. Empty states teach — they say what the surface
 * will hold and offer the action that fills it. Error states are recoverable:
 * they always carry a retry.
 */
import type { ReactNode } from 'react';

import { cn } from '../lib/format';

/**
 * A single shimmering placeholder block. `prefers-reduced-motion` drops the
 * pulse to a static tint (handled globally in globals.css).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('shimmer animate-pulse rounded-md bg-canvas-overlay', className)}
      aria-hidden
    />
  );
}

/**
 * A centered surface for "nothing here yet" and "something went wrong". Kept
 * generic so both {@link EmptyState} and {@link ErrorState} share one frame.
 */
function Panel({
  icon,
  title,
  body,
  children,
  tone = 'neutral',
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border-2 border-ink bg-paper-raised px-6 py-14 text-center shadow-brutal">
      <span
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-badge border-2 border-ink',
          tone === 'danger'
            ? 'bg-flag-red/10 text-flag-red'
            : 'bg-ledger-gold text-ink',
        )}
      >
        {icon}
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-ink-muted">{body}</p>
      </div>
      {children}
    </div>
  );
}

/** Shown when a fetch succeeds but returns no rows. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Panel
      tone="neutral"
      title={title}
      body={body}
      icon={
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M4 7.5A2.5 2.5 0 0 1 6.5 5h4l2 2.5H18A2.5 2.5 0 0 1 20.5 10v6A2.5 2.5 0 0 1 18 18.5H6A2.5 2.5 0 0 1 3.5 16V7.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      }
    >
      {action}
    </Panel>
  );
}

/** Shown when a fetch fails. Always carries a retry affordance. */
export function ErrorState({
  title = 'Could not load this',
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <Panel
      tone="danger"
      title={title}
      body={body}
      icon={
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M12 8v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    >
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'inline-flex min-h-10 items-center rounded-card border-2 border-ink bg-paper-raised px-4 text-sm font-medium text-ink shadow-brutal',
          'transition-[background-color,box-shadow,transform] duration-150 hover:bg-ledger-gold/25 hover:text-ink hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-brutal-pressed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        )}
      >
        Try again
      </button>
    </Panel>
  );
}
