import { RequestDetail } from '../../../../../components/request-detail';

/**
 * Request detail route: /org/{treasuryAddress}/requests/{requestId}.
 *
 * The treasury address plus the numeric request id identify one disbursement
 * request. This server component unwraps both route params and hands them to the
 * client detail view, which owns all data fetching (the request, the treasury's
 * threshold and approvers, the parent category) and its own loading, empty, and
 * error states.
 */
export default async function RequestPage({
  params,
}: {
  params: Promise<{ treasury: string; requestId: string }>;
}) {
  const { treasury, requestId } = await params;
  return <RequestDetail treasury={treasury} requestId={requestId} />;
}
