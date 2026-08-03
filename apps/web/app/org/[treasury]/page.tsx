import { TreasuryDashboard } from '../../../components/treasury-dashboard';

/**
 * Treasury dashboard route: /org/{treasuryAddress}.
 *
 * The treasury address is the org's identity. This server component unwraps the
 * route param and hands it to the client dashboard, which owns all data
 * fetching (org metadata, on-chain balance, budget categories) and its own
 * loading, empty, and error states.
 */
export default async function OrgPage({
  params,
}: {
  params: Promise<{ treasury: string }>;
}) {
  const { treasury } = await params;
  return <TreasuryDashboard treasury={treasury} />;
}
