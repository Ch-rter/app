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
