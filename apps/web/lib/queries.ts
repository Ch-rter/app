/**
 * React Query definitions for indexer-backed data.
 *
 * Query keys and fetchers live together so every caller shares one cache entry
 * per resource and invalidation stays consistent. All data fetching in the app
 * flows through these — components never call the indexer client directly.
 */
import { queryOptions } from '@tanstack/react-query';
import { treasury } from '@charter/sdk';

import { fetchOrg, fetchOrgs, fetchCategories } from './indexer';

/** Namespaced query keys, so `invalidateQueries({ queryKey: qk.orgs() })` is unambiguous. */
export const qk = {
  orgs: () => ['orgs'] as const,
  org: (treasuryAddress: string) => ['org', treasuryAddress] as const,
  categories: (treasuryAddress: string) => ['org', treasuryAddress, 'categories'] as const,
  balance: (treasuryAddress: string) => ['org', treasuryAddress, 'balance'] as const,
} satisfies Record<string, (...args: never[]) => readonly unknown[]>;

/** The organization directory: every indexed treasury, newest first. */
export function orgsQuery() {
  return queryOptions({
    queryKey: qk.orgs(),
    queryFn: ({ signal }) => fetchOrgs(signal),
  });
}

/** A single organization's indexed metadata (name, admin, treasury address). */
export function orgQuery(treasuryAddress: string) {
  return queryOptions({
    queryKey: qk.org(treasuryAddress),
    queryFn: ({ signal }) => fetchOrg(treasuryAddress, signal),
  });
}

/** A treasury's budget categories, from the indexer. */
export function categoriesQuery(treasuryAddress: string) {
  return queryOptions({
    queryKey: qk.categories(treasuryAddress),
    queryFn: ({ signal }) => fetchCategories(treasuryAddress, signal),
  });
}

/**
 * The treasury's live on-chain token balance.
 *
 * This is a free contract simulation (no signature), read straight from the
 * chain rather than the indexer so it reflects the current ledger. The bigint
 * result is returned as a decimal string so it stays bigint-safe through the
 * query cache and formats without ever touching a float.
 */
export function balanceQuery(treasuryAddress: string) {
  return queryOptions({
    queryKey: qk.balance(treasuryAddress),
    queryFn: async () => (await treasury.getBalance(treasuryAddress)).toString(),
  });
}
