// XDR argument encoding helpers.
//
// Each helper converts a plain JS value into the `xdr.ScVal` the Soroban host
// expects for a specific contract parameter type. Contract client wrappers in
// `contracts/` compose these — no page or component ever hand-rolls an ScVal.
//
// Numeric-type discipline:
//   - u32 params take a `number` (the u32 range fits safely in a JS number).
//   - i128 params take a `bigint` — never a `number`. i128 values routinely
//     exceed 2^53, so a `number` would silently lose precision.
//
// We build ScVals with the explicit `xdr.ScVal.scv*` constructors wherever one
// exists — they are precisely typed in stellar-sdk v16, unlike the loose
// `nativeToScVal(value, { type: 'string-literal' })` form. i128 is the sole
// exception: its constructor wants hand-assembled Int128Parts, so we let
// nativeToScVal do the limb-splitting from a bigint.

import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';

/** `Address` argument (account `G...` or contract `C...`). */
export const addressArg = (addr: string): xdr.ScVal => new Address(addr).toScVal();

/** `u32` argument. Accepts a JS number; the u32 range fits in a number safely. */
export const u32Arg = (n: number): xdr.ScVal => xdr.ScVal.scvU32(n);

/** `i128` argument. Takes a bigint so values above 2^53 keep full precision. */
export const i128Arg = (n: bigint): xdr.ScVal => nativeToScVal(n, { type: 'i128' });

/** `String` argument. */
export const stringArg = (s: string): xdr.ScVal => xdr.ScVal.scvString(s);

/** `bool` argument. */
export const boolArg = (b: boolean): xdr.ScVal => xdr.ScVal.scvBool(b);

/** `Vec<Address>` argument (e.g. a treasury's approver set). */
export const addressVecArg = (addrs: string[]): xdr.ScVal =>
  xdr.ScVal.scvVec(addrs.map((a) => new Address(a).toScVal()));

/**
 * `BytesN<32>` argument (e.g. the treasury wasm hash the factory deploys from).
 * Accepts either a 64-char hex string or a raw 32-byte array; throws on any
 * other length so a malformed hash fails loudly at encode time rather than
 * producing a rejected transaction.
 */
export const bytesN32Arg = (value: string | Uint8Array): xdr.ScVal => {
  const bytes = typeof value === 'string' ? hexToBytes(value) : value;
  if (bytes.length !== 32) {
    throw new Error(`BytesN<32> expects 32 bytes, received ${bytes.length}`);
  }
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
