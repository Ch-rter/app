/**
 * Public runtime configuration, read once and validated.
 *
 * Every value here is a `NEXT_PUBLIC_*` var inlined at build time. Missing
 * config is a deployment mistake, so accessors throw rather than falling back
 * to a localhost default that would silently ship to production. The SDK's RPC
 * layer reads the RPC URL and passphrase directly from `process.env`; this
 * module covers the values the web layer itself needs.
 */

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Set it in apps/web/.env.local (see .env.example).',
    );
  }
  return value.trim();
}

/** Base URL of the read-only indexer REST API. No localhost fallback. */
export function indexerApiUrl(): string {
  return required('NEXT_PUBLIC_INDEXER_API_URL', process.env.NEXT_PUBLIC_INDEXER_API_URL);
}

/** The factory contract the new-org flow deploys treasuries through. */
export function factoryContractId(): string {
  return required('NEXT_PUBLIC_FACTORY_CONTRACT_ID', process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID);
}

/** The Stellar network passphrase every transaction is signed against. */
export function networkPassphrase(): string {
  return required(
    'NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE',
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
  );
}

/**
 * Human-readable network label derived from the passphrase, for display in the
 * wallet UI. Falls back to the raw passphrase for custom networks.
 */
export function networkLabel(): string {
  const passphrase = networkPassphrase();
  if (passphrase.startsWith('Public Global Stellar Network')) return 'Mainnet';
  if (passphrase.startsWith('Test SDF Network')) return 'Testnet';
  if (passphrase.startsWith('Test SDF Future Network')) return 'Futurenet';
  return passphrase;
}
