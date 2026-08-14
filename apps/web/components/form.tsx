'use client';

/**
 * Shared form field primitives.
 *
 * One visual language for every form in the app (new-org, category create/edit,
 * submit-request). Extracted so a change to input styling or focus treatment
 * lands everywhere at once. Field composition (labels, hints, error wiring)
 * stays with each form; these are the leaf controls.
 */
import type { ReactNode } from 'react';

import { cn } from '../lib/format';

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
      {children}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-ink-faint">{children}</p>;
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-xs text-danger" role="alert">
      {children}
    </p>
  );
}

/** The shared input treatment: dark surface, accent focus ring, mono opt-in. */
const inputClass = (mono?: boolean, invalid?: boolean) =>
  cn(
    'mt-2 block min-h-11 w-full rounded-badge border-2 bg-paper-raised px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint',
    'transition-[background-color,box-shadow] duration-150',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-paper',
    invalid
      ? 'border-danger focus:border-danger focus:ring-danger'
      : 'border-ink hover:bg-white focus:border-ink focus:ring-ledger-gold',
    'disabled:cursor-not-allowed disabled:opacity-50',
    mono && 'font-mono',
  );

export function Input({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  mono,
  invalid,
  inputMode,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  invalid?: boolean;
  inputMode?: 'text' | 'decimal';
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={inputClass(mono, invalid)}
    />
  );
}

/** A native select, styled to match {@link Input}, with a custom chevron. */
export function Select({
  id,
  value,
  onChange,
  disabled,
  invalid,
  children,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative mt-2">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'block min-h-11 w-full appearance-none rounded-badge border-2 bg-paper-raised py-2.5 pl-3.5 pr-10 text-sm text-ink',
          'transition-[background-color,box-shadow] duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-paper',
          invalid
            ? 'border-danger focus:border-danger focus:ring-danger'
            : 'border-ink hover:bg-white focus:border-ink focus:ring-ledger-gold',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
        fill="none"
        aria-hidden
      >
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Primary (accent) and secondary (outline) button treatments, shared. */
export function PrimaryButton({
  children,
  type = 'button',
  onClick,
  disabled,
  pending,
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-canvas',
        'transition-[background-color,transform] duration-150 hover:bg-accent-hover active:translate-y-[0.5px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {pending && (
        <svg className="h-4 w-4 animate-spin motion-reduce:hidden" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-ink',
        'transition-[color,background-color,border-color,transform] duration-150 hover:border-accent-muted hover:bg-canvas-overlay active:translate-y-[0.5px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}
