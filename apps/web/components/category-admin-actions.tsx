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
        className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-canvas-overlay hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Edit
      </button>

      <button
        type="button"
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={cn(
          'rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
          category.active
            ? 'text-ink-muted hover:bg-canvas-overlay hover:text-warn'
            : 'text-accent hover:bg-canvas-overlay hover:text-accent-hover',
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
