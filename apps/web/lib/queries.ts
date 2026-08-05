/**
 * React Query definitions for indexer-backed data.
 *
 * Query keys and fetchers live together so every caller shares one cache entry
 * per resource and invalidation stays consistent. All data fetching in the app
 * flows through these — components never call the indexer client directly.
 */
import { queryOptions } from '@tanstack/react-query';
import { treasury } from '@charter/sdk';

import {
  fetchOrg,
  fetchOrgs,
  fetchCategories,
  fetchRequests,
  fetchRequest,
  type RequestStatus,
} from './indexer';

/** Namespaced query keys, so `invalidateQueries({ queryKey: qk.orgs() })` is unambiguous. */
export const qk = {
  orgs: () => ['orgs'] as const,
  org: (treasuryAddress: string) => ['org', treasuryAddress] as const,
  categories: (treasuryAddress: string) => ['org', treasuryAddress, 'categories'] as const,
  balance: (treasuryAddress: string) => ['org', treasuryAddress, 'balance'] as const,
  threshold: (treasuryAddress: string) => ['org', treasuryAddress, 'threshold'] as const,
  approvers: (treasuryAddress: string) => ['org', treasuryAddress, 'approvers'] as const,
  requests: (treasuryAddress: string, status?: RequestStatus) =>
    ['org', treasuryAddress, 'requests', status ?? 'all'] as const,
  request: (treasuryAddress: string, requestId: number) =>
    ['org', treasuryAddress, 'requests', requestId] as const,
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

/**
 * The number of approvals a request needs before it executes. A free on-chain
 * read; combined with a request's approval count it drives the progress UI.
 */
export function thresholdQuery(treasuryAddress: string) {
  return queryOptions({
    queryKey: qk.threshold(treasuryAddress),
    queryFn: () => treasury.getThreshold(treasuryAddress),
  });
}

/** The treasury's approver set, read live from the contract. */
export function approversQuery(treasuryAddress: string) {
  return queryOptions({
    queryKey: qk.approvers(treasuryAddress),
    queryFn: () => treasury.getApprovers(treasuryAddress),
  });
}

/**
 * A treasury's disbursement requests, from the indexer. An optional status
 * scopes the list to one lifecycle stage; the key includes it so each filter
 * caches independently.
 */
export function requestsQuery(treasuryAddress: string, status?: RequestStatus) {
  return queryOptions({
    queryKey: qk.requests(treasuryAddress, status),
    queryFn: ({ signal }) => fetchRequests(treasuryAddress, status, signal),
  });
}

/** A single disbursement request with its current approvals. */
export function requestQuery(treasuryAddress: string, requestId: number) {
  return queryOptions({
    queryKey: qk.request(treasuryAddress, requestId),
    queryFn: ({ signal }) => fetchRequest(treasuryAddress, requestId, signal),
  });
}
