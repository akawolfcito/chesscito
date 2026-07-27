-- Migration: focus_day_ledger + focus_ledger_init
-- Created: 2026-07-28
-- Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED 2026-07-27)
-- Purpose: Durable, monotonic challenge progress. "Day N of 21" used to be
--          min(streak, 21), and streak resets to 1 on a missed day, so the
--          number went BACKWARD. Progress now counts distinct UTC dates
--          completed inside a season and never decreases within one.
--
-- Design notes:
--   - wallet always lowercase, same key as lite_season_passes, so progress
--     JOINs the entitlement directly. NOT account_ref: that is telemetry's
--     HMAC, it returns null without TELEMETRY_ACCOUNT_SECRET and rotating
--     that secret orphans rows on purpose. Fine for analytics, unacceptable
--     for progress attached to a purchase.
--   - No identity beyond the wallet. No email, IP, device id or username.
--   - UNIQUE(wallet, season_id, date_utc) IS the idempotency: writes go in
--     with ON CONFLICT DO NOTHING, never a read-then-write check.
--   - date_utc is resolved BY THE SERVER. A client clock never decides which
--     day was earned.
--   - source rows tagged 'backfill_streak' are INFERRED data kept for UX
--     continuity across the ship. They are not verified historical evidence,
--     and any future rewards system must be able to exclude them.
--   - RLS: service role only; anon/authenticated have no access.

CREATE TABLE IF NOT EXISTS focus_day_ledger (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet     text        NOT NULL,
  season_id  text        NOT NULL,
  date_utc   date        NOT NULL,
  source     text        NOT NULL
             CHECK (source IN ('daily', 'daily_retry', 'backfill_streak')),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (wallet, season_id, date_utc)
);

-- The read path the Hub hits on every load for an entitled player.
CREATE INDEX IF NOT EXISTS idx_fdl_wallet_season
  ON focus_day_ledger(wallet, season_id);

-- Backfill latch, deliberately SEPARATE from the ledger: a legitimate seed of
-- zero rows is indistinguishable from "never ran" if the latch is "rows exist".
-- Without this table a player whose localStorage had not hydrated yet would be
-- seeded at zero and latched forever.
--
-- seeded_rows is forensic on purpose: it answers "how much of this ledger is
-- inferred?" when a future rewards campaign asks. Do not drop it as unused.
CREATE TABLE IF NOT EXISTS focus_ledger_init (
  wallet         text        NOT NULL,
  season_id      text        NOT NULL,
  seeded_rows    int         NOT NULL,
  initialized_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (wallet, season_id)
);

-- Row-Level Security: service role writes server-side only.
ALTER TABLE focus_day_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_ledger_init ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_direct_client_access"
  ON focus_day_ledger
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_all_direct_client_access"
  ON focus_ledger_init
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
