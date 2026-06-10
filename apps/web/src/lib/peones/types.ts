/**
 * Peones ledger — TypeScript-side types mirroring the Supabase
 * schema introduced in Sprint 3 commit A of Training Economy Alpha
 * (migration: 20260607000000_peones_ledger_init.sql).
 *
 * This module is DORMANT on merge — no caller consumes these types
 * yet. Sprint 3 commits B-I wire them into:
 *   B  pure ledger service (computeBalance, applyCap, buildAttestation)
 *   C  GET /api/peones/balance
 *   D  POST /api/peones/earn (idempotency + cap)
 *   E  Daily Tactic earn wireup
 *   F  Training exercise delta earn wireup
 *   G  HUD balance chip
 *   H  peones_earned + peones_cap_reached telemetry live
 *   I  smoke + handoff
 *
 * The enum literals are the single source of truth ON THE TYPESCRIPT
 * SIDE. The SQL CHECK constraints in the migration are the SQL-side
 * source of truth. Sprint 3 commit B will ship a focused test that
 * parses the migration file and asserts the two stay in sync.
 */

/**
 * Append-only event taxonomy. The sign of the balance contribution
 * comes from this field, NOT from the `amount` column (which always
 * stores a positive integer):
 *
 *  - earn       → balance += amount
 *  - spend      → balance -= amount  (Sprint 4 wires the endpoint)
 *  - adjustment → balance += amount  (manual ops correction)
 *  - rollback   → balance -= amount  (reverse a prior row)
 */
export type PeonesLedgerEventType =
  | "earn"
  | "spend"
  | "adjustment"
  | "rollback";

/**
 * Logical source of the ledger entry. Mirrors the SQL CHECK list.
 *
 * Sprint 3 actively writes:
 *   daily_tactic, daily_streak_bonus, exercise_completion
 *
 * Sprint 3 reserves but does NOT write:
 *   daily_lab           — requires Sprint 2.1 visual UI consumer.
 *   senda_milestone     — parked per Wolfcito 2026-06-07; reserved
 *                         to avoid a future schema migration when
 *                         the +5 bonus per piece activates.
 *   pack_purchase       — Shop integration (post-Sprint 4).
 *   admin_grant         — ops console (post-Sprint 4).
 *
 * Spend sources (Sprint 4 implementation; Sprint 3 declares types):
 *   coach, hint, retry, save_game, labyrinth_key
 */
export type PeonesLedgerSource =
  // Earn — daily-family (the cap applies)
  | "daily_tactic"
  | "daily_streak_bonus"
  | "daily_lab"
  // Earn — non-daily
  | "exercise_completion"
  | "senda_milestone"
  | "pack_purchase"
  | "welcome_pack"
  // Spend
  | "coach"
  | "hint"
  | "retry"
  | "save_game"
  | "labyrinth_key"
  // Ops
  | "admin_grant";

/** Sources subject to the cap (calibration §8). Other sources earn
 *  without limit. Used by the pure capper in Sprint 3 commit B.
 *  Economy recalibration 2026-06-10: `exercise_completion` joins the cap
 *  so training earn no longer scales uncapped with content. Keep in
 *  lockstep with the SQL helper `peones_balance_with_caps`. */
export const PEONES_DAILY_CAP_SOURCES: readonly PeonesLedgerSource[] = [
  "daily_tactic",
  "daily_streak_bonus",
  "daily_lab",
  "exercise_completion",
] as const;

/** Daily earn cap — same magic number as the SQL helper
 *  `peones_balance_with_caps`. Co-located here so the TypeScript callers
 *  don't have to roundtrip to the DB just to know the cap.
 *  Economy recalibration 2026-06-10: 10 → 6 (tighter sink pressure). */
export const PEONES_DAILY_CAP = 6;

/**
 * A row in `public.peones_ledger`. `id` is server-assigned; metadata
 * is opaque JSON; created_at is ISO-string on the TS side because we
 * round-trip through the REST surface.
 */
export type PeonesLedgerRow = {
  id: number;
  wallet: string;                  // lowercase, 0x-prefixed, 40 hex
  event_type: PeonesLedgerEventType;
  amount: number;                  // > 0; sign comes from event_type
  source: PeonesLedgerSource;
  source_id: string | null;
  idempotency_key: string;
  attestation_hash: string;
  metadata: Record<string, unknown> | null;
  day_utc: string;                 // "YYYY-MM-DD"
  created_at: string;              // ISO timestamptz
};

/** Shape returned by the `peones_balances` SQL view. The HUD chip
 *  (Sprint 3 commit G) and `GET /api/peones/balance` (commit C)
 *  read this. */
export type PeonesBalance = {
  wallet: string;
  balance: number;
  last_event_at: string | null;
  event_count: number;
};

/** Shape returned by the SQL function `peones_balance_with_caps`.
 *  Used by the earn endpoint (commit D) to decide whether to
 *  truncate or fully credit an incoming earn (calibration §8). */
export type PeonesBalanceWithCaps = {
  balance: number;
  daily_earned_capped: number;
  daily_cap: number;
};
