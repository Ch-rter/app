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
    'mt-1.5 block w-full rounded-lg border bg-canvas-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint',
    'transition-colors duration-150',
    'focus:outline-none focus:ring-1',
    invalid
      ? 'border-danger/60 focus:border-danger focus:ring-danger'
      : 'border-line hover:border-accent-muted focus:border-accent focus:ring-accent',
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
        'transition-colors duration-150 hover:bg-accent-hover',
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
        'transition-colors duration-150 hover:border-accent-muted hover:bg-canvas-overlay',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}
