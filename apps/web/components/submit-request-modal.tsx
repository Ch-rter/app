'use client';

/**
 * Submit-request form, rendered inside a modal.
 *
 * A treasury member proposes a disbursement against a category: pick the
 * category, name a recipient, enter an amount, and attach a short memo. The
 * amount is entered as a human decimal and converted to a raw i128 bigint via
 * {@link parseAmount} — never a float. The recipient is validated as a Stellar
 * address (account `G…` or contract `C…`) before any wallet round-trip.
 *
 * The write routes through the SDK's treasury wrapper (`submit_request`) signed
 * by the connected member. On success the request list is invalidated so the
 * dashboard shows the new pending request without a manual refresh.
 *
 * Only active categories are offered: a paused category cannot accept new
 * requests, so it never appears in the picker.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StrKey } from '@stellar/stellar-sdk';
import { treasury } from '@charter/sdk';

import { signXdr } from '../lib/wallet-kit';
import { qk } from '../lib/queries';
import { parseAmount, AmountParseError, formatAmount, cn } from '../lib/format';
import type { Category } from '../lib/indexer';
import { Modal } from './modal';
import {
  Label,
  Hint,
  Input,
  Select,
  FieldError,
  PrimaryButton,
  SecondaryButton,
} from './form';

/** A field-scoped validation failure, keyed to the input it belongs to. */
class FieldValidationError extends Error {
  readonly field: 'category' | 'recipient' | 'amount' | 'memo';

  constructor(field: FieldValidationError['field'], message: string) {
    super(message);
    this.name = 'FieldValidationError';
    this.field = field;
  }
}

/** True for a well-formed Stellar account (`G…`) or contract (`C…`) address. */
function isStellarAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value);
}

/** The contract caps a memo at 64 bytes; mirror that here for a clean error. */
const MEMO_MAX_BYTES = 64;

export function SubmitRequestModal({
  open,
  onClose,
  treasuryId,
  requester,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  treasuryId: string;
  requester: string;
  categories: Category[];
}) {
  const active = categories.filter((c) => c.active);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New request"
      description="Propose a disbursement. It stays pending until approvers reach the threshold."
    >
      {active.length === 0 ? (
        <div className="space-y-5">
          <p className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-ink-muted">
            There are no active categories to request against. Ask an admin to
            create one or resume a paused category first.
          </p>
          <div className="flex justify-end">
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          </div>
        </div>
      ) : (
        // Keyed on open so each time the modal opens it starts from a clean form.
        <RequestForm
          key={open ? 'open' : 'closed'}
          onClose={onClose}
          treasuryId={treasuryId}
          requester={requester}
          categories={active}
        />
      )}
    </Modal>
  );
}

function RequestForm({
  onClose,
  treasuryId,
  requester,
  categories,
}: {
  onClose: () => void;
  treasuryId: string;
  requester: string;
  categories: Category[];
}) {
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState(String(categories[0]!.categoryId));
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const selected = categories.find((c) => String(c.categoryId) === categoryId) ?? null;

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: async () => {
      const category = categories.find((c) => String(c.categoryId) === categoryId);
      if (!category) {
        throw new FieldValidationError('category', 'Choose a category.');
      }

      const recipientTrimmed = recipient.trim();
      if (recipientTrimmed === '') {
        throw new FieldValidationError('recipient', 'Enter a recipient address.');
      }
      if (!isStellarAddress(recipientTrimmed)) {
        throw new FieldValidationError(
          'recipient',
          'That is not a valid Stellar address.',
        );
      }

      // parseAmount throws AmountParseError with a friendly message on bad input.
      let amountValue: bigint;
      try {
        amountValue = parseAmount(amount);
      } catch (cause) {
        if (cause instanceof AmountParseError) {
          throw new FieldValidationError('amount', cause.message);
        }
        throw cause;
      }
      if (amountValue <= 0n) {
        throw new FieldValidationError('amount', 'The amount must be greater than zero.');
      }

      const memoTrimmed = memo.trim();
      if (new TextEncoder().encode(memoTrimmed).length > MEMO_MAX_BYTES) {
        throw new FieldValidationError(
          'memo',
          `The memo must be at most ${MEMO_MAX_BYTES} bytes.`,
        );
      }

      return treasury.submitRequest(
        treasuryId,
        requester,
        category.categoryId,
        recipientTrimmed,
        amountValue,
        memoTrimmed,
        signXdr,
      );
    },
    onSuccess: async () => {
      // Invalidate every status view of the request list plus the "all" view.
      await queryClient.invalidateQueries({
        queryKey: ['org', treasuryId, 'requests'],
      });
      onClose();
    },
  });

  const fieldError = (field: FieldValidationError['field']) =>
    error instanceof FieldValidationError && error.field === field ? error.message : null;

  // Anything that is not a field validation error is a contract/transaction
  // failure and gets the banner.
  const bannerError =
    error !== null && !(error instanceof FieldValidationError)
      ? error instanceof Error
        ? error.message
        : 'The transaction could not be completed. Please try again.'
      : null;

  const submit = () => {
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
        <Label htmlFor="request-category">Category</Label>
        <Select
          id="request-category"
          value={categoryId}
          onChange={setCategoryId}
          disabled={isPending}
          invalid={fieldError('category') !== null}
        >
          {categories.map((c) => (
            <option key={c.categoryId} value={String(c.categoryId)}>
              {c.name}
            </option>
          ))}
        </Select>
        {fieldError('category') !== null ? (
          <FieldError>{fieldError('category')}</FieldError>
        ) : selected !== null ? (
          <Hint>
            {formatAmount(selected.spent)} of {formatAmount(selected.cap)} spent so far.
          </Hint>
        ) : null}
      </div>

      <div>
        <Label htmlFor="request-recipient">Recipient</Label>
        <Input
          id="request-recipient"
          value={recipient}
          onChange={setRecipient}
          placeholder="G… or C…"
          disabled={isPending}
          mono
          invalid={fieldError('recipient') !== null}
        />
        {fieldError('recipient') !== null ? (
          <FieldError>{fieldError('recipient')}</FieldError>
        ) : (
          <Hint>The Stellar account or contract that receives the funds.</Hint>
        )}
      </div>

      <div>
        <Label htmlFor="request-amount">Amount</Label>
        <Input
          id="request-amount"
          value={amount}
          onChange={setAmount}
          placeholder="1,000.00"
          disabled={isPending}
          mono
          inputMode="decimal"
          invalid={fieldError('amount') !== null}
        />
        {fieldError('amount') !== null ? (
          <FieldError>{fieldError('amount')}</FieldError>
        ) : (
          <Hint>Drawn against the category&rsquo;s remaining cap, in token units.</Hint>
        )}
      </div>

      <div>
        <Label htmlFor="request-memo">Memo</Label>
        <Input
          id="request-memo"
          value={memo}
          onChange={setMemo}
          placeholder="Q3 contractor invoice"
          disabled={isPending}
          invalid={fieldError('memo') !== null}
        />
        {fieldError('memo') !== null ? (
          <FieldError>{fieldError('memo')}</FieldError>
        ) : (
          <Hint>A short, optional note. Up to {MEMO_MAX_BYTES} bytes.</Hint>
        )}
      </div>

      {bannerError !== null && (
        <p
          role="alert"
          className={cn(
            'rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger',
          )}
        >
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
          disabled={isPending || recipient.trim() === '' || amount.trim() === ''}
        >
          {isPending ? 'Submitting…' : 'Submit request'}
        </PrimaryButton>
      </div>
    </form>
  );
}
