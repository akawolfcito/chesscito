/**
 * SaveScore — origin policy for POST /api/scores/save (Slice 0).
 *
 * `enforceOrigin` in `demo-signing.ts` returns EARLY and SILENTLY when a
 * request carries neither `Origin` nor `Referer`. That bypass exists for a
 * real reason (MiniPay's WebView omitted both on same-site fetches; tightening
 * it re-broke the March 2026 incident in 44c6b500) but on this route it was
 * catastrophic, because origin was the ONLY gate: a header-less `curl` was
 * indistinguishable from a player.
 *
 * The fix is not to start rejecting header-less requests — that would break
 * the exact WebView the product ships in, on no evidence. The fix is that
 * origin is no longer load-bearing here: `/api/scores/save` now requires a
 * valid EIP-191 signature from the wallet being written to, so a header-less
 * caller gains nothing by omitting headers. Origin becomes what it should
 * always have been — defence in depth, and a telemetry signal.
 *
 * So this module keeps the two cases DISTINCT instead of collapsing them:
 *   - a MISMATCHED origin is hostile and still a hard reject;
 *   - an ABSENT origin is allowed, but named, counted and never silent.
 *
 * The distinction is the point. `enforceOrigin` returns `void` for both, which
 * is why the bypass was invisible; this returns a value the caller must handle.
 */

import { classifyProOriginHost } from "@/lib/pro/pro-origin";

export type ScoreSaveOriginDecision =
  /** Origin/Referer present and on the allow-list. */
  | { verdict: "allowed"; reason: "matched" }
  /** No allow-list configured (local dev). */
  | { verdict: "allowed"; reason: "unconfigured" }
  /** Neither header present. Permitted ONLY because the signature gate is
   *  mandatory on this route — never treat this as authentication. */
  | { verdict: "allowed"; reason: "absent"; }
  /** Headers present and pointing somewhere else. Hostile. */
  | { verdict: "rejected"; reason: "mismatch"; source: string };

/**
 * Classify a request's origin without deciding what to do about it. Pure —
 * takes the two header values, reads only env for the allow-list.
 */
export function classifyScoreSaveOrigin(
  origin: string | null,
  referer: string | null,
): ScoreSaveOriginDecision {
  const source = origin ?? referer;

  if (!source) {
    return { verdict: "allowed", reason: "absent" };
  }

  const classification = classifyProOriginHost(source, [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_PREVIEW_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]);

  if (classification.status === "unconfigured") {
    return { verdict: "allowed", reason: "unconfigured" };
  }
  if (classification.status === "allowed") {
    return { verdict: "allowed", reason: "matched" };
  }

  return { verdict: "rejected", reason: "mismatch", source };
}
