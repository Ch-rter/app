/**
 * `FactoryClient` — the authoritative wrapper for every `factory` contract
 * method. The factory deploys one `treasury` instance per organization and
 * keeps an on-chain registry of them.
 *
 * As with the treasury client, page components call these functions rather than
 * assembling contract calls directly, so the write sequence lives in one place.
 */
import { addressArg, addressVecArg, bytesN32Arg, stringArg, u32Arg } from '../xdr.js';
import { ContractError, readContract, writeContract, type SignXdr } from '../rpc.js';
import { decodeOrgRecord, decodeVec, factoryErrorMessage, type OrgRecord } from '../types.js';

/** A factory contract error translated to a user-facing, plain-English message. */
export class FactoryCallError extends Error {
  readonly code: number | undefined;

  constructor(code: number | undefined) {
    super(factoryErrorMessage(code));
    this.name = 'FactoryCallError';
    this.code = code;
  }
}

/**
 * Outcome of `deploy_treasury`: the confirmed tx hash, the org id the contract
 * returns, and the new treasury address (read back from the org record).
 */
export interface DeployTreasuryResult {
  hash: string;
  orgId: number;
  treasuryAddress: string;
}

/** How long to wait before retrying the post-deploy `get_org` read. */
const ORG_READ_RETRY_DELAY_MS = 2_000;

/**
 * Reads the org record written by a just-confirmed deploy. Testnet RPC can
 * simulate against a snapshot that predates the write for a ledger or two, so
 * a first-try `OrgNotFound` is retried once before giving up.
 */
async function readDeployedOrg(factoryId: string, orgId: number): Promise<OrgRecord> {
  try {
    return await getOrg(factoryId, orgId);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, ORG_READ_RETRY_DELAY_MS));
    return getOrg(factoryId, orgId);
  }
}

/**
 * Registers the treasury program the factory deploys from. Admin-only, run once
 * at factory setup — surfaced here for completeness and operational tooling.
 */
export async function initialize(
  factoryId: string,
  deployer: string,
  wasmHash: string | Uint8Array,
  signXdr: SignXdr,
): Promise<string> {
  try {
    const result = await writeContract(
      factoryId,
      'initialize',
      [addressArg(deployer), bytesN32Arg(wasmHash)],
      deployer,
      signXdr,
    );
    return result.hash;
  } catch (error) {
    if (error instanceof ContractError) {
      throw new FactoryCallError(error.code);
    }
    throw error;
  }
}

/**
 * Deploys a new per-org treasury and returns its address.
 *
 * @param admin      - Account that will administer the new treasury (and signs).
 * @param name       - Human-readable organization name.
 * @param approvers  - Initial approver set.
 * @param threshold  - Approvals required to execute a request.
 * @param token      - SAC token address the treasury holds and disburses.
 */
export async function deployTreasury(
  factoryId: string,
  admin: string,
  name: string,
  approvers: string[],
  threshold: number,
  token: string,
  signXdr: SignXdr,
): Promise<DeployTreasuryResult> {
  let hash: string;
  let orgId: number;
  try {
    // Contract signature: deploy_treasury(name, admin, approvers, threshold, token) -> u32.
    // The TS parameter order above differs; the XDR args must follow the contract.
    const result = await writeContract(
      factoryId,
      'deploy_treasury',
      [
        stringArg(name),
        addressArg(admin),
        addressVecArg(approvers),
        u32Arg(threshold),
        addressArg(token),
      ],
      admin,
      signXdr,
    );
    if (typeof result.returnValue !== 'number') {
      throw new Error('deploy_treasury did not return an org id');
    }
    hash = result.hash;
    orgId = result.returnValue;
  } catch (error) {
    if (error instanceof ContractError) {
      throw new FactoryCallError(error.code);
    }
    throw error;
  }

  // The deploy is already confirmed here, so a failed read-back must not be
  // reported as a contract rejection of the deploy itself.
  try {
    const org = await readDeployedOrg(factoryId, orgId);
    return { hash, orgId, treasuryAddress: org.treasury };
  } catch {
    throw new Error(
      `Organization #${orgId} was created (tx ${hash}), but its treasury address could not be loaded yet. Refresh to find it in the directory.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Views — free reads, no signature
// ---------------------------------------------------------------------------

export async function getOrg(factoryId: string, orgId: number): Promise<OrgRecord> {
  const raw = await readContract(factoryId, 'get_org', [u32Arg(orgId)]);
  return decodeOrgRecord(raw);
}

export async function getOrgCount(factoryId: string): Promise<number> {
  const raw = await readContract<number>(factoryId, 'get_org_count');
  return Number(raw);
}

export async function getOrgs(
  factoryId: string,
  start: number,
  limit: number,
): Promise<OrgRecord[]> {
  const raw = await readContract(factoryId, 'get_orgs', [u32Arg(start), u32Arg(limit)]);
  return decodeVec(raw, decodeOrgRecord, 'Vec<OrgRecord>');
}
