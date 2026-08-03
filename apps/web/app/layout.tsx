import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteHeader } from '../components/site-header';
import { Providers } from '../components/providers';
import './globals.css';

// One sans family, one mono. The mono carries addresses, hashes, and amounts —
// anything where character alignment aids scanning; the sans carries everything
// else. Both are wired to the CSS variables globals.css references.
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Charter — Treasury Operations',
  description:
    'Charter is a treasury operations layer for Stellar-based organizations: budget categories, threshold approvals, and on-chain disbursements.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
