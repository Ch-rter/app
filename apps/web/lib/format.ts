/** Tiny classpath joiner — filters falsy values so conditional classes read cleanly. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Shortens a Stellar address to `GABC…WXYZ` for dense display. Full addresses
 * stay available via title/copy affordances at the call site.
 */
export function truncateAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Stellar tokens carry 7 decimal places; a raw amount of 10_000_000 = 1 unit. */
export const TOKEN_DECIMALS = 7;

/**
 * Formats a raw integer token amount (as a decimal string, e.g. an i128 from
 * the contract) into a human-readable value with thousands separators.
 *
 * Bigint-safe throughout: the raw value is never parsed to a float, so the full
 * i128 range survives. Trailing zeros in the fractional part are trimmed, and
 * the result never shows more than `decimals` fractional digits.
 *
 * @example formatAmount('12345670000') → '1,234.567'
 */
export function formatAmount(raw: string, decimals = TOKEN_DECIMALS): string {
  const negative = raw.startsWith('-');
  const digits = (negative ? raw.slice(1) : raw).replace(/^0+(?=\d)/, '');

  let whole: string;
  let fraction: string;
  if (decimals === 0) {
    whole = digits;
    fraction = '';
  } else {
    const padded = digits.padStart(decimals + 1, '0');
    whole = padded.slice(0, padded.length - decimals);
    fraction = padded.slice(padded.length - decimals).replace(/0+$/, '');
  }

  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = fraction === '' ? groupedWhole : `${groupedWhole}.${fraction}`;
  return negative && body !== '0' ? `-${body}` : body;
}
