export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-start justify-center px-6">
      <p className="text-sm font-mono uppercase tracking-widest text-accent">Charter</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
        Treasury operations for Stellar organizations
      </h1>
      <p className="mt-4 max-w-xl text-ink-muted">
        Budget categories, threshold approvals, and on-chain disbursements — governed
        entirely by your wallet signatures.
      </p>
    </main>
  );
}
