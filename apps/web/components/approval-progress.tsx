'use client';

/**
 * Approval progress for a pending request.
 *
 * Renders the count of collected approvals against the treasury's threshold as
 * a segmented meter — one cell per required approval, filled as signatures come
 * in. When the threshold isn't yet known (its query is still loading) it falls
 * back to a plain count so the row never blocks on a second request.
 *
 * The meter is decorative reinforcement; the "n of m" label always carries the
 * meaning, so the state reads without relying on the fill colour.
 */
import { cn } from '../lib/format';

export function ApprovalProgress({
  approvals,
  threshold,
  className,
}: {
  approvals: number;
  /** Required signatures, or null while the threshold read is pending. */
  threshold: number | null;
  className?: string;
}) {
  if (threshold === null || threshold <= 0) {
    return (
      <span className={cn('text-xs text-ink-faint', className)}>
        {approvals} approval{approvals === 1 ? '' : 's'}
      </span>
    );
  }

  const met = approvals >= threshold;
  const filled = Math.min(approvals, threshold);

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: threshold }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-4 rounded-full transition-colors duration-150',
              i < filled ? (met ? 'bg-ok' : 'bg-accent') : 'bg-canvas-overlay',
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          'font-mono text-xs tabular-nums',
          met ? 'text-ok' : 'text-ink-faint',
        )}
      >
        {approvals} of {threshold}
      </span>
    </span>
  );
}
