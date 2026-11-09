-- Inbox V0 — one message, one recipient, one row.
--
-- ⛔ ONE TABLE, NOT TWO. The usual messages/message_state split exists to let a
-- single broadcast serve N recipients. With 18 active wallets, inserting N rows
-- costs nothing and saves a join on the hot path — the Hub's unread count, which
-- must stay cheap. When real broadcast arrives, a state table can be added
-- without migrating anything written here.
--
-- ⛔ IDENTITY IS `wallet`, NOT `account_ref`. `account_ref` is
-- HMAC-SHA256(wallet, TELEMETRY_ACCOUNT_SECRET), derived SERVER-SIDE in the
-- telemetry route: the browser never holds it and therefore cannot ask for its
-- own messages with it. Every product table already keys on wallet
-- (peones_ledger, focus_day_ledger, lite_season_passes, duels); analytics is the
-- only place account_ref lives, and keeping it there is exactly the separation
-- worth protecting — a product table using account_ref would be what finally
-- joins analytics to identity.
--
-- ⛔ NO REWARD COLUMNS. `reward_type`, `reward_payload` and `claimed_at` were in
-- the draft; the claim feature is explicitly out of this cycle. A column nothing
-- writes and nothing reads is debt that looks like a feature. They come back the
-- day a claim exists.
--
-- Spec: docs/specs/2026-08-25-inbox-v0-review.md (approved 2026-08-25)

CREATE TABLE IF NOT EXISTS inbox_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet     text        NOT NULL,
  type       text        NOT NULL
             CHECK (type IN ('announcement', 'achievement', 'gift', 'milestone')),
  title      text        NOT NULL,
  body       text        NOT NULL,
  cta_label  text,
  cta_href   text,
  -- NULL = unread. A nullable timestamp carries both the flag and the moment,
  -- and cannot drift out of sync the way a separate boolean would.
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- The Hub asks "how many unread for this wallet" on every load. This is that
-- query's index, and the only read path that has to be fast.
CREATE INDEX IF NOT EXISTS idx_inbox_wallet_unread
  ON inbox_messages (wallet, read_at);

-- The list view: newest first, per wallet.
CREATE INDEX IF NOT EXISTS idx_inbox_wallet_created
  ON inbox_messages (wallet, created_at DESC);

-- ⛔ DENY-TOTAL, same as focus_day_ledger. No client reaches this table
-- directly; every read and write goes through an API route holding the service
-- role, which filters by the wallet in the request. RLS is the floor, not the
-- gate: `REVOKE FROM PUBLIC` alone is not enough on Supabase.
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

-- ⛔ DROP-THEN-CREATE, because `CREATE POLICY IF NOT EXISTS` DOES NOT EXIST in
-- Postgres. Every other statement here is guarded, so this one line was the
-- whole difference between a migration that can run twice and one that cannot —
-- and it failed exactly that way (SQLSTATE 42710) against a database where the
-- objects had been created but the migration was never recorded as applied.
--
-- ⚠️ The fix is idempotency, NOT `migration repair`. Marking it applied by hand
-- would leave a file that still explodes on any fresh database — a new
-- developer's local, a restore, a second environment. What is applied gets
-- MEASURED, and a migration has to survive being measured wrong.
--
-- Safe by construction: the policy is deny-all, and the drop and the create are
-- in the same transaction, so no window exists where the table is unprotected.
DROP POLICY IF EXISTS "deny_all_direct_client_access" ON inbox_messages;

CREATE POLICY "deny_all_direct_client_access"
  ON inbox_messages
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
