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
 *   1. The Sprint 4 spend allow-list (`coach | hint | retry |
 *      save_game`). Labyrinth key is reserved in the ledger taxonomy
 *      but ships in Sprint 5.
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

/** Sprint 4 allow-list. Labyrinth key intentionally excluded
 *  (Sprint 5). Keep in lockstep with `SPEND_COST_BY_TARGET` and
 *  `SPEND_IDEMPOTENCY_PREFIX_BY_TARGET` below. */
export const PEONES_SPEND_TARGETS = [
  "coach",
  "hint",
  "retry",
  "save_game",
  "shield",
] as const;

export type PeonesSpendTarget = Extract<
  PeonesLedgerSource,
  (typeof PEONES_SPEND_TARGETS)[number]
>;

/** M1 default costs per calibration §5. Server is the SOLE source of
 *  truth; clients echo `amount` for symmetry but the endpoint
 *  validates against this table.
 *
 *  Economy v2 (2026-06-10): `retry` is DEPRECATED as an active sink. The
 *  paid `PeonesRetryButton` is not mounted anywhere; the live retry path
 *  (`handleRetryApplied` / useRetryGuard) is FREE and never charges. An
 *  automatic/invisible charge is not a real consumable and feels punitive
 *  in a learning product. The cost stays here only to keep the
 *  target/enum/SQL-CHECK lockstep intact; it is NOT charged. Retry may
 *  return later as a manual, visible "Second Chance"-style consumable. */
export const SPEND_COST_BY_TARGET: Readonly<Record<PeonesSpendTarget, number>> = {
  coach: 1,
  hint: 1,
  retry: 2, // DEPRECATED sink — never charged (see note above)
  save_game: 1,
  /** Shield rescue — 2 Peones. PROVISIONAL: carried over from the
   *  2026-06-05 Sprint 4 decision to unblock this cluster; operator
   *  has flagged this needs a real economic-model pass across all
   *  consumables (Coach's 1 Peón for a full LLM analysis is already
   *  suspect next to this). Do not treat as final. */
  shield: 2,
};

/** Returns true for any of the four Sprint 4 targets. Used by the
 *  endpoint to reject typos / future targets that aren't yet shipped. */
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
  retry: "spend:retry:",
  save_game: "spend:save_game:",
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
