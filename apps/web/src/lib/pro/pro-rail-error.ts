/**
 * Classifies a `useProRail` error into the buckets `<ProSheet>` already has
 * copy for (PRO_COPY.errors.*) — no new i18n keys needed. Pure so the
 * mapping is unit-testable without next-intl in scope.
 */
export type ProRailErrorKind = "silent" | "notConfigured" | "verifyFailed" | "generic";

export function classifyProRailError(
  errorReason: string | null | undefined,
  hasTxHash: boolean,
): ProRailErrorKind {
  if (!errorReason || errorReason === "user_rejected" || errorReason === "tx_rejected") {
    return "silent";
  }
  // A txHash only exists once the transfer has been sent — the payment
  // already landed on-chain, so any failure past this point is a
  // verification hiccup, not a lost purchase.
  if (hasTxHash) return "verifyFailed";
  if (errorReason === "unavailable" || errorReason === "rail_not_configured" || errorReason === "no_treasury") {
    return "notConfigured";
  }
  return "generic";
}
