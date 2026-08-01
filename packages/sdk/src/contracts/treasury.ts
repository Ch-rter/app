/**
 * `TreasuryClient` — the single, authoritative wrapper for every `treasury`
 * contract method.
 *
 * Page components MUST call these functions rather than assembling contract
 * calls ad hoc, so the simulate → prepare → sign → send → poll sequence lives
 * in exactly one place (see {@link writeContract}).
 *
 * Reads return decoded domain types from `types.ts`. Writes take the caller's
 * public key and a `signXdr` callback (wired to the wallet in the web layer)
 * and return the confirmed transaction hash.
 */
import {
  addressArg,
  addressVecArg,
  boolArg,
  i128Arg,
  stringArg,
  u32Arg,
} from '../xdr.js';
import { ContractError, readContract, writeContract, type SignXdr } from '../rpc.js';
import {
  decodeCategory,
  decodeRequest,
  decodeVec,
  treasuryErrorMessage,
  type Category,
  type Request,
} from '../types.js';

/** A contract error already translated to a user-facing, plain-English message. */
export class TreasuryCallError extends Error {
  readonly code: number | undefined;

  constructor(code: number | undefined) {
    super(treasuryErrorMessage(code));
    this.name = 'TreasuryCallError';
    this.code = code;
  }
}

/**
 * Runs a write and rethrows any {@link ContractError} as a {@link TreasuryCallError}
 * so callers never have to touch a raw contract string.
 */
async function invoke(
  treasuryId: string,
  method: string,
  args: Parameters<typeof writeContract>[2],
  publicKey: string,
  signXdr: SignXdr,
): Promise<string> {
  try {
    const result = await writeContract(treasuryId, method, args, publicKey, signXdr);
    return result.hash;
  } catch (error) {
    if (error instanceof ContractError) {
      throw new TreasuryCallError(error.code);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Admin — approvers & threshold
// ---------------------------------------------------------------------------

export function addApprover(
  treasuryId: string,
  admin: string,
  approver: string,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(treasuryId, 'add_approver', [addressArg(admin), addressArg(approver)], admin, signXdr);
}

export function removeApprover(
  treasuryId: string,
  admin: string,
  approver: string,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'remove_approver',
    [addressArg(admin), addressArg(approver)],
    admin,
    signXdr,
  );
}

export function setThreshold(
  treasuryId: string,
  admin: string,
  threshold: number,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(treasuryId, 'set_threshold', [addressArg(admin), u32Arg(threshold)], admin, signXdr);
}

// ---------------------------------------------------------------------------
// Admin — categories
// ---------------------------------------------------------------------------

export function createCategory(
  treasuryId: string,
  admin: string,
  name: string,
  cap: bigint,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'create_category',
    [addressArg(admin), stringArg(name), i128Arg(cap)],
    admin,
    signXdr,
  );
}

export function updateCategoryCap(
  treasuryId: string,
  admin: string,
  categoryId: number,
  newCap: bigint,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'update_category_cap',
    [addressArg(admin), u32Arg(categoryId), i128Arg(newCap)],
    admin,
    signXdr,
  );
}

export function setCategoryActive(
  treasuryId: string,
  admin: string,
  categoryId: number,
  active: boolean,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'set_category_active',
    [addressArg(admin), u32Arg(categoryId), boolArg(active)],
    admin,
    signXdr,
  );
}

// ---------------------------------------------------------------------------
// Funds & requests
// ---------------------------------------------------------------------------

export function deposit(
  treasuryId: string,
  from: string,
  amount: bigint,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(treasuryId, 'deposit', [addressArg(from), i128Arg(amount)], from, signXdr);
}

export function submitRequest(
  treasuryId: string,
  requester: string,
  categoryId: number,
  recipient: string,
  amount: bigint,
  memo: string,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'submit_request',
    [
      addressArg(requester),
      u32Arg(categoryId),
      addressArg(recipient),
      i128Arg(amount),
      stringArg(memo),
    ],
    requester,
    signXdr,
  );
}

export function approveRequest(
  treasuryId: string,
  approver: string,
  requestId: number,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'approve_request',
    [addressArg(approver), u32Arg(requestId)],
    approver,
    signXdr,
  );
}

export function rejectRequest(
  treasuryId: string,
  approver: string,
  requestId: number,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'reject_request',
    [addressArg(approver), u32Arg(requestId)],
    approver,
    signXdr,
  );
}

export function cancelRequest(
  treasuryId: string,
  requester: string,
  requestId: number,
  signXdr: SignXdr,
): Promise<string> {
  return invoke(
    treasuryId,
    'cancel_request',
    [addressArg(requester), u32Arg(requestId)],
    requester,
    signXdr,
  );
}

// ---------------------------------------------------------------------------
// Views — free reads, no signature
// ---------------------------------------------------------------------------

export async function getCategory(treasuryId: string, categoryId: number): Promise<Category> {
  const raw = await readContract(treasuryId, 'get_category', [u32Arg(categoryId)]);
  return decodeCategory(raw);
}

export async function getCategories(treasuryId: string): Promise<Category[]> {
  const raw = await readContract(treasuryId, 'get_categories');
  return decodeVec(raw, decodeCategory, 'Vec<Category>');
}

export async function getRequest(treasuryId: string, requestId: number): Promise<Request> {
  const raw = await readContract(treasuryId, 'get_request', [u32Arg(requestId)]);
  return decodeRequest(raw);
}

export async function getRequestsByCategory(
  treasuryId: string,
  categoryId: number,
): Promise<Request[]> {
  const raw = await readContract(treasuryId, 'get_requests_by_category', [u32Arg(categoryId)]);
  return decodeVec(raw, decodeRequest, 'Vec<Request>');
}

export async function getBalance(treasuryId: string): Promise<bigint> {
  const raw = await readContract<bigint>(treasuryId, 'get_balance');
  return typeof raw === 'bigint' ? raw : BigInt(String(raw));
}

export async function getApprovers(treasuryId: string): Promise<string[]> {
  const raw = await readContract(treasuryId, 'get_approvers');
  if (!Array.isArray(raw)) {
    throw new TypeError('Expected an array of approver addresses');
  }
  return raw.map((entry) => String(entry));
}

export async function getThreshold(treasuryId: string): Promise<number> {
  const raw = await readContract<number>(treasuryId, 'get_threshold');
  return Number(raw);
}
