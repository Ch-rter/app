/**
 * Read-only client for the Charter indexer REST API.
 *
 * The indexer folds on-chain events into read models (orgs, categories,
 * requests) and serves them over a small REST surface. This module is the one
 * place the web layer talks to that API; every response type mirrors the
 * indexer's JSON exactly.
 *
 * Amounts (caps, spent totals, request amounts) cross the wire as decimal
 * STRINGS to preserve the full i128 range — they are never parsed to a float
 * here. Callers format them with bigint-safe helpers.
 *
 * The base URL comes from {@link indexerApiUrl}, which throws when unset: there
 * is deliberately no localhost fallback that could ship to production.
 */
import { indexerApiUrl } from './env';

/** An organization: a deployed Soroban treasury, keyed by its address. */
export interface Org {
  id: number;
  name: string;
  treasuryAddress: string;
  adminAddress: string;
  createdLedger: number;
}

/**
 * A budget category within a treasury. `cap` and `spent` are decimal strings
 * (raw i128 token amounts) — format them with a bigint-safe helper, never a
 * float.
 */
export interface Category {
  categoryId: number;
  name: string;
  cap: string;
  spent: string;
  active: boolean;
}

/** Raised when the indexer returns a non-2xx response or is unreachable. */
export class IndexerError extends Error {
  /** HTTP status, or 0 when the request never completed (network/DNS). */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'IndexerError';
    this.status = status;
  }
}

/**
 * Performs a GET against the indexer and decodes the JSON body. Network faults
 * and non-2xx responses both surface as {@link IndexerError} so callers have a
 * single error type to branch on.
 */
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = indexerApiUrl().replace(/\/+$/, '');

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: { accept: 'application/json' },
      signal,
    });
  } catch (cause) {
    throw new IndexerError(
      'Could not reach the indexer. Check your connection and try again.',
      0,
    );
  }

  if (!response.ok) {
    throw new IndexerError(
      `The indexer responded with ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/** Lists every indexed organization, newest first. */
export async function fetchOrgs(signal?: AbortSignal): Promise<Org[]> {
  const { orgs } = await get<{ orgs: Org[] }>('/orgs', signal);
  return orgs;
}

/**
 * Fetches one organization by its treasury address. A 404 surfaces as an
 * {@link IndexerError} with status 404, which callers distinguish from a
 * transport failure (status 0) to show a "not found" state.
 */
export async function fetchOrg(treasury: string, signal?: AbortSignal): Promise<Org> {
  return get<Org>(`/orgs/${encodeURIComponent(treasury)}`, signal);
}

/** Lists a treasury's budget categories, in category-id order. */
export async function fetchCategories(
  treasury: string,
  signal?: AbortSignal,
): Promise<Category[]> {
  const { categories } = await get<{ categories: Category[] }>(
    `/orgs/${encodeURIComponent(treasury)}/categories`,
    signal,
  );
  return categories;
}
