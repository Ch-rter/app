/**
 * stellar-wallets-kit integration — the one place the wallet library is touched.
 *
 * The kit is initialized lazily and only in the browser (it reaches for
 * `window`/DOM), so this module is import-safe on the server. Everything the
 * rest of the app needs is exposed as plain async functions; components talk to
 * the wallet through the Zustand store (see `store/wallet.ts`), never by
 * importing the kit directly.
 *
 * Crucially, {@link signXdr} adapts the kit's `signTransaction` to the SDK's
 * `SignXdr` callback shape, so `packages/sdk` stays wallet-agnostic — the
 * dependency direction is web → sdk, never the reverse.
 */
import type { SignXdr } from '@charter/sdk';
import {
  StellarWalletsKit,
  Networks,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';

import { networkPassphrase } from '../lib/env';

/** localStorage key the kit persists the last-selected wallet id under. */
const SELECTED_WALLET_KEY = 'charter:selected-wallet';

let initialized = false;

/** Maps our configured network passphrase onto the kit's Networks enum. */
function kitNetwork(): Networks {
  const passphrase = networkPassphrase();
  if (passphrase === Networks.PUBLIC) return Networks.PUBLIC;
  if (passphrase === Networks.FUTURENET) return Networks.FUTURENET;
  return Networks.TESTNET;
}

/**
 * Initializes the kit exactly once, on the client. Safe to call repeatedly;
 * subsequent calls are no-ops. Throws if invoked during SSR.
 */
function ensureInit(): void {
  if (initialized) return;
  if (typeof window === 'undefined') {
    throw new Error('The wallet kit can only be used in the browser.');
  }

  StellarWalletsKit.init({
    network: kitNetwork(),
    selectedWalletId: window.localStorage.getItem(SELECTED_WALLET_KEY) ?? undefined,
    modules: [new FreighterModule(), new xBullModule(), new AlbedoModule()],
  });
  initialized = true;
}

/** The wallets the app offers, in display order. */
export function supportedWallets(): Promise<ISupportedWallet[]> {
  ensureInit();
  return StellarWalletsKit.refreshSupportedWallets();
}

/**
 * Opens the kit's wallet-picker modal, then reads back the connected address.
 * The chosen wallet id is persisted so a later reload reconnects silently.
 * Returns the connected public key.
 */
export async function connect(): Promise<string> {
  ensureInit();
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

/**
 * Reconnects to a previously chosen wallet without prompting, returning the
 * address or `undefined` when no wallet is selected or access is not granted.
 * Used on first load to restore a prior session quietly.
 */
export async function restore(): Promise<string | undefined> {
  ensureInit();
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SELECTED_WALLET_KEY) : null;
  if (stored === null || stored === '') {
    return undefined;
  }
  try {
    StellarWalletsKit.setWallet(stored);
    const { address } = await StellarWalletsKit.getAddress();
    return address === '' ? undefined : address;
  } catch {
    // A stored wallet that is no longer installed or has revoked access is not
    // an error worth surfacing — the user simply starts disconnected.
    return undefined;
  }
}

/** Clears the kit's connection and the persisted wallet selection. */
export async function disconnect(): Promise<void> {
  ensureInit();
  try {
    await StellarWalletsKit.disconnect();
  } finally {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SELECTED_WALLET_KEY);
    }
  }
}

/**
 * The `SignXdr` callback the SDK's `writeContract` calls to authorize a
 * transaction. Delegates to the connected wallet and returns the signed
 * envelope (base64). Bound to the currently selected wallet at call time.
 */
export const signXdr: SignXdr = async (xdrBase64, { networkPassphrase: passphrase }) => {
  ensureInit();
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdrBase64, {
    networkPassphrase: passphrase,
  });
  return signedTxXdr;
};

/**
 * Records the wallet id the user selected so `restore` can reconnect silently.
 * Called from the store after a successful connect resolves an address.
 */
export function rememberSelectedWallet(): void {
  if (typeof window === 'undefined') return;
  try {
    const id = StellarWalletsKit.selectedModule.productId;
    if (id !== '') {
      window.localStorage.setItem(SELECTED_WALLET_KEY, id);
    }
  } catch {
    // No module selected yet; nothing to remember.
  }
}
