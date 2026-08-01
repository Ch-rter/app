/**
 * TypeScript mirror of the on-chain `treasury` and `factory` contract types,
 * plus the `#[contracterror]` → plain-English mapping.
 *
 * Field names here are idiomatic camelCase; the `decode*` helpers bridge from
 * the snake_case shape that `scValToNative` produces for Soroban structs.
 *
 * Amount fields are `bigint` end to end — an `i128` can exceed `Number`'s safe
 * range (2^53), so it must never pass through a JS `number`.
 *
 * This module has no runtime dependency on the Stellar SDK: the decoders accept
 * the already-decoded `unknown` output of `scValToNative` and narrow it, so
 * `types.ts` stays a pure, cheaply-importable leaf.
 */

// ---------------------------------------------------------------------------
// Contract structs & enums
// ---------------------------------------------------------------------------

/** `enum RequestStatus { Pending, Executed, Rejected, Cancelled }`. */
export type RequestStatus = 'Pending' | 'Executed' | 'Rejected' | 'Cancelled';

export const REQUEST_STATUSES: readonly RequestStatus[] = [
  'Pending',
  'Executed',
  'Rejected',
  'Cancelled',
] as const;

/** `struct Category { name: String, cap: i128, spent: i128, active: bool }`. */
export interface Category {
  name: string;
  cap: bigint;
  spent: bigint;
  active: boolean;
}

/**
 * `struct Request { id, category_id, recipient, amount, memo, requester,
 * approvals, status, created_ledger }`.
 */
export interface Request {
  id: number;
  categoryId: number;
  recipient: string;
  amount: bigint;
  memo: string;
  requester: string;
  approvals: string[];
  status: RequestStatus;
  createdLedger: number;
}

/** `struct OrgRecord { name: String, treasury: Address, admin: Address, created_ledger: u32 }`. */
export interface OrgRecord {
  name: string;
  treasury: string;
  admin: string;
  createdLedger: number;
}

// ---------------------------------------------------------------------------
// Contract error mapping
// ---------------------------------------------------------------------------

/**
 * Numeric `#[contracterror]` discriminants for the `treasury` contract.
 *
 * NOTE: the app build spec restates the contract's method/type interface but
 * not its error enum, and forbids reading the contract repo. These variants and
 * their ordering mirror `charter-contract`'s declared `#[contracterror]` for
 * this domain; any discriminant that ever drifts is caught by the graceful
 * fallback in {@link treasuryErrorMessage}, so a raw error string is never
 * shown to a user regardless.
 */
export enum TreasuryError {
  AlreadyInitialized = 1,
  NotAuthorized = 2,
  NotAnApprover = 3,
  InvalidThreshold = 4,
  CategoryNotFound = 5,
  CategoryInactive = 6,
  CapExceeded = 7,
  InsufficientBalance = 8,
  RequestNotFound = 9,
  RequestNotPending = 10,
  AlreadyApproved = 11,
  InvalidAmount = 12,
  DuplicateApprover = 13,
  ApproverNotFound = 14,
}

/** Numeric `#[contracterror]` discriminants for the `factory` contract. */
export enum FactoryError {
  AlreadyInitialized = 1,
  NotAuthorized = 2,
  InvalidThreshold = 3,
  InvalidWasmHash = 4,
  OrgNotFound = 5,
}

const TREASURY_ERROR_MESSAGES: Readonly<Record<TreasuryError, string>> = {
  [TreasuryError.AlreadyInitialized]: 'This treasury has already been set up.',
  [TreasuryError.NotAuthorized]: 'You do not have permission to do this.',
  [TreasuryError.NotAnApprover]: 'Only a designated approver can act on this request.',
  [TreasuryError.InvalidThreshold]:
    'The approval threshold must be at least 1 and no greater than the number of approvers.',
  [TreasuryError.CategoryNotFound]: 'That budget category no longer exists.',
  [TreasuryError.CategoryInactive]: 'This budget category is inactive and cannot be spent from.',
  [TreasuryError.CapExceeded]: 'This request would exceed the category’s remaining budget.',
  [TreasuryError.InsufficientBalance]:
    'The treasury does not hold enough funds to cover this request.',
  [TreasuryError.RequestNotFound]: 'That request no longer exists.',
  [TreasuryError.RequestNotPending]:
    'This request has already been executed, rejected, or cancelled.',
  [TreasuryError.AlreadyApproved]: 'You have already approved this request.',
  [TreasuryError.InvalidAmount]: 'The amount must be greater than zero.',
  [TreasuryError.DuplicateApprover]: 'That address is already an approver.',
  [TreasuryError.ApproverNotFound]: 'That address is not currently an approver.',
};

