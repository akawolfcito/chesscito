/** Victory-claim telemetry helpers.
 *
 *  `useMintVictory` already emits the raw provider message on a failed claim,
 *  but the Arena page forwarded only `error_kind` — so every real-world
 *  failure landed in `analytics_events` as `error_kind: "unknown"` with no way
 *  to tell which unknown. That blind spot cost a full diagnosis cycle on
 *  2026-07-21 (see
 *  docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md §3).
 */

import { classifyTxErrorKind, type TxErrorKind } from "@/lib/errors";

/** Cap for the forwarded provider message.
 *
 *  `/api/telemetry` drops the ENTIRE props object when the serialized payload
 *  exceeds 4KB (`sanitizeProps` → `MAX_PROPS_BYTES`). A raw viem error carries
 *  request bodies and stack frames and blows past that on its own, so an
 *  untruncated message would take `stage`, `moves` and `error_kind` down with
 *  it — trading one blind spot for a bigger one. 300 chars keeps the provider's
 *  reason (which it puts up front) with room to spare. */
export const CLAIM_ERROR_MAX_LEN = 300;

/** The provider message, clipped to fit the telemetry props budget.
 *  `undefined` when there is nothing to report, so the field is omitted
 *  rather than sent empty. */
export function truncateClaimError(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  if (raw.length <= CLAIM_ERROR_MAX_LEN) return raw;
  return `${raw.slice(0, CLAIM_ERROR_MAX_LEN - 1)}…`;
}

/**
 * The claim-failure classification, decided ONCE and consumed twice.
 *
 * It used to be decided twice, differently, inside the same `catch`: the UI
 * branch knew about the app's own `No token with sufficient balance` guard and
 * mapped it to `insufficientFunds` (rendering the add-funds CTA), while the
 * telemetry branch re-derived the kind from `classifyTxErrorKind`, which does
 * not know that guard, and recorded `unknown`.
 *
 * The player was never misled — only the measurement was. Production on
 * 2026-08-16: `insufficientFunds` showed **7 wallets** while **148** sat in
 * `unknown` carrying exactly that message. A 21× undercount of the single
 * biggest reason the mint fails, which is the product that actually converts.
 * (`docs/audits/2026-08-16-mint-error-corpus-step0.md`)
 *
 * ⛔ So this is not a new classifier and adds no vocabulary. It is one decision
 * with two renderings, which is what makes the two answers unable to drift
 * apart again.
 */
export type ClaimErrorClassification = {
  /** What the UI acts on. `null` for the expired sentinel, which is not a
   *  `TxErrorKind` — consumers must not mirror a sentinel meaning "no kind". */
  kind: TxErrorKind | null;
  /** What telemetry records: the same decision, plus that sentinel. */
  telemetryKind: string;
};

export function classifyClaimError(err: unknown): ClaimErrorClassification {
  const raw = err instanceof Error ? err.message : "Claim failed";
  // `expired` outranks everything, exactly as it did before this was extracted.
  if (/expired/i.test(raw)) return { kind: null, telemetryKind: "expired" };

  // The VictoryNFT-specific guard. It is OUR message, not the provider's, and
  // it means the same thing to the player as a chain-level insufficient-funds:
  // get more stablecoin. Both paths therefore render the AddCashCta deeplink.
  const kind: TxErrorKind = /No token with sufficient balance/i.test(raw)
    ? "insufficientFunds"
    : classifyTxErrorKind(err);

  return { kind, telemetryKind: String(kind) };
}

/** viem's `BaseError` splits what it knows: `shortMessage` is the verdict and
 *  `details` is what the provider actually said. `message` concatenates both
 *  AFTER a dump of the request arguments — chain, from, to, and the full
 *  calldata — so clipping `message` to fit telemetry keeps the filler and
 *  drops the answer. That is exactly what happened to the first captured mint
 *  failure on 2026-07-21: 300 chars of argument dump, zero information. */
type ViemLikeError = { shortMessage?: unknown; details?: unknown };

/** The most informative short description of a claim failure, ready to send. */
export function describeClaimError(err: unknown): string | undefined {
  if (err == null) return undefined;

  const { shortMessage, details } = (err ?? {}) as ViemLikeError;
  const parts = [shortMessage, details].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );

  if (parts.length > 0) return truncateClaimError(parts.join(" · "));
  return truncateClaimError(err instanceof Error ? err.message : String(err));
}
