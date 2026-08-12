'use client';

/**
 * ThresholdMeter — the landing page's one moving part.
 *
 * A horizontal pill split into `total` equal segments separated by hard 2px ink
 * gaps. `filled` segments carry the ledger-gold fill; when the meter is fully
 * met (`filled === total`) the final segment turns signal-green and shows a
 * check, reading as "policy satisfied". It renders the same neo-brutalist
 * language as the surrounding cards: 2px ink border, full pill radius.
 *
 * `animate` (used only in the hero) fills the segments left-to-right over ~800ms
 * on mount. Under `prefers-reduced-motion` the meter renders fully filled
 * immediately with no animation. The optional `label` carries the meaning in
 * text (mono figures), so the state never depends on colour alone; when a label
 * is present the bar itself is decorative (aria-hidden) and the label is the
 * accessible name, otherwise the bar exposes its own "n of m" aria-label.
 */
import { useEffect, useState } from 'react';

import { cn } from '../../lib/format';

const FILL_DURATION_MS = 800;

export function ThresholdMeter({
  filled,
  total,
  label,
  animate = false,
  className,
}: {
  /** Segments that are met. Clamped into [0, total]. */
  filled: number;
  /** Total required segments. */
  total: number;
  /** Visible caption (e.g. "3 of 5 approvals"); also the accessible name. */
  label?: string;
  /** Fill left-to-right on mount. Honours prefers-reduced-motion. */
  animate?: boolean;
  className?: string;
}) {
  const segments = Math.max(0, Math.trunc(total));
  const target = Math.max(0, Math.min(Math.trunc(filled), segments));
  const complete = segments > 0 && target === segments;

  // Deterministic first render for hydration: animated meters start empty, all
  // others start at their final fill. prefers-reduced-motion is read only in the
  // effect (matchMedia is unavailable during SSR).
  const [shown, setShown] = useState(animate ? 0 : target);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!animate || reduced || target === 0) {
      setShown(target);
      return;
    }

    setShown(0);
    const step = FILL_DURATION_MS / target;
    const timers = Array.from({ length: target }, (_, i) =>
      setTimeout(() => setShown(i + 1), Math.round(step * (i + 1))),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [animate, target]);

  const bar = (
    <span
      className={cn(
        'flex h-4 gap-[2px] overflow-hidden rounded-pill border-2 border-ink bg-ink',
        !label && 'inline-flex',
      )}
      {...(label
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': `${target} of ${segments}` })}
    >
      {Array.from({ length: segments }, (_, i) => {
        const isFilled = i < shown;
        const isGreen = complete && i === segments - 1;
        return (
          <span
            key={i}
            className={cn(
              'flex flex-1 items-center justify-center transition-colors duration-200 motion-reduce:transition-none',
              !isFilled && 'bg-ink/10',
              isFilled && (isGreen ? 'bg-signal-green' : 'bg-ledger-gold'),
            )}
          >
            {isFilled && isGreen ? (
              <svg
                viewBox="0 0 16 16"
                className="h-2.5 w-2.5 text-paper"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
              </svg>
            ) : null}
          </span>
        );
      })}
    </span>
  );

  if (!label) {
    return <span className={cn('inline-flex', className)}>{bar}</span>;
  }

  return (
    <span className={cn('flex flex-col gap-2', className)}>
      {bar}
      <span className="font-mono text-[13px] font-medium text-ink/70">{label}</span>
    </span>
  );
}
