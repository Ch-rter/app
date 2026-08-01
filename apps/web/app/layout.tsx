import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Charter — Treasury Operations',
  description:
    'Charter is a treasury operations layer for Stellar-based organizations: budget categories, threshold approvals, and on-chain disbursements.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
