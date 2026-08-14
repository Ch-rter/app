'use client';

/**
 * Wallet connect / account control.
 *
 * Disconnected: a primary "Connect wallet" button that opens the kit's picker.
 * Connected: an account pill showing the network and truncated address, which
 * opens a small popover to copy the full address or disconnect.
 *
 * State vocabulary is complete — default, hover, focus-visible, disabled, and a
 * connecting spinner — so the control never feels half-built. The popover uses
 * the native Popover API so it escapes any overflow-clipped header container.
 */
import { useId, useState } from 'react';

import { cn, truncateAddress } from '../lib/format';
import { useWalletStore } from '../store/wallet';

export function WalletButton() {
  const address = useWalletStore((s) => s.address);
  const network = useWalletStore((s) => s.network);
  const connecting = useWalletStore((s) => s.connecting);
  const error = useWalletStore((s) => s.error);
  const connect = useWalletStore((s) => s.connect);

  if (address === null) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-card border-2 border-ink px-4 text-sm font-medium',
            'bg-ledger-gold text-ink shadow-brutal transition-[background-color,box-shadow,transform] duration-150',
            'hover:bg-accent-hover hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-brutal-pressed',
            'active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-pressed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {connecting ? <Spinner /> : <WalletGlyph />}
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
        {error !== null && (
          <p role="alert" className="max-w-xs text-right text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return <AccountPill address={address} network={network} />;
}

function AccountPill({ address, network }: { address: string; network: string }) {
  const disconnect = useWalletStore((s) => s.disconnect);
  const [copied, setCopied] = useState(false);
  const popoverId = useId();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        popoverTarget={popoverId}
        className={cn(
          'inline-flex min-h-10 items-center gap-2 rounded-card border-2 border-ink px-3 text-sm',
          'bg-paper-raised text-ink shadow-brutal transition-[background-color,box-shadow,transform] duration-150',
          'hover:bg-canvas-overlay hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-brutal-pressed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised',
        )}
      >
        <span className="inline-flex h-2 w-2 rounded-full border border-ink bg-signal-green" aria-hidden />
        <span className="font-mono text-ink">{truncateAddress(address)}</span>
        <span className="hidden rounded-pill border-2 border-ink px-2 py-0.5 text-[10px] font-medium text-ink-muted sm:inline">
          {network}
        </span>
      </button>

      <div
        popover="auto"
        id={popoverId}
        className={cn(
          'mt-2 w-72 rounded-card border-2 border-ink bg-paper-raised p-4 text-sm shadow-brutal',
          // Anchor to the trigger's right edge; the popover sits in the top layer
          // so it is never clipped by the header.
          'inset-[unset] right-4 top-16 left-[unset]',
        )}
      >
        <p className="font-display text-base text-ink">Connected account</p>
        <p className="mt-2 break-all font-mono text-xs leading-relaxed text-ink-muted">{address}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className={cn(
              'inline-flex h-9 flex-1 items-center justify-center rounded-card border-2 border-ink bg-paper-raised px-3 text-xs font-medium text-ink shadow-[2px_2px_0_#14171F]',
              'transition-[background-color,box-shadow,transform] duration-150 hover:bg-canvas-overlay hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
            )}
          >
            {copied ? 'Copied' : 'Copy address'}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            className={cn(
              'inline-flex h-9 flex-1 items-center justify-center rounded-card border-2 border-ink bg-paper-raised px-3 text-xs font-medium shadow-[2px_2px_0_#14171F]',
              'text-danger transition-[background-color,box-shadow,transform] duration-150 hover:bg-danger/10 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger',
            )}
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
    </svg>
  );
}

function WalletGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v1H5.5A2.5 2.5 0 0 1 3 7.5zM3 8.5V16a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-2.5m0-5V12m0 0h-3.5a2 2 0 0 0 0 4H20m0-4v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
