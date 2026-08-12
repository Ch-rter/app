import Link from 'next/link';

import { NewOrgForm } from '@/components/new-org-form';

/**
 * New organization route. Deploys a per-org treasury via the factory contract.
 * The form owns wallet-gating, validation, the write sequence, and redirect.
 */
export default function NewOrgPage() {
  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All organizations
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-xl font-semibold text-ink">New organization</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Deploy a treasury contract. You&rsquo;ll be its admin, and the approver set
          you define governs every disbursement.
        </p>
      </header>

      <NewOrgForm />
    </div>
  );
}
