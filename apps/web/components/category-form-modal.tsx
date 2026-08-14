'use client';

/**
 * Category create / edit form, rendered inside a modal.
 *
 * One component serves both flows:
 *   - create: name + cap → treasury.createCategory (admin, name, cap)
 *   - edit:   cap only    → treasury.updateCategoryCap (admin, id, newCap)
 *
 * On the contract, a category's name is immutable and only its cap is editable,
 * so in edit mode the name is shown read-only. The cap is entered as a human
 * decimal and converted to a raw i128 bigint via {@link parseAmount} — never a
 * float. All writes route through the SDK's treasury wrapper; on success the
 * category list and (for edits) the affected category are invalidated so the
 * dashboard reflects the change without a manual refresh.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treasury } from '@charter/sdk';

import { signXdr } from '../lib/wallet-kit';
import { qk } from '../lib/queries';
import { parseAmount, AmountParseError } from '../lib/format';
import type { Category } from '../lib/indexer';
import { Modal } from './modal';
import { Label, Hint, Input, FieldError, PrimaryButton, SecondaryButton } from './form';

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; category: Category };

export function CategoryFormModal({
  open,
  onClose,
  treasuryId,
  admin,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  treasuryId: string;
  admin: string;
  mode: Mode;
}) {
  const isEdit = mode.kind === 'edit';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit category cap' : 'New category'}
      description={
        isEdit
          ? 'Adjust the spending cap. The category name cannot be changed.'
          : 'Create a budget category. Requests draw against its cap.'
      }
    >
      {/* Keyed so switching between create and different edit targets resets
          the form's internal state cleanly. */}
      <CategoryForm
        key={isEdit ? `edit-${mode.category.categoryId}` : 'create'}
        onClose={onClose}
        treasuryId={treasuryId}
        admin={admin}
        mode={mode}
      />
    </Modal>
  );
}

function CategoryForm({
  onClose,
  treasuryId,
  admin,
  mode,
}: {
  onClose: () => void;
  treasuryId: string;
  admin: string;
  mode: Mode;
}) {
  const isEdit = mode.kind === 'edit';
  const queryClient = useQueryClient();

  const [name, setName] = useState(isEdit ? mode.category.name : '');
  const [cap, setCap] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: async () => {
      // Parse the cap up front so a malformed amount fails before any wallet
      // round-trip. parseAmount throws AmountParseError with a friendly message.
      const capValue = parseAmount(cap);
      if (capValue <= 0n) {
        throw new AmountParseError('The cap must be greater than zero.');
      }

      if (mode.kind === 'create') {
        const trimmed = name.trim();
        if (trimmed === '') throw new AmountParseError('Enter a category name.');
        return treasury.createCategory(treasuryId, admin, trimmed, capValue, signXdr);
      }
      return treasury.updateCategoryCap(
        treasuryId,
        admin,
        mode.category.categoryId,
        capValue,
        signXdr,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.categories(treasuryId) });
      onClose();
    },
  });

  // AmountParseError (validation) renders inline against the cap field; any
  // other error is a contract/transaction failure and gets the banner.
  const bannerError =
    error !== null && !(error instanceof AmountParseError)
      ? error instanceof Error
        ? error.message
        : 'The transaction could not be completed. Please try again.'
      : null;
  const inlineError = error instanceof AmountParseError ? error.message : fieldError;

  const submit = () => {
    setFieldError(null);
    reset();
    mutate();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <div>
        <Label htmlFor="category-name">Name</Label>
        {isEdit ? (
          <p className="mt-2 rounded-badge border-2 border-ink bg-paper px-3.5 py-2.5 text-sm text-ink-muted">
            {mode.category.name}
          </p>
        ) : (
          <Input
            id="category-name"
            value={name}
            onChange={setName}
            placeholder="Engineering"
            disabled={isPending}
          />
        )}
      </div>

      <div>
        <Label htmlFor="category-cap">Spending cap</Label>
        <Input
          id="category-cap"
          value={cap}
          onChange={setCap}
          placeholder="10,000.00"
          disabled={isPending}
          mono
          inputMode="decimal"
          invalid={inlineError !== null}
        />
        {inlineError !== null ? (
          <FieldError>{inlineError}</FieldError>
        ) : (
          <Hint>The maximum this category can disburse, in whole token units.</Hint>
        )}
      </div>

      {bannerError !== null && (
        <p role="alert" className="rounded-badge border-2 border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
          {bannerError}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        <SecondaryButton onClick={onClose} disabled={isPending}>
          Cancel
        </SecondaryButton>
        <PrimaryButton
          type="submit"
          pending={isPending}
          disabled={isPending || cap.trim() === '' || (!isEdit && name.trim() === '')}
        >
          {isPending
            ? isEdit
              ? 'Saving…'
              : 'Creating…'
            : isEdit
              ? 'Save cap'
              : 'Create category'}
        </PrimaryButton>
      </div>
    </form>
  );
}
