/**
 * Shared link primitives for the landing page's neo-brutalist surface.
 *
 * CtaButton renders the bordered, offset-shadow button in two fills (primary =
 * ledger-gold, secondary = paper-raised) and two sizes; hover collapses the 4px
 * shadow toward the surface. Internal targets use next/link; external ones open
 * in a new tab with a trailing ↗ and a screen-reader hint. ExternalLink is the
 * text-link counterpart: underline-on-hover with the same ↗ convention.
 *
 * No client state here — these render on the server.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '../../lib/format';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-card border-2 border-ink font-medium leading-none shadow-brutal transition-[transform,box-shadow] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-brutal-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper motion-reduce:transition-none';

const VARIANT = {
  primary: 'bg-ledger-gold text-ink',
  secondary: 'bg-paper-raised text-ink',
} as const;

const SIZE = {
  md: 'px-5 py-3 text-[16px]',
  sm: 'px-4 py-2.5 text-[15px]',
} as const;

export function CtaButton({
  href,
  variant = 'primary',
  size = 'md',
  external = false,
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  /** Open in a new tab with a ↗ affordance. Use for off-site destinations. */
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = cn(BASE, VARIANT[variant], SIZE[size], className);

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
        <span aria-hidden>↗</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        className,
      )}
    >
      {children}
      <span aria-hidden>↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
