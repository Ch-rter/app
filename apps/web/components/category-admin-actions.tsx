'use client';

/**
 * Admin-only per-category actions: edit the cap, and pause/resume the category.
 *
 * Rendered inline on each category row when the connected wallet is the org
 * admin. Pausing sets the category inactive on-chain (setCategoryActive), which
 * blocks new requests against it; the treasury wrapper owns the write sequence.
 * "Edit" opens the shared {@link CategoryFormModal} in edit mode.
 *
 * The pause toggle mutates on-chain state, so it invalidates the category list
 * on success and surfaces any failure as a small inline message rather than a
 * disruptive banner — the row stays put and the admin can retry.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treasury } from '@charter/sdk';

import { signXdr } from '../lib/wallet-kit';
import { qk } from '../lib/queries';
import { cn } from '../lib/format';
import type { Category } from '../lib/indexer';
import { CategoryFormModal } from './category-form-modal';

export function CategoryAdminActions({
  treasuryId,
  admin,
  category,
}: {
  treasuryId: string;
  admin: string;
  category: Category;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const toggle = useMutation({
    mutationFn: () =>
      treasury.setCategoryActive(treasuryId, admin, category.categoryId, !category.active, signXdr),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.categories(treasuryId) }),
  });

  const toggleError =
    toggle.error === null
      ? null
      : toggle.error instanceof Error
        ? toggle.error.message
        : 'Could not update the category.';

  return (
    <div className="flex items-center gap-1">
      {toggleError !== null && (
        <span className="mr-1 text-xs text-danger" role="alert">
          {toggleError}
        </span>
      )}

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-badge border-2 border-ink bg-paper-raised px-2.5 py-1 text-xs font-medium text-ink shadow-[2px_2px_0_#14171F] transition-[background-color,box-shadow,transform] duration-150 hover:bg-ledger-gold/25 hover:text-ink hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        Edit
      </button>

      <button
        type="button"
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={cn(
          'rounded-badge border-2 border-ink bg-paper-raised px-2.5 py-1 text-xs font-medium shadow-[2px_2px_0_#14171F] transition-[background-color,box-shadow,transform] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50',
          category.active
            ? 'text-ink-muted hover:bg-ledger-gold/20 hover:text-ink'
            : 'text-ink hover:bg-ledger-gold/30',
        )}
      >
        {toggle.isPending ? '…' : category.active ? 'Pause' : 'Resume'}
      </button>

      <CategoryFormModal
        open={editing}
        onClose={() => setEditing(false)}
        treasuryId={treasuryId}
        admin={admin}
        mode={{ kind: 'edit', category }}
      />
    </div>
  );
}
