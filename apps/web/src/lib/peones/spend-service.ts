/**
 * Peones spend — pure service helpers.
 *
 * Sprint 4 commit C of Training Economy Alpha 2026-06-08. Every export
 * here is a pure function with NO Supabase client, NO DB call, NO
 * endpoint glue, NO UI dependency, NO localStorage. The spend
 * endpoint (`/api/peones/spend`) wires these helpers inside the HTTP
 * handler — the helpers themselves know nothing about the transport.
 *
 * Three contracts anchored here:
 *   1. The spend allow-list (`coach | hint | shield`). Labyrinth key is
 *      reserved in the ledger taxonomy but never shipped; `retry` and
 *      `save_game` were retired in Economy V1 (see below).
 *   2. The server-trusted per-target cost. Clients send `amount` for
 *      symmetry but the endpoint VALIDATES against this table — a
 *      client passing `amount = 99` for `hint` gets a 400.
 *   3. The metadata whitelist. Anything outside the whitelist is
 *      silently dropped before reaching the ledger.
 */

import type { PeonesLedgerSource } from "./types";

// ─────────────────────────────────────────────────────────────────
// Spend targets + costs
// ─────────────────────────────────────────────────────────────────

/** Economy V1 allow-list (2026-07-21). `retry` and `save_game` are
 *  RETIRED: both actions are free in the product today, so leaving them
 *  spendable meant the public endpoint could burn a balance for
 *  something the user never bought. `labyrinth_key` never shipped.
 *  Historical rows keep their source — only the endpoint narrowed.
 *  Keep in lockstep with `SPEND_COST_BY_TARGET` and
 *  `SPEND_IDEMPOTENCY_PREFIX_BY_TARGET` below. */
export const PEONES_SPEND_TARGETS = ["coach", "hint", "shield"] as const;

export type PeonesSpendTarget = Extract<
  PeonesLedgerSource,
  (typeof PEONES_SPEND_TARGETS)[number]
>;

/** Economy V1 canonical prices (2026-07-21, docs/economy/peones-v1-
 *  policy.md). Server is the SOLE source of truth; clients echo
 *  `amount` for symmetry but the endpoint validates against this table,
 *  and every surface that DISPLAYS a price reads it from here so the
 *  shown number can never drift from the charged one.
 *
 *  Reference value: 50 Peones = USD 0.50, so 1 Peón ≈ USD 0.01. The
 *  hierarchy hint < shield < coach is deliberate and load-bearing —
 *  a full LLM analysis must never be the cheapest thing in the game,
 *  which is exactly what the previous flat 1/1/2 table made it. */
export const SPEND_COST_BY_TARGET: Readonly<Record<PeonesSpendTarget, number>> = {
  /** Coach analysis — 10 Peones (~USD 0.10). The most expensive sink:
   *  it is the only one backed by real per-call LLM cost. */
  coach: 10,
  /** Hint — 2 Peones. The cheapest sink; taken many times per session. */
  hint: 2,
  /** Shield rescue — 5 Peones. Saves one exercise, not a whole day. */
  shield: 5,
};

/** Returns true for any of the three active spend targets. Used by the
 *  endpoint to reject typos, retired sinks, and future targets that
 *  aren't yet shipped. */
export function isPeonesSpendTarget(value: string): value is PeonesSpendTarget {
  return (PEONES_SPEND_TARGETS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────
// Idempotency-key prefixes
// ─────────────────────────────────────────────────────────────────
//
// Format mirrors calibration §9.1 verbatim. The full key is built by
// the caller (the surface knows its own context — gameId, attemptSeq,
// etc). The endpoint asserts the prefix matches the declared target
// so a misrouted client cannot silently book the wrong target.

export const SPEND_IDEMPOTENCY_PREFIX_BY_TARGET: Readonly<
  Record<PeonesSpendTarget, string>
> = {
  coach: "spend:coach:",
  hint: "spend:hint:",
  shield: "spend:shield:",
};

export function hasSpendIdempotencyPrefix(
  target: PeonesSpendTarget,
  key: string,
): boolean {
  return key.startsWith(SPEND_IDEMPOTENCY_PREFIX_BY_TARGET[target]);
}

// ─────────────────────────────────────────────────────────────────
// Metadata whitelist
// ─────────────────────────────────────────────────────────────────
//
// Server-side sanitiser: any key NOT in the whitelist is silently
// dropped. Sprint 4 ships these six. Adding a new key here is a
// deliberate calibration update — never extend on the fly.

export const SPEND_METADATA_WHITELIST: ReadonlySet<string> = new Set([
  "difficulty",
  "attemptSeq",
  "gameId",
  "piece",
  "exerciseId",
  "surface",
]);

/** Keep only whitelisted keys whose values are primitives (string,
 *  finite number, boolean). Anything else is dropped. Returns `null`
 *  when nothing survives — keeps the SQL row's metadata column as
 *  NULL instead of `{}` so audit queries can distinguish empty from
 *  missing. */
export function sanitizeSpendMetadata(
  input: unknown,
): Record<string, string | number | boolean> | null {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!SPEND_METADATA_WHITELIST.has(k)) continue;
    if (typeof v === "string") {
      if (v.length > 0 && v.length <= 200) out[k] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === "boolean") {
      out[k] = v;
    }
  }
  return Object.keys(out).length === 0 ? null : out;
}
