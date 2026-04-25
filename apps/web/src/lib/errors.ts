import { RESULT_OVERLAY_COPY } from "@/lib/content/editorial";

const copy = RESULT_OVERLAY_COPY.error;

export function isUserCancellation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return lower.includes("user rejected") || lower.includes("user denied") || lower.includes("cancelled");
}

export function classifyTxError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (isUserCancellation(error)) {
    return copy.cancelled;
  }
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) {
    return copy.insufficientFunds;
  }
  if (lower.includes("network") || lower.includes("timeout") || lower.includes("disconnected")) {
    return copy.network;
  }
  if (lower.includes("badgealreadyclaimed") || lower.includes("already claimed")) {
    return "You already own this badge!";
  }
  // Server signing endpoint missing config or unavailable. Most often
  // surfaced in local dev when the operator forgot the encrypted
  // signer envs (DRAGON / TORRE_PRINCESA), but also catches prod
  // signer outages. Distinct from user-cancellable errors so the
  // player understands the issue isn't on their side.
  //
  // The "unsupported state or unable to authenticate data" branch is
  // the GCM auth-tag mismatch surfaced by Node's crypto when the
  // TORRE_PRINCESA key doesn't decrypt the DRAGON ciphertext (rotated
  // key, copied wrong env, mismatched envs from prod/dev).
  if (
    lower.includes("missing required env") ||
    lower.includes("sign-badge") ||
    lower.includes("sign-score") ||
    lower.includes("sign-victory") ||
    lower.includes("unsupported state") ||
    lower.includes("authenticate data") ||
    lower.includes("400") ||
    lower.includes("signing")
  ) {
    return "Signing service unavailable — try again in a moment.";
  }
  if (lower.includes("revert") || lower.includes("execution reverted")) {
    return copy.revert;
  }
  return copy.unknown;
}
