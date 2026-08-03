'use client';

/**
 * Client-side provider tree.
 *
 * Wraps the app in a react-query provider (one client per browser session) and
 * kicks off a silent wallet reconnect on mount so a returning user lands
 * already connected. Rendered once from the root layout.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';

import { createQueryClient } from '../lib/query-client';
import { useWalletStore } from '../store/wallet';

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient for the life of the tab; useRef avoids recreating it on
  // re-render (which would drop the cache).
  const clientRef = useRef<ReturnType<typeof createQueryClient>>(undefined);
  if (clientRef.current === undefined) {
    clientRef.current = createQueryClient();
  }

  const restore = useWalletStore((s) => s.restore);
  useEffect(() => {
    void restore();
  }, [restore]);

  return <QueryClientProvider client={clientRef.current}>{children}</QueryClientProvider>;
}
