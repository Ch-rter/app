'use client';

/**
 * New organization form — deploys a treasury via factory.deploy_treasury.
 *
 * The connected wallet address is the admin. The form collects:
 *   - org name
 *   - token SAC address (the asset the treasury holds)
 *   - approver addresses (dynamic list; admin is pre-filled as first approver)
 *   - threshold (1 … approvers.length)
 *
 * On success the user is redirected to the new treasury's dashboard.
 * On failure the contract error is mapped to a plain-English message.
 */
import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { factory } from '@charter/sdk';

import { factoryContractId } from '../lib/env';
import { signXdr } from '../lib/wallet-kit';
import { useWalletStore } from '../store/wallet';
import { cn } from '../lib/format';
import { Label, Hint, Input } from './form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  token: string;
  approvers: string[];
  threshold: number;
}

// ---------------------------------------------------------------------------
// Approvers sub-section
// ---------------------------------------------------------------------------

function ApproversField({
  approvers,
  onChange,
  disabled,
}: {
  approvers: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const addId = useId();

  const update = (i: number, v: string) => {
    const next = [...approvers];
    next[i] = v;
    onChange(next);
  };

  const remove = (i: number) => {
    onChange(approvers.filter((_, idx) => idx !== i));
  };

  const add = () => onChange([...approvers, '']);

  return (
    <div className="space-y-2">
      {approvers.map((addr, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={addr}
            onChange={(e) => update(i, e.target.value)}
            placeholder="G…"
            disabled={disabled}
            aria-label={`Approver ${i + 1}`}
            className={cn(
              'block min-h-11 flex-1 rounded-badge border-2 border-ink bg-paper-raised px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint',
              'transition-colors duration-150 hover:bg-white',
              'focus:outline-none focus:ring-2 focus:ring-ledger-gold focus:ring-offset-2 focus:ring-offset-paper-raised',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          {approvers.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              aria-label="Remove approver"
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-badge border-2 border-ink bg-paper-raised text-ink-muted shadow-[2px_2px_0_#14171F]',
                'transition-[background-color,box-shadow,transform] duration-150 hover:bg-danger/10 hover:text-danger hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        id={addId}
        type="button"
        onClick={add}
        disabled={disabled}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-card border-2 border-ink bg-paper-raised px-3 text-xs font-medium text-ink shadow-[2px_2px_0_#14171F]',
          'transition-[background-color,box-shadow,transform] duration-150 hover:bg-canvas-overlay hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Add approver
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function NewOrgForm() {
  const router = useRouter();
  const address = useWalletStore((s) => s.address);

  const [form, setForm] = useState<FormState>(() => ({
    name: '',
    token: '',
    approvers: [address ?? ''],
    threshold: 1,
  }));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: async (f: FormState) => {
      if (!address) throw new Error('Connect your wallet first.');
      const filled = f.approvers.filter((a) => a.trim() !== '');
      if (filled.length === 0) throw new Error('Add at least one approver.');
      if (f.threshold < 1 || f.threshold > filled.length) {
        throw new Error(`Threshold must be between 1 and ${filled.length}.`);
      }
      return factory.deployTreasury(
        factoryContractId(),
        address,
        f.name.trim(),
        filled,
        f.threshold,
        f.token.trim(),
        signXdr,
      );
    },
    onSuccess: ({ treasuryAddress }) => {
      router.push(`/org/${treasuryAddress}`);
    },
  });

  const nameId = useId();
  const tokenId = useId();
  const thresholdId = useId();

  const filledApprovers = form.approvers.filter((a) => a.trim() !== '');
  const maxThreshold = Math.max(filledApprovers.length, 1);

  const errorMessage =
    error instanceof Error
      ? error.message
      : error !== null
        ? 'Something went wrong. Please try again.'
        : null;

  if (address === null) {
    return (
      <div className="rounded-card border-2 border-ink bg-paper-raised px-6 py-10 text-center shadow-brutal">
        <p className="text-sm text-ink-muted">Connect your wallet to create an organization.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        reset();
        mutate(form);
      }}
      className="space-y-6 rounded-card border-2 border-ink bg-paper-raised p-5 shadow-brutal sm:p-7"
    >
      {/* Name */}
      <div>
        <Label htmlFor={nameId}>Organization name</Label>
        <Input
          id={nameId}
          value={form.name}
          onChange={(v) => set('name', v)}
          placeholder="Acme Treasury"
          disabled={isPending}
        />
      </div>

      {/* Token */}
      <div>
        <Label htmlFor={tokenId}>Token address</Label>
        <Input
          id={tokenId}
          value={form.token}
          onChange={(v) => set('token', v)}
          placeholder="C… or G…"
          disabled={isPending}
          mono
        />
        <Hint>The SAC token address this treasury holds and disburses.</Hint>
      </div>

      {/* Approvers */}
      <div>
        <Label htmlFor="">Approvers</Label>
        <Hint>Addresses that can approve or reject disbursement requests.</Hint>
        <div className="mt-2">
          <ApproversField
            approvers={form.approvers}
            onChange={(next) => {
              set('approvers', next);
              if (form.threshold > next.filter((a) => a.trim() !== '').length) {
                set('threshold', Math.max(1, next.filter((a) => a.trim() !== '').length));
              }
            }}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Threshold */}
      <div>
        <Label htmlFor={thresholdId}>Approval threshold</Label>
        <div className="mt-1.5 flex items-center gap-3">
          <input
            id={thresholdId}
            type="number"
            min={1}
            max={maxThreshold}
            value={form.threshold}
            onChange={(e) => set('threshold', Math.max(1, Math.min(maxThreshold, Number(e.target.value))))}
            disabled={isPending}
            className={cn(
              'w-20 rounded-lg border border-line bg-canvas-raised px-3 py-2 text-sm text-ink',
              'transition-colors duration-150 hover:border-accent-muted',
              'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          <span className="text-sm text-ink-muted">
            of {maxThreshold} approver{maxThreshold !== 1 ? 's' : ''}
          </span>
        </div>
        <Hint>How many approvers must sign off before a request executes.</Hint>
      </div>

      {/* Error */}
      {errorMessage !== null && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </p>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || form.name.trim() === '' || form.token.trim() === ''}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-canvas',
            'transition-colors duration-150 hover:bg-accent-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {isPending && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
            </svg>
          )}
          {isPending ? 'Deploying…' : 'Deploy treasury'}
        </button>
      </div>
    </form>
  );
}
