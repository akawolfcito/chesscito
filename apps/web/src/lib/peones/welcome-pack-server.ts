/**
 * Peones welcome pack — server-only seed helper.
 *
 * Sprint 4 commit J (2026-06-08). Solves the 0-Peones dead-end:
 * first-time wallets land with an empty balance, see "Hint · 1 Peón"
 * on `/exercises`, tap → get "Not enough Peones" → bounce. The
 * welcome pack seeds 1 free Peón on the first balance read so the
 * user can immediately spend on a hint and learn the economy
 * (pedagogical onboarding — calibration §7 founder note 2026-06-08).
 *
 * Mechanics:
 *   - Triggered server-side from `GET /api/peones/balance` BEFORE
 *     the balance query runs. Client cannot force a re-grant.
 *   - Idempotent forever via the canonical idempotency key
 *     `welcome_pack:{wallet}`. The unique index from Sprint 3
 *     commit A guarantees at-most-one row per wallet.
 *   - `event_type='earn'`, `source='welcome_pack'`, `amount=1`,
 *     `pro_bypass=false` (counts in balance).
 *   - NOT subject to the daily cap (one-shot, not recurring).
 *   - Audit-friendly: row carries `metadata.welcome_pack: true` so
 *     dashboards can pivot on first-touch wallets.
 *
 * Fail-soft: any insert error (network blip, transient Supabase
 * outage) is swallowed and the balance query still runs. A future
 * read will retry the seed naturally. The unique-violation 23505
 * also no-ops because the wallet already has the row.
 */

import { createHash } from "node:crypto";

import { normalizeWallet } from "./ledger-service";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PEONES_WELCOME_PACK_AMOUNT = 1;

export function buildWelcomePackIdempotencyKey(wallet: string): string {
  return `welcome_pack:${normalizeWallet(wallet)}`;
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildAttestation(payload: {
  wallet: string;
  amount: number;
  day_utc: string;
  idempotency_key: string;
}): string {
  const canonical = [
    payload.wallet,
    "earn",
    payload.amount.toString(),
    "welcome_pack",
    "",
    payload.day_utc,
    payload.idempotency_key,
  ].join("|");
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `sha256:${digest}`;
}

/**
 * Inserts the welcome-pack row if the wallet has none yet. Returns
 * `true` when a row was newly inserted, `false` when the wallet was
 * already seeded (idempotent no-op) or when the insert failed
 * soft-ly. Never throws.
 *
 * The "already seeded" check piggybacks on the unique index on
 * `idempotency_key`, so this is one INSERT and (at most) one
 * conflict resolution — no preliminary SELECT round-trip.
 */
export async function ensurePeonesWelcomePack(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  rawWallet: string,
): Promise<boolean> {
  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return false;
  }
  const idempotencyKey = buildWelcomePackIdempotencyKey(wallet);
  const today = todayUtcDate();
  const attestation = buildAttestation({
    wallet,
    amount: PEONES_WELCOME_PACK_AMOUNT,
    day_utc: today,
    idempotency_key: idempotencyKey,
  });

  const { error } = await supabase.from("peones_ledger").insert({
    wallet,
    event_type: "earn",
    amount: PEONES_WELCOME_PACK_AMOUNT,
    source: "welcome_pack",
    source_id: null,
    idempotency_key: idempotencyKey,
    attestation_hash: attestation,
    metadata: { welcome_pack: true },
    day_utc: today,
  });

  if (!error) return true;
  // 23505 unique_violation = wallet already seeded. Silent success.
  if (error.code === "23505") return false;
  // Anything else: fail soft. Balance read still serves the user.
  return false;
}
