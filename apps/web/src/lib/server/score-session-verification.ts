/**
 * Score write sessions — signature verification (Slice 0.1).
 *
 * Recovers the wallet that agreed to a session's terms. This is the ONE place
 * a signature is checked in the score write path now; after this, saves ride a
 * bearer token.
 *
 * Mirrors `lib/server/welcome-pack.ts`, the existing proven personal_sign
 * verification in this codebase, so both paths fail the same way.
 */

import { verifyMessage } from "viem";

import {
  parseScoreSessionMessage,
  validateScoreSessionChallenge,
  type ScoreSessionChallenge,
  type ScoreSessionClaimError,
} from "@/lib/scores/session-authorization";
import type { ScoreSaveSurface } from "@/lib/scores/save-authorization";

export type ScoreSessionVerificationError =
  | ScoreSessionClaimError
  | "missing_signature"
  | "signature_mismatch";

export type ScoreSessionVerification =
  | { ok: true; challenge: ScoreSessionChallenge; wallet: `0x${string}` }
  | { ok: false; error: ScoreSessionVerificationError };

/** 65-byte ECDSA signature, hex-encoded. */
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;

/**
 * Verify a session authorization end-to-end:
 *   1. Message parses into the canonical v1 shape (strict, anchored regex).
 *   2. Terms pass server policy — chain, surface vs deployment, window, budget.
 *   3. Signature recovers to the wallet named inside the message.
 *
 * The recovered address is the only source of identity. The in-message
 * `wallet` exists so the prompt names who is signing and so the signature is
 * bound to one address; step 3 is an equality check against the recovery
 * result, never a lookup.
 *
 * This does NOT prove the terms are the ones the server issued — a client can
 * sign a message it invented. That is caught in the store, which matches on
 * `sessionId` against the row it wrote. Both checks are needed: this one is
 * cheap and runs first, the store's is authoritative.
 */
export async function verifyScoreSessionRequest(
  input: { message: unknown; signature: unknown },
  opts: {
    expectedSurface: ScoreSaveSurface;
    expectedChainId: number | null;
    now?: number;
  },
): Promise<ScoreSessionVerification> {
  const { expectedSurface, expectedChainId, now = Date.now() } = opts;

  const challenge = parseScoreSessionMessage(input.message);
  if (!challenge) {
    return { ok: false, error: "invalid_message" };
  }

  // Policy BEFORE crypto: an unbounded caller must not be able to make us burn
  // ECDSA recoveries with garbage payloads.
  const validation = validateScoreSessionChallenge(challenge, {
    expectedSurface,
    expectedChainId,
    nowSeconds: Math.floor(now / 1000),
  });
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  if (typeof input.signature !== "string" || !SIGNATURE_RE.test(input.signature)) {
    return { ok: false, error: "missing_signature" };
  }

  // The RAW string the client sent is what gets verified — already proven to
  // equal the canonical shape by the anchored regex — so a rebuild cannot
  // introduce a difference viem would hash differently.
  let valid = false;
  try {
    valid = await verifyMessage({
      address: challenge.wallet as `0x${string}`,
      message: input.message as string,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    return { ok: false, error: "signature_mismatch" };
  }

  if (!valid) {
    return { ok: false, error: "signature_mismatch" };
  }

  return {
    ok: true,
    challenge: validation.challenge,
    wallet: validation.challenge.wallet as `0x${string}`,
  };
}
