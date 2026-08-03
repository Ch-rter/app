/**
 * Global client state (Zustand).
 *
 * Scope is deliberately narrow — only cross-cutting client state that many
 * components read lives here: the connected wallet address, the network label,
 * and the treasury the user is currently viewing. Everything else (org lists,
 * categories, requests, balances) is server state owned by react-query and must
 * not be duplicated into this store.
 *
 * Wallet actions delegate to `lib/wallet-kit`; this store holds the resulting
 * address and the transient connecting/error state the connect UI renders.
 */
import { create } from 'zustand';

import { networkLabel } from '../lib/env';
import { connect as kitConnect, disconnect as kitDisconnect, restore as kitRestore, rememberSelectedWallet } from '../lib/wallet-kit';

interface WalletState {
  /** Connected wallet public key, or null when disconnected. */
  address: string | null;
  /** Human-readable network label (Testnet / Mainnet / …). */
  network: string;
  /** True while a connect/restore round-trip is in flight. */
  connecting: boolean;
  /** Last connect error message, cleared on the next attempt. */
  error: string | null;
  /** Treasury address the user is currently operating on, or null. */
  activeTreasury: string | null;

  /** Opens the wallet picker and stores the resulting address. */
  connect: () => Promise<void>;
  /** Silently reconnects a prior session on first load. */
  restore: () => Promise<void>;
  /** Disconnects and clears the address. */
  disconnect: () => Promise<void>;
  /** Sets the treasury the dashboard views. */
  setActiveTreasury: (treasury: string | null) => void;
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Could not connect to the wallet. Please try again.';
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  network: networkLabel(),
  connecting: false,
  error: null,
  activeTreasury: null,

  connect: async () => {
    set({ connecting: true, error: null });
    try {
      const address = await kitConnect();
      rememberSelectedWallet();
      set({ address, connecting: false });
    } catch (err) {
      set({ connecting: false, error: toMessage(err) });
    }
  },

  restore: async () => {
    set({ connecting: true });
    try {
      const address = await kitRestore();
      set({ address: address ?? null, connecting: false });
    } catch {
      set({ connecting: false });
    }
  },

  disconnect: async () => {
    await kitDisconnect();
    set({ address: null, error: null });
  },

  setActiveTreasury: (treasury) => set({ activeTreasury: treasury }),
}));
