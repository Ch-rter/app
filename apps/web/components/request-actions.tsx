'use client';

/**
 * Per-request action controls: approve, reject, and cancel.
 *
 * Visible only on pending requests, gated by wallet role. An approver who
 * hasn't signed yet sees approve/reject; the original requester sees cancel.
 * Each action routes through the SDK's treasury wrapper and invalidates the
 * request list on success. Failures surface as a small inline message rather
 * than a modal so the row stays visible and the user can retry.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treasury } from '@charter/sdk';

import { signXdr } from '../lib/wallet-kit';
import { qk } from '../lib/queries';
import { cn } from '../lib/format';

export function RequestActions({
  treasuryId,
  requestId,
  requester,
  approvals,
  walletAddress,
  isApprover,
}: {
  treasuryId: string;
  requestId: number;
  requester: string;
  approvals: string[];
  walletAddress: string;
  isApprover: boolean;
}) {
  const queryClient = useQueryClient();
  const isRequester = walletAddress === requester;
  const hasApproved = approvals.includes(walletAddress);

  // Approvers who haven't signed yet can approve or reject.
  const canApprove = isApprover && !hasApproved;

  const approve = useMutation({
    mutationFn: () => treasury.approveRequest(treasuryId, walletAddress, requestId, signXdr),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org', treasuryId, 'requests'] }),
  });

  const reject = useMutation({
    mutationFn: () => treasury.rejectRequest(treasuryId, walletAddress, requestId, signXdr),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org', treasuryId, 'requests'] }),
  });

  const cancel = useMutation({
    mutationFn: () => treasury.cancelRequest(treasuryId, walletAddress, requestId, signXdr),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org', treasuryId, 'requests'] }),
  });

  const error =
    approve.error ?? reject.error ?? cancel.error ?? null;
  const errorText =
    error === null
      ? null
      : error instanceof Error
        ? error.message
        : 'Could not complete the action.';

  // No actions when the wallet isn't involved.
  if (!canApprove && !isRequester) return null;

  return (
    <div className="flex items-center gap-1">
      {errorText !== null && (
        <span className="mr-1 text-xs text-danger" role="alert">
          {errorText}
        </span>
      )}

      {canApprove && (
        <>
          <button
            type="button"
            onClick={() => approve.mutate()}
            disabled={approve.isPending}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
              'text-accent hover:bg-canvas-overlay hover:text-accent-hover',
            )}
          >
            {approve.isPending ? '…' : 'Approve'}
          </button>

          <button
            type="button"
            onClick={() => reject.mutate()}
            disabled={reject.isPending}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
              'text-ink-muted hover:bg-canvas-overlay hover:text-danger',
            )}
          >
            {reject.isPending ? '…' : 'Reject'}
          </button>
        </>
      )}

      {isRequester && (
        <button
          type="button"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
            'text-ink-muted hover:bg-canvas-overlay hover:text-ink',
          )}
        >
          {cancel.isPending ? '…' : 'Cancel'}
        </button>
      )}
    </div>
  );
}
