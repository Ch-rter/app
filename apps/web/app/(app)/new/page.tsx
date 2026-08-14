import Link from 'next/link';

import { NewOrgForm } from '@/components/new-org-form';

/**
 * New organization route. Deploys a per-org treasury via the factory contract.
 * The form owns wallet-gating, validation, the write sequence, and redirect.
 */
export default function NewOrgPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-8">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-badge border-2 border-ink bg-paper-raised px-3 py-2 text-sm font-medium text-ink shadow-[2px_2px_0_#14171F] transition-[background-color,box-shadow,transform] duration-150 hover:bg-canvas-overlay hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All organizations
        </Link>
      </nav>

      <header className="mb-8 border-b-2 border-ink pb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-ink-muted">Factory deployment</p>
        <h1 className="font-display text-4xl leading-none text-ink sm:text-[40px]">New organization</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">
          Deploy a treasury contract. You&rsquo;ll be its admin, and the approver set
          you define governs every disbursement.
        </p>
      </header>

      <NewOrgForm />
    </div>
  );
}