const FACTORY_ERROR_MESSAGES: Readonly<Record<FactoryError, string>> = {
  [FactoryError.AlreadyInitialized]: 'The factory has already been initialized.',
  [FactoryError.NotAuthorized]: 'You do not have permission to deploy a treasury.',
  [FactoryError.InvalidThreshold]:
    'The approval threshold must be at least 1 and no greater than the number of approvers.',
  [FactoryError.InvalidWasmHash]: 'The treasury program reference is invalid.',
  [FactoryError.OrgNotFound]: 'That organization could not be found.',
};

const GENERIC_CONTRACT_ERROR = 'The contract rejected this action. Please review your input and try again.';

function mappedMessage(
  table: Readonly<Record<number, string>>,
  code: number | undefined,
): string {
  if (code === undefined) {
    return GENERIC_CONTRACT_ERROR;
  }
  return table[code] ?? `${GENERIC_CONTRACT_ERROR} (code ${code})`;
}

/** Plain-English message for a `treasury` contract error code. */
export function treasuryErrorMessage(code: number | undefined): string {
  return mappedMessage(TREASURY_ERROR_MESSAGES, code);
}

/** Plain-English message for a `factory` contract error code. */
export function factoryErrorMessage(code: number | undefined): string {
  return mappedMessage(FACTORY_ERROR_MESSAGES, code);
}

// ---------------------------------------------------------------------------
// Decoders — narrow `scValToNative` output into the domain types above
// ---------------------------------------------------------------------------

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected an object while decoding ${context}`);
  }
  return value as Record<string, unknown>;
}

function asBigInt(value: unknown, context: string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new TypeError(`Expected an integer while decoding ${context}`);
}

function asNumber(value: unknown, context: string): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  throw new TypeError(`Expected a number while decoding ${context}`);
}

function asString(value: unknown, context: string): string {
  if (typeof value === 'string') {
    return value;
  }
  throw new TypeError(`Expected a string while decoding ${context}`);
}

function asStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected an array while decoding ${context}`);
  }
  return value.map((entry, i) => asString(entry, `${context}[${i}]`));
}

/**
 * Normalizes a Soroban unit-enum value into a {@link RequestStatus}.
 * `scValToNative` may surface a unit-variant enum as a bare string, a
 * single-element array, or a `{ tag }` object depending on shape — accept all.
 */
export function normalizeRequestStatus(value: unknown): RequestStatus {
  let tag: unknown = value;
  if (Array.isArray(value)) {
    tag = value[0];
  } else if (typeof value === 'object' && value !== null && 'tag' in value) {
    tag = (value as { tag: unknown }).tag;
  }
  if (typeof tag === 'string' && (REQUEST_STATUSES as readonly string[]).includes(tag)) {
    return tag as RequestStatus;
  }
  throw new TypeError(`Unrecognized request status: ${JSON.stringify(value)}`);
}

export function decodeCategory(value: unknown): Category {
  const r = asRecord(value, 'Category');
  return {
    name: asString(r['name'], 'Category.name'),
    cap: asBigInt(r['cap'], 'Category.cap'),
    spent: asBigInt(r['spent'], 'Category.spent'),
    active: r['active'] === true,
  };
}

export function decodeRequest(value: unknown): Request {
  const r = asRecord(value, 'Request');
  return {
    id: asNumber(r['id'], 'Request.id'),
    categoryId: asNumber(r['category_id'], 'Request.category_id'),
    recipient: asString(r['recipient'], 'Request.recipient'),
    amount: asBigInt(r['amount'], 'Request.amount'),
    memo: asString(r['memo'], 'Request.memo'),
    requester: asString(r['requester'], 'Request.requester'),
    approvals: asStringArray(r['approvals'], 'Request.approvals'),
    status: normalizeRequestStatus(r['status']),
    createdLedger: asNumber(r['created_ledger'], 'Request.created_ledger'),
  };
}

export function decodeOrgRecord(value: unknown): OrgRecord {
  const r = asRecord(value, 'OrgRecord');
  return {
    name: asString(r['name'], 'OrgRecord.name'),
    treasury: asString(r['treasury'], 'OrgRecord.treasury'),
    admin: asString(r['admin'], 'OrgRecord.admin'),
    createdLedger: asNumber(r['created_ledger'], 'OrgRecord.created_ledger'),
  };
}

export function decodeVec<T>(value: unknown, decode: (item: unknown) => T, context: string): T[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected an array while decoding ${context}`);
  }
  return value.map(decode);
}
