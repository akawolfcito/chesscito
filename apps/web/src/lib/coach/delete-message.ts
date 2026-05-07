/**
 * Single source of truth for the DELETE /api/coach/history signed
 * message template. Imported by both the editorial COACH_COPY surface
 * (client) and the route handler (server) — drift between the two
 * would silently break every DELETE with a 403 (signature mismatch).
 *
 * Spec §8.2 — chain + domain bound to prevent cross-app/cross-chain
 * signature reuse (red-team P0-1).
 */
export function buildDeleteMessage(nonce: string, issuedIso: string): string {
  return `Delete my Coach history\nDomain: chesscito.app\nChain: 42220\nNonce: ${nonce}\nIssued: ${issuedIso}`;
}
