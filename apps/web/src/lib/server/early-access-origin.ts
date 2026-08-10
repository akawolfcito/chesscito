/**
 * Web Early Access — origin policy for POST /api/early-access/request.
 *
 * STRICTER THAN `classifyScoreSaveOrigin`, AND THAT IS THE POINT.
 *
 * The score route has to tolerate a request carrying neither `Origin` nor
 * `Referer`, because MiniPay's WebView omitted both on same-site fetches and
 * tightening it re-broke the March 2026 incident (see `score-save-origin.ts`).
 * That tolerance is safe there only because a mandatory EIP-191 signature does
 * the actual authenticating.
 *
 * Neither condition holds here:
 *
 *   1. MiniPay never reaches this route. The Early Access screen lives inside
 *      `WebAccessGate`, which only exists in the Privy branch — the wallet
 *      branch resolver keeps MiniPay on the `injected` tree
 *      (`lib/wallet/wallet-branch.ts`). There is no WebView to protect.
 *   2. This route is deliberately UNAUTHENTICATED — asking for a key must not
 *      cost a Privy MAU, so there is no signature to fall back on. Origin is
 *      not defence in depth here; it is the only cheap thing standing between
 *      the queue and a scripted caller.
 *
 * Every browser sends `Origin` on a POST (Fetch spec), so refusing a
 * header-less request costs a real player nothing. If this ever misfires, the
 * symptom is a 403 on the request form for a whole class of client and the fix
 * is to widen it deliberately — not to discover years later that the check was
 * decorative.
 *
 * `unconfigured` still passes: with no allow-list env set (local dev) there is
 * nothing to compare against, exactly as the score path behaves.
 */

import { classifyProOriginHost } from "@/lib/pro/pro-origin";

export type EarlyAccessOriginDecision =
  /** Origin/Referer present and on the allow-list. */
  | { verdict: "allowed"; reason: "matched" }
  /** No allow-list configured (local dev). */
  | { verdict: "allowed"; reason: "unconfigured" }
  /** Neither header present — refused here, unlike on the score route. */
  | { verdict: "rejected"; reason: "absent" }
  /** Headers present and pointing somewhere else. */
  | { verdict: "rejected"; reason: "mismatch" };

/** Classify a request's origin. Pure apart from reading the allow-list env. */
export function classifyEarlyAccessOrigin(
  origin: string | null,
  referer: string | null,
): EarlyAccessOriginDecision {
  const source = origin ?? referer;

  if (!source) {
    return { verdict: "rejected", reason: "absent" };
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

  // `mismatch` and `invalid-source` are both "the caller named somewhere that
  // is not us". A source we cannot even parse is not more trustworthy than one
  // that parses to the wrong host.
  return { verdict: "rejected", reason: "mismatch" };
}
