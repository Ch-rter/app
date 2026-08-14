import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/site-header';
import { Providers } from '@/components/providers';
import '../globals.css';

// One sans family, one mono. The mono carries addresses, hashes, and amounts —
// anything where character alignment aids scanning; the sans carries everything
// else. Both are wired to the CSS variables globals.css references.
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Charter — Treasury Operations',
  description:
    'Charter is a treasury operations layer for Stellar-based organizations: budget categories, threshold approvals, and on-chain disbursements.',
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`app-root ${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen font-body">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
