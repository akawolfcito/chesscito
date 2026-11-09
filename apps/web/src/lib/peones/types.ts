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
 * The union is the HISTORICAL taxonomy — every literal here has rows
 * (or could have rows) in `peones_ledger` and removing one would need
 * a destructive migration. What a source can do TODAY is decided by
 * the endpoints, not by this list:
 *
 * Economy V1 (2026-07-21, docs/economy/peones-v1-policy.md) — the ONLY
 * sources the public earn API accepts:
 *   daily_tactic         — +1 per UTC day.
 *   exercise_completion   — +1 per milestone of 5 NEW exercises.
 * plus `welcome_pack` (+1 once), written server-side by the balance
 * route, never through the public endpoint.
 *
 * Retired / never publicly earnable (rows stay valid, new ones are
 * rejected with `invalid_source`):
 *   labyrinth_completion — labyrinths award progress, not Peones.
 *   daily_lab            — dormant, no caller ever shipped.
 *   daily_streak_bonus   — dormant, no caller ever shipped.
 *   senda_milestone      — parked 2026-06-07, never activated.
 *   pack_purchase        — credited by the payment verifier, not here.
 *   admin_grant          — removed from the public surface; an ops
 *                          console would write it server-side.
 *
 * Active spend sources: coach, hint, shield.
 * Retired spend sources: retry, save_game (both are FREE actions now),
 * labyrinth_key (never shipped).
 */
export type PeonesLedgerSource =
  // Earn — daily-family (the cap applies)
  | "daily_tactic"
  | "daily_streak_bonus"
  | "daily_lab"
  // Earn — non-daily
  | "exercise_completion"
  // First completion of a training-path labyrinth (Slice 4, 2026-06-11).
  // Daily-capped; lifetime supply bounded by the catalog (18 labs).
  | "labyrinth_completion"
  | "senda_milestone"
  | "pack_purchase"
  | "welcome_pack"
  // Spend
  | "coach"
  | "hint"
  | "retry"
  | "save_game"
  | "labyrinth_key"
  | "shield"
  // Ops
  | "admin_grant";

/** Sources subject to the cap (calibration §8). Other sources earn
 *  without limit. Used by the pure capper in Sprint 3 commit B.
 *  Economy recalibration 2026-06-10: `exercise_completion` joins the cap
 *  so training earn no longer scales uncapped with content. Keep in
 *  lockstep with the SQL helper `peones_balance_with_caps`.
 *
 *  Economy V1 (2026-07-21) keeps the full historical list even though
 *  three of them can no longer be earned: a source that is retired at
 *  the endpoint but still capped here is strictly conservative, and
 *  narrowing the set would silently un-cap any legacy row written the
 *  same UTC day. Only `daily_tactic` and `exercise_completion` produce
 *  new rows. */
export const PEONES_DAILY_CAP_SOURCES: readonly PeonesLedgerSource[] = [
  "daily_tactic",
  "daily_streak_bonus",
  "daily_lab",
  "exercise_completion",
  "labyrinth_completion",
] as const;

/** Daily earn cap — same magic number as the SQL helper
 *  `peones_balance_with_caps`. Co-located here so the TypeScript callers
 *  don't have to roundtrip to the DB just to know the cap.
 *  Economy recalibration 2026-06-10: 10 → 6 (tighter sink pressure).
 *  Economy V1 2026-07-21: 6 → 3. The recurring free sources now total
 *  1/day (Daily Tactic); exercise milestones share the same ceiling,
 *  and labyrinths pay nothing at all. */
export const PEONES_DAILY_CAP = 3;

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
