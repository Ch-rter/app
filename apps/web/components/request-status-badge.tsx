'use client';

/**
 * A small pill that colours a request's lifecycle status.
 *
 * The four states map to the contract's own state machine: `Pending` is the
 * live, actionable state (accent); `Executed` succeeded (ok/green); `Rejected`
 * was turned down (danger/red); `Cancelled` was withdrawn (muted). Colour is
 * paired with the text label, never the only signal, so the status reads without
 * relying on hue.
 */
import type { RequestStatus } from '../lib/indexer';
import { cn } from '../lib/format';

const STYLES: Record<RequestStatus, string> = {
  Pending: 'border-info/30 bg-info/10 text-info',
  Executed: 'border-ok/30 bg-ok/10 text-ok',
  Rejected: 'border-danger/30 bg-danger/10 text-danger',
  Cancelled: 'border-line bg-canvas-overlay text-ink-faint',
};

export function RequestStatusBadge({
  status,
  className,
}: {
  status: RequestStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
