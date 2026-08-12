import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';

import '../globals.css';

// Display headlines, body copy, and mono figures for the landing page. Each
// exposes a CSS variable that the Tailwind config reads (font-display / -body /
// -mono). --font-mono is deliberately reused: the marketing tree repoints it at
// IBM Plex Mono, while the dashboard root keeps JetBrains Mono under the same
// token.
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
  title: 'Charter — On-chain treasury policy for Stellar organizations',
  description:
    'Charter holds organization funds under a Soroban policy contract: budget categories, spend caps, and threshold approvals enforced on-chain at the moment money moves.',
};

// Root layout for the public marketing group. Deliberately independent of the
// dashboard shell in (app)/ — its own <html>/<body>, its own light theme and
// fonts, and no wallet Providers. The marketing-root class (see globals.css)
// carries the light neo-brutalist theme; bg-paper on the body overrides the
// shared dark canvas default.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`marketing-root ${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
