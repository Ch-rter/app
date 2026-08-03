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

/** Outcome of `deploy_treasury`: the confirmed tx hash plus the new treasury address. */
export interface DeployTreasuryResult {
  hash: string;
  treasuryAddress: string;
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
  try {
    const result = await writeContract(
      factoryId,
      'deploy_treasury',
      [
        addressArg(admin),
        stringArg(name),
        addressVecArg(approvers),
        u32Arg(threshold),
        addressArg(token),
      ],
      admin,
      signXdr,
    );
    const treasuryAddress = result.returnValue;
    if (typeof treasuryAddress !== 'string') {
      throw new Error('deploy_treasury did not return a treasury address');
    }
    return { hash: result.hash, treasuryAddress };
  } catch (error) {
    if (error instanceof ContractError) {
      throw new FactoryCallError(error.code);
    }
    throw error;
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
