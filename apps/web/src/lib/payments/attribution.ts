/**
 * Celo ERC-8021 attribution — Chesscito's issued builder tag.
 *
 * WHAT IT IS
 * A short code Celo issued to Chesscito, encoded by `@celo/attribution-tags`
 * into a data suffix appended AFTER a transaction's canonical calldata. The
 * EVM ignores trailing bytes past the decoded arguments, so the suffix changes
 * nothing about what the transaction does — it only lets Celo attribute the
 * transaction to this app.
 *
 * ⛔ THE CODE IS NEVER IN THIS REPO. It lives in
 * `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG`, configured by the founder in `.env.local`
 * and in the deployment environment. `apps/web/.env.template` — this repo's
 * public env reference — declares it EMPTY. Tests inject a clearly fake code,
 * and `attribution.test.ts` scans every tracked file for an issued-shaped code
 * so a paste into source turns the suite red instead of publishing a mapping.
 *
 * ⚠️ `NEXT_PUBLIC_` IS NOT SECRECY, AND THIS IS THE HONEST FRAMING. The value
 * is inlined into the client bundle at build time and ends up in public
 * calldata on every tagged transaction — anyone can read it off-chain or
 * on-chain. What the env var buys is that the code → Chesscito mapping is not
 * published in a public git repository. It is PRIVATE METADATA, not a
 * cryptographic secret: it authorises nothing, signs nothing and grants no
 * account access. Treating it as a secret would be theatre; treating it as
 * public documentation would be needless.
 *
 * ⛔ `codeFromHostname` IS NOT USED. Chesscito has an ISSUED code, and deriving
 * one from `window.location` would (a) produce a different, unassigned code,
 * (b) make the value depend on which host served the page — a tunnel, a preview
 * URL and production would each attribute differently — and (c) break SSR.
 * Nothing here reads a browser global.
 *
 * ⛔ NO PLATFORM CODES. Chesscito appends only its own assigned code. The
 * package supports arrays, and MiniPay has its own attribution; adding someone
 * else's code from here would be attributing their traffic to a decision they
 * did not make.
 */

import { toDataSuffix } from "@celo/attribution-tags";

/** The single place the variable name is written. */
export const CELO_ATTRIBUTION_ENV_VAR = "NEXT_PUBLIC_CELO_ATTRIBUTION_TAG";

/**
 * Memoised across calls: `toDataSuffix` is pure, and a transaction path should
 * not re-encode on every render.
 *
 * `undefined` is a real state (not configured), so the cache holds a sentinel
 * rather than using `undefined` to mean "not computed yet".
 */
let cached: { suffix: `0x${string}` | undefined } | null = null;
let warned = false;

/**
 * ⚠️ Reports ABSENCE, never a value. The message names the VARIABLE so an
 * operator can fix it, and can never leak the code — there is no interpolation
 * of `raw` anywhere in this file.
 *
 * Warns once per process, and only outside development/test, where an
 * unconfigured tag is expected and normal.
 */
function warnMissingOnce(detail: "unset" | "invalid"): void {
  if (warned) return;
  warned = true;
  if (process.env.NODE_ENV !== "production") return;
  console.warn(
    `[attribution] ${CELO_ATTRIBUTION_ENV_VAR} is ${detail}; ` +
      "Celo transactions will ship UNATTRIBUTED.",
  );
}

/**
 * Chesscito's encoded attribution suffix, or `undefined` when unconfigured.
 *
 * ⛔ IT NEVER THROWS. An unset or malformed tag degrades to "no attribution",
 * because the alternative — a transaction path that throws on a config problem
 * — would turn a metadata mistake into a player who cannot pay. Attribution is
 * worth exactly nothing next to that.
 *
 * SSR-safe and deterministic: reads only `process.env`, touches no browser
 * global, no clock, no network.
 */
export function getChesscitoAttributionSuffix(): `0x${string}` | undefined {
  if (cached) return cached.suffix;

  const raw = process.env.NEXT_PUBLIC_CELO_ATTRIBUTION_TAG?.trim();
  if (!raw) {
    warnMissingOnce("unset");
    cached = { suffix: undefined };
    return undefined;
  }

  try {
    const suffix = toDataSuffix(raw) as `0x${string}`;
    cached = { suffix };
    return suffix;
  } catch {
    // A malformed code is a config error, not a payment error. Note the shape
    // of the problem; never the value that caused it.
    warnMissingOnce("invalid");
    cached = { suffix: undefined };
    return undefined;
  }
}

/** Test-only: the memo would otherwise pin the first env value a suite saw. */
export function resetAttributionCacheForTests(): void {
  cached = null;
  warned = false;
}

/**
 * True when a tag is configured and encodes. Used by the config guard and the
 * verification script; never by a transaction path, which must not branch on it.
 */
export function isAttributionConfigured(): boolean {
  return getChesscitoAttributionSuffix() !== undefined;
}

/**
 * THE ONE INTEGRATION POINT. Wrap a wagmi/viem `writeContract` request and it
 * comes back attributed.
 *
 * ⛔ ADDITIVE ONLY. It sets exactly one field — `dataSuffix`, the mechanism
 * viem 2.46 supports natively — and touches nothing else: not `address`, not
 * `abi`, not `functionName`, not `args`, not `value`, not `chainId`, not
 * `account`, not `feeCurrency`. viem appends the suffix after the encoded
 * calldata and recalculates gas itself.
 *
 * ⛔ IT DOES NOT OVERWRITE AN EXPLICIT `dataSuffix`. A caller that already set
 * one meant it.
 *
 * ⚠️ WHY A WRAPPER AND NOT A MANUAL FIELD AT EACH CALL SITE: the writes are
 * spread over seven production files, and three of them retry without
 * `feeCurrency` on failure — so a manual field would have to be remembered
 * TWICE per site. A convention ("remember to add dataSuffix") is a defect
 * waiting for the next path somebody adds. `attribution.test.ts` scans all
 * seven files and fails if one stops routing through this function.
 */
export function withChesscitoAttribution<T extends object>(
  request: T,
): T & { dataSuffix?: `0x${string}` } {
  const suffix = getChesscitoAttributionSuffix();
  if (!suffix) return request;
  if ("dataSuffix" in request && (request as { dataSuffix?: unknown }).dataSuffix) {
    return request as T & { dataSuffix?: `0x${string}` };
  }
  return { ...request, dataSuffix: suffix };
}
