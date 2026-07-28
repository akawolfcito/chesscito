/**
 * SaveScore — server-side signature verification (Slice 0).
 *
 * Recovers the author of a score save from an EIP-191 signature. This is the
 * module that turns `/api/scores/save` from "anyone can write anything for
 * anyone" into "only the wallet that signed can write, and only what it
 * signed" (audit R1).
 *
 * Mirrors the shape of `lib/server/welcome-pack.ts` — the existing, proven
 * personal_sign verification in this codebase — so both paths fail the same
 * way and can be reasoned about together.
 *
 * NOT here: the nonce burn (`score-save-nonce.ts`, needs a DB round trip) and
 * the origin policy (route-level). This module stays a pure function of its
 * inputs plus one viem call, so it is fully testable without Supabase.
 */

import { verifyMessage } from "viem";

import {
  parseScoreSaveMessage,
  validateScoreSaveClaim,
  type ScoreSaveClaim,
  type ScoreSaveClaimError,
  type ScoreSaveSurface,
} from "@/lib/scores/save-authorization";

export type ScoreSaveVerificationError =
  | ScoreSaveClaimError
  | "missing_signature"
  | "signature_mismatch";

export type ScoreSaveVerification =
  | { ok: true; claim: ScoreSaveClaim; player: `0x${string}` }
  | { ok: false; error: ScoreSaveVerificationError };

export type VerifyScoreSaveInput = {
  message: unknown;
  signature: unknown;
};

export type VerifyScoreSaveOptions = {
  expectedSurface: ScoreSaveSurface;
  expectedChainId: number | null;
  /** Unix MILLIseconds. Converted to seconds internally — the message speaks
   *  seconds because it is read by a human in a wallet prompt. */
  now?: number;
};

/** 65-byte ECDSA signature, hex-encoded. Shape-checked before we hand it to
 *  viem so a junk string is a cheap 400 instead of a thrown exception. */
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;

/**
 * Verify a score-save authorization end-to-end:
 *   1. Message parses into the canonical v1 shape (strict, anchored regex).
 *   2. Claim passes every server-side bound — chain, surface vs deployment,
 *      level, score ceiling, time, validity window.
 *   3. Signature recovers to the address named inside the message.
 *
 * The recovered address is the ONLY source of authorship. The in-message
 * `player` exists so the wallet prompt names who is signing and so the
 * signature is bound to one address; it is never trusted on its own — step 3
 * is an equality check against the recovery result, not a lookup.
 *
 * Returns a discriminated union; the route maps `error` to an HTTP status.
 */
export async function verifyScoreSaveRequest(
  input: VerifyScoreSaveInput,
  opts: VerifyScoreSaveOptions,
): Promise<ScoreSaveVerification> {
  const { expectedSurface, expectedChainId, now = Date.now() } = opts;

  const claim = parseScoreSaveMessage(input.message);
  if (!claim) {
    return { ok: false, error: "invalid_message" };
  }

  // Bounds BEFORE crypto: an unbounded caller must not be able to make us
  // burn ECDSA recoveries with garbage payloads.
  const validation = validateScoreSaveClaim(claim, {
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

  // `message` is re-used verbatim: verifying the RAW string the client sent
  // (already proven to equal the canonical shape by the anchored regex) means
  // there is no chance of a rebuild introducing a difference viem would hash
  // differently.
  let valid = false;
  try {
    valid = await verifyMessage({
      address: claim.player as `0x${string}`,
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
    claim: validation.claim,
    player: validation.claim.player as `0x${string}`,
  };
}
