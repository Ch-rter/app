/**
 * Soroban RPC access for Charter.
 *
 * Three primitives cover every contract interaction in the app:
 *   - `readContract`  — free simulation, no signature, returns the decoded value.
 *   - `writeContract` — simulate → prepare → sign (via caller-supplied callback)
 *                       → send → poll to a definitive success/failure.
 *   - `pollTransaction` — wait for a submitted transaction to resolve.
 *
 * This module is deliberately wallet-agnostic: state-changing calls take a
 * `signXdr` callback so the web layer can plug in stellar-wallets-kit without
 * `packages/sdk` ever depending on it (dependency direction stays one-way).
 */
import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

/** Transactions are only alive long enough to simulate + submit. */
const DEFAULT_TIMEOUT_SECONDS = 30;

/** Default number of polling attempts when awaiting a submitted transaction. */
const DEFAULT_POLL_ATTEMPTS = 12;

/**
 * A contract-level failure. `code` is the numeric `#[contracterror]` discriminant
 * when one can be parsed from the RPC message; the human-readable mapping lives
 * in `types.ts`. `raw` is preserved for logging but must never be shown to users.
 */
export class ContractError extends Error {
  readonly raw: string;
  readonly code: number | undefined;

  constructor(raw: string) {
    super(raw);
    this.name = 'ContractError';
    this.raw = raw;
    this.code = parseContractErrorCode(raw);
  }
}

/**
 * Signs a base64 transaction envelope and returns the signed envelope (base64).
 * Implemented by the web layer on top of the connected wallet.
 */
export type SignXdr = (
  xdrBase64: string,
  options: { networkPassphrase: string },
) => Promise<string>;

/** Outcome of a successful state-changing call. */
export interface WriteResult {
  /** Hash of the confirmed transaction. */
  hash: string;
  /** Decoded contract return value, or `undefined` for void methods. */
  returnValue: unknown;
}

let cachedServer: rpc.Server | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getServer(): rpc.Server {
  if (cachedServer !== undefined) {
    return cachedServer;
  }
  const url = requireEnv('NEXT_PUBLIC_SOROBAN_RPC_URL');
  cachedServer = new rpc.Server(url, { allowHttp: url.startsWith('http://') });
  return cachedServer;
}

function getNetworkPassphrase(): string {
  return requireEnv('NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE');
}

/**
 * Source account used purely for read simulations. Reads never touch the
 * ledger, so the account need not exist or be funded — it only supplies a
 * valid strkey. Overridable via env; otherwise a deterministic, unfunded
 * placeholder derived from an all-zero seed.
 */
function getReadSourceAccount(): string {
  const configured = process.env.NEXT_PUBLIC_READ_ONLY_SOURCE_ACCOUNT;
  if (configured !== undefined && configured.trim() !== '') {
    return configured.trim();
  }
  return Keypair.fromRawEd25519Seed(Buffer.alloc(32)).publicKey();
}

/**
 * Reads contract state via free simulation. No wallet, no signature, no fee.
 *
 * @typeParam T - Expected decoded shape of the return value.
 * @throws {ContractError} if the simulation reports a contract error.
 */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const server = getServer();
  const source = new Account(getReadSourceAccount(), '0');
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(DEFAULT_TIMEOUT_SECONDS)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new ContractError(sim.error);
  }

  const retval = sim.result?.retval;
  if (retval === undefined) {
    return undefined as T;
  }
  return scValToNative(retval) as T;
}

/**
 * Executes a state-changing contract call.
 *
 * Flow: simulate (to surface contract errors before prompting the user) →
 * prepare (footprint, auth, resource fees) → sign via `signXdr` → send → poll.
 *
 * @param publicKey - The account that authorizes and pays for the call.
 * @param signXdr   - Callback that signs the prepared envelope.
 * @throws {ContractError} on simulation, submission, or execution failure.
 */
export async function writeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  publicKey: string,
  signXdr: SignXdr,
): Promise<WriteResult> {
  const server = getServer();
  const networkPassphrase = getNetworkPassphrase();
  const source = await server.getAccount(publicKey);
  const contract = new Contract(contractId);

  const built = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(DEFAULT_TIMEOUT_SECONDS)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new ContractError(sim.error);
  }

  const prepared = await server.prepareTransaction(built);
  const signedXdr = await signXdr(prepared.toXDR(), { networkPassphrase });
  const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

  const sent = await server.sendTransaction(signedTx);
  if (sent.status === 'ERROR') {
    throw new ContractError(
      sent.errorResult?.toXDR('base64') ?? 'Transaction submission was rejected',
    );
  }

  const final = await pollTransaction(sent.hash);
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new ContractError(`Transaction ${sent.hash} did not succeed (${final.status})`);
  }

  return {
    hash: sent.hash,
    returnValue:
      final.returnValue !== undefined ? scValToNative(final.returnValue) : undefined,
  };
}

/**
 * Polls a submitted transaction until it reaches a definitive state or the
 * attempt budget is exhausted.
 */
export function pollTransaction(
  hash: string,
  attempts: number = DEFAULT_POLL_ATTEMPTS,
): Promise<rpc.Api.GetTransactionResponse> {
  return getServer().pollTransaction(hash, { attempts });
}

function parseContractErrorCode(message: string): number | undefined {
  // Soroban surfaces contract errors as e.g. "Error(Contract, #12)".
  const match = message.match(/Error\(Contract,\s*#(\d+)\)/);
  const captured = match?.[1];
  if (captured === undefined) {
    return undefined;
  }
  return Number.parseInt(captured, 10);
}
