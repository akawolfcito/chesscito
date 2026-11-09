/**
 * Claim Gift telemetry — Lite B1.2.
 *
 * Five events covering the Lite Welcome Gift claim funnel
 * (idle → signing → success | rejected | failed). All events
 * carry `isLite: true` so the grant dashboard can filter the
 * Lite cohort without ambiguity.
 *
 * Privacy rules — NEVER include:
 *   - wallet address
 *   - signature or signed message
 *   - raw error messages (may contain provider data)
 *
 * Error classification uses a short normalized vocabulary:
 *   "user_rejected" → user cancelled the wallet prompt
 *   "sign_failed"   → signing call failed (network / provider)
 *   "unknown"       → fallback for unclassified errors
 *
 * Fire-and-forget via the existing `track()` contract — analytics
 * failures MUST NOT block the Claim Gift user flow.
 */

import { track } from "@/lib/telemetry";

export type ClaimGiftFailReason = "user_rejected" | "sign_failed" | "unknown";

/** User tapped the Claim button — fires at entry before any state change. */
export function emitClaimGiftTap(): void {
  track("claim_gift_tap", { isLite: true });
}

/** Wallet signing prompt shown. Only fires on the wallet path (hadWallet always true). */
export function emitClaimGiftSigning(): void {
  track("claim_gift_signing", { isLite: true, hadWallet: true });
}

/**
 * Signature confirmed or no-wallet fast-path completed.
 * `hadWallet: false` signals the graceful-degradation path where
 * no wallet was connected and we skipped the signing step.
 */
export function emitClaimGiftSuccess(hadWallet: boolean): void {
  track("claim_gift_success", { isLite: true, hadWallet });
}

/** User explicitly rejected the wallet signing prompt. */
export function emitClaimGiftRejected(): void {
  track("claim_gift_rejected", { isLite: true });
}

/** Signing call failed for a non-rejection reason. Reason is normalized — no raw error. */
export function emitClaimGiftFailed(reason: ClaimGiftFailReason): void {
  track("claim_gift_failed", { isLite: true, reason });
}
