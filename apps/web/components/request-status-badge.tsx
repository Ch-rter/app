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
  Pending: 'border-ink bg-ledger-gold/35 text-ink',
  Executed: 'border-ink bg-signal-green text-white',
  Rejected: 'border-ink bg-flag-red text-white',
  Cancelled: 'border-ink bg-paper text-ink-muted',
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
        'inline-flex items-center rounded-pill border-2 px-2.5 py-0.5 text-[11px] font-medium',
        STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
