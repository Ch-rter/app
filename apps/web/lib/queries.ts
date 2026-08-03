/**
 * React Query definitions for indexer-backed data.
 *
 * Query keys and fetchers live together so every caller shares one cache entry
 * per resource and invalidation stays consistent. All data fetching in the app
 * flows through these — components never call the indexer client directly.
 */
import { queryOptions } from '@tanstack/react-query';

import { fetchOrgs } from './indexer';

/** Namespaced query keys, so `invalidateQueries({ queryKey: qk.orgs() })` is unambiguous. */
export const qk = {
  orgs: () => ['orgs'] as const,
} satisfies Record<string, (...args: never[]) => readonly unknown[]>;

/** The organization directory: every indexed treasury, newest first. */
export function orgsQuery() {
  return queryOptions({
    queryKey: qk.orgs(),
    queryFn: ({ signal }) => fetchOrgs(signal),
  });
}
