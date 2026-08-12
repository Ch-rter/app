import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '../globals.css';

export const metadata: Metadata = {
  title: 'Charter — On-chain treasury policy for Stellar organizations',
  description:
    'Charter holds organization funds under a Soroban policy contract: budget categories, spend caps, and threshold approvals enforced on-chain at the moment money moves.',
};

// Root layout for the public marketing group. Deliberately independent of the
// dashboard shell in (app)/ — its own <html>/<body>, its own theme and fonts,
// and no wallet Providers. Sections and the light neo-brutalist theme land in
// follow-up commits; this is the routing scaffold only.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
