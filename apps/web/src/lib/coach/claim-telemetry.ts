/** Victory-claim telemetry helpers.
 *
 *  `useMintVictory` already emits the raw provider message on a failed claim,
 *  but the Arena page forwarded only `error_kind` — so every real-world
 *  failure landed in `analytics_events` as `error_kind: "unknown"` with no way
 *  to tell which unknown. That blind spot cost a full diagnosis cycle on
 *  2026-07-21 (see
 *  docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md §3).
 */

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
