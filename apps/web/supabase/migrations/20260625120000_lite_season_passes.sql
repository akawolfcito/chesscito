-- Migration: lite_season_passes
-- Created: 2026-06-25
-- Purpose: Stores Chesscito Lite Season Pass purchases verified on Celo mainnet.
--
-- Design notes:
--   - wallet always lowercase (normalised server-side before INSERT).
--   - idempotency_key is UNIQUE: prevents double-credit on retry.
--   - UNIQUE(chain_id, tx_hash, log_index): DB-level anti-replay for the
--     on-chain transfer; mirrors the idempotency_key but at the raw-tx level
--     so a tampered idempotency_key cannot bypass it.
--   - expires_at is set by the server to now() + 21 days at INSERT time.
--   - RLS: service role only; anon/authenticated have no access.

CREATE TABLE IF NOT EXISTS lite_season_passes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet           text        NOT NULL,
  season_id        text        NOT NULL,
  sku              text        NOT NULL DEFAULT 'lite_season_pass_21',
  tx_hash          text        NOT NULL,
  log_index        int         NOT NULL,
  chain_id         int         NOT NULL DEFAULT 42220,
  token_address    text        NOT NULL,
  amount_paid      text        NOT NULL,
  idempotency_key  text        NOT NULL UNIQUE,
  shields_credited int         NOT NULL DEFAULT 3,
  supporter_status text,
  metadata         jsonb,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE(chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_lsp_wallet
  ON lite_season_passes(wallet);

CREATE INDEX IF NOT EXISTS idx_lsp_expires_at
  ON lite_season_passes(expires_at);

CREATE INDEX IF NOT EXISTS idx_lsp_wallet_season_active
  ON lite_season_passes(wallet, season_id, expires_at DESC);

-- Row-Level Security: service role writes server-side only.
ALTER TABLE lite_season_passes ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access (anon + authenticated).
CREATE POLICY "deny_all_direct_client_access"
  ON lite_season_passes
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
