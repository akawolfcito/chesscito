/**
 * Peones ledger — server-only helpers.
 *
 * Sprint 3 commit J of Training Economy Alpha 2026-06-07. Splits the
 * `node:crypto`-dependent attestation hash out of the shared
 * `ledger-service.ts` so client bundles don't import a Node-only
 * scheme. The earn endpoint (server-only) is the sole consumer.
 *
 * Client-safe helpers (normalizeWallet, computeLedgerBalance,
 * applyDailyCap, isDailyCapSource, idempotency-key builders) stay
 * in `ledger-service.ts` and can be imported from anywhere.
 */

import { createHash } from "node:crypto";

import { normalizeWallet } from "./ledger-service";
import type { PeonesLedgerEventType, PeonesLedgerSource } from "./types";

export type AttestationPayload = {
  wallet: string;
  event_type: PeonesLedgerEventType;
  amount: number;
  source: PeonesLedgerSource;
  source_id: string | null;
  day_utc: string;
  idempotency_key: string;
};

/**
 * Deterministic SHA-256 of the canonical economic payload. Returns
 * `sha256:<hex>` so the audit dashboards can identify the algorithm
 * by inspection (and we can rotate to a longer hash without breaking
 * older rows).
 *
 * NOTE — `created_at` is NOT part of the hash. Including it would
 * make retries with the same `idempotency_key` produce different
 * hashes, defeating the audit story (calibration §10.2).
 *
 * Pipe-delimited canonical string:
 *   wallet | event_type | amount | source | source_id?? '' | day_utc | idempotency_key
 *
 * Wallet is normalised before hashing so two clients writing the same
 * economic event with different casing produce the same attestation.
 */
export function buildAttestationHash(payload: AttestationPayload): string {
  const normalized = normalizeWallet(payload.wallet);
  const canonical = [
    normalized,
    payload.event_type,
    payload.amount.toString(),
    payload.source,
    payload.source_id ?? "",
    payload.day_utc,
    payload.idempotency_key,
  ].join("|");
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `sha256:${digest}`;
}
