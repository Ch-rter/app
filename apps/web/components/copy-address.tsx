'use client';

/**
 * A monospace address with a copy-to-clipboard affordance. Used wherever a full
 * Stellar address is shown and the user is likely to want it verbatim (treasury
 * and admin addresses, recipients). The address is truncated for display but the
 * full value is copied and exposed via `title`.
 */
import { useState } from 'react';

import { cn, truncateAddress } from '../lib/format';

export function CopyAddress({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the title attribute keeps the full
      // address available as a fallback, so we fail silently.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      aria-label={copied ? 'Address copied' : `Copy address ${address}`}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-badge border-2 border-ink bg-paper-raised px-2 py-1 font-mono text-xs text-ink-muted',
        'transition-[background-color,transform] duration-150 hover:bg-canvas-overlay hover:text-ink hover:translate-x-0.5 hover:translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
        className,
      )}
    >
      <span>{truncateAddress(address, 6, 6)}</span>
      <span className="text-ink-faint transition-colors duration-150 group-hover:text-accent" aria-hidden>
        {copied ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <path d="M13 4.5 6.5 11 3 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
