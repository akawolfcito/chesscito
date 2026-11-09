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

import type { getSupabaseServer } from "@/lib/supabase/server";
import { normalizeWallet } from "./ledger-service";

/** Minimal structural typing for the Supabase client surface this
 *  helper actually uses. Avoids dragging the full `SupabaseClient`
 *  generic ladder (or an `any` cast) into the public signature.
 *  Exported so tests can mock with the same shape and TypeScript
 *  accepts the structural match. */
export type WelcomePackSupabase = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{
      error: { code?: string; message?: string } | null;
    }>;
  };
};

/**
 * Read surface for {@link hasPeonesWelcomePack}.
 *
 * Deliberately NOT a hand-written structural shape like the one above. The
 * real client's `select` is heavily overloaded and generic, and asking
 * TypeScript to match a literal `select → eq → maybeSingle` chain against it
 * exceeds its instantiation depth (TS2589 — observed here, not hypothetical).
 * Deriving the type from `getSupabaseServer` is the convention the rest of the
 * codebase already uses for read helpers (see
 * `season-pass/focus-ledger-init.ts`), and it keeps the call sites cast-free.
 */
export type WelcomePackProbeSupabase = NonNullable<
  ReturnType<typeof getSupabaseServer>
>;

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
 * Has this wallet already been granted its welcome pack?
 *
 * An equality probe on `idempotency_key`, which carries the UNIQUE btree
 * index `peones_ledger_idempotency_uq` — so this is an index probe returning
 * at most one row, and it never writes.
 *
 * Three-valued on purpose. `"unknown"` (the database could not answer) is NOT
 * folded into `false`: treating an outage as "not seeded" would fire an INSERT
 * at a database that is already failing, which is exactly the behaviour D2.1
 * exists to remove. The caller skips the seed and a later successful read
 * picks it up.
 *
 * This is an OPTIMISATION, never the guarantee. The unique index remains the
 * sole thing standing between us and a double grant — see
 * {@link ensurePeonesWelcomePack}.
 */
export async function hasPeonesWelcomePack(
  supabase: WelcomePackProbeSupabase,
  rawWallet: string,
): Promise<boolean | "unknown"> {
  let idempotencyKey: string;
  try {
    idempotencyKey = buildWelcomePackIdempotencyKey(rawWallet);
  } catch {
    // Malformed wallet — the seed would reject it too. Report "seeded" so the
    // caller skips the write entirely.
    return true;
  }

  try {
    const { data, error } = await supabase
      .from("peones_ledger")
      // One column, and the smallest one available: the key we are matching
      // on, so the index alone can answer. Never `select("*")` — this table
      // carries wallets, metadata and attestations that have no business
      // crossing the wire for an existence check.
      .select("idempotency_key")
      .eq("idempotency_key", idempotencyKey)
      // Redundant against the UNIQUE index, and kept anyway: verified in the
      // installed postgrest-js (2.100.1) that `maybeSingle()` adds NO limit to
      // the query — it only post-processes the array client-side. So without
      // this, "at most one row" would rest entirely on the index. With it, the
      // bound holds at the query level too.
      .limit(1)
      .maybeSingle();
    if (error) return "unknown";
    return data != null;
  } catch {
    return "unknown";
  }
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
 *
 * ⚠️ Callers should gate this behind {@link hasPeonesWelcomePack} so a
 * recurring wallet never issues the INSERT at all (D2.1, 2026-08-03). That
 * gate is a performance measure; the 23505 branch below stays because it is
 * the ONLY thing that makes concurrent first-reads safe, and it is what the
 * unique index enforces regardless of what any cache or probe believed.
 */
export async function ensurePeonesWelcomePack(
  supabase: WelcomePackSupabase,
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
