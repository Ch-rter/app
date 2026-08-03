import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared QueryClient factory for the app.
 *
 * All Charter data is either on-chain state read via free RPC simulation or
 * indexed history served by the read-only indexer API — both are cheap to
 * refetch and benefit from staying fresh while a treasury is being operated on.
 * Defaults are tuned for that: a short stale window so approval counts and
 * balances update promptly, with retry kept low so a down RPC surfaces fast
 * rather than hanging the UI behind silent backoff.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
