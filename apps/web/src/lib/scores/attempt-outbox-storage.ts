/**
 * Persisted outbox — where an unsent attempt waits out a closed app.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D20).
 *
 * WHY
 * ---
 * The reducer's guarantee is "a completed attempt survives until the SERVER
 * confirms it". In memory that only holds for the life of the page, and on
 * MiniPay the ordinary way to leave is to close the app — this repo already had
 * to persist the score session for exactly that reason (`87e35e35`, verified on
 * device). Worse, the exposure concentrates where it hurts: a snapshot sits in
 * the outbox only while a POST is pending or failing, i.e. when the network is
 * bad, which is when the app gets closed.
 *
 * WHY PER WALLET
 * --------------
 * An attempt is credited to whoever is connected when it drains. A shared queue
 * on a device that switches accounts would file wallet A's play under wallet B
 * — that is score attribution, not a cache. Without a wallet nothing is written
 * at all: the save path requires one, so such an attempt could never be sent
 * and would only consume the cap.
 *
 * WHAT IT IS NOT
 * --------------
 * Not a credential store. It holds what the player already did — ids, a move
 * count, a duration. The session token lives in its own key with its own rules
 * (`session-client.ts`).
 */

import { OUTBOX_MAX, isAttemptIdShape, type AttemptSnapshot } from "./attempt-lifecycle";
import type { AttemptMeasurement } from "./attempt-measurement";

/** Versioned: a shape change changes the key, so old entries are ignored
 *  instead of parsed wrong. Same rule as the score session. */
const STORAGE_PREFIX = "chesscito:attempt-outbox:v1";

export function outboxStorageKey(wallet: string): string {
  return `${STORAGE_PREFIX}:${wallet.toLowerCase()}`;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isMeasurementShape(v: unknown): v is AttemptMeasurement {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  switch (m.kind) {
    case "moves":
      return isFiniteNumber(m.movesUsed);
    case "failures":
      return isFiniteNumber(m.failures);
    case "coverage":
      return isFiniteNumber(m.reached) && isFiniteNumber(m.ceiling);
    default:
      // An unknown kind is not "probably moves". Bounds and grader dispatch are
      // decided server-side from this tag; guessing it here would be the
      // wrong-grader failure the union exists to prevent.
      return false;
  }
}

function isSnapshot(v: unknown): v is AttemptSnapshot {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isAttemptIdShape(s.attemptId) &&
    typeof s.exerciseId === "string" &&
    s.exerciseId.length > 0 &&
    isMeasurementShape(s.measurement) &&
    isFiniteNumber(s.timeMs) &&
    isFiniteNumber(s.levelId) &&
    isFiniteNumber(s.score)
  );
}

/**
 * Reads the queue for one wallet.
 *
 * A rotten ENTRY is dropped and the rest are kept: a queue is not a credential,
 * and delivering three attempts out of four beats delivering none. Anything
 * that is not an array of snapshots at all is discarded and the key deleted —
 * leaving it there would make every subsequent read fail the same way, and it
 * is not something worth interrupting the player about.
 */
export function readPersistedOutbox(wallet: string | null): AttemptSnapshot[] {
  if (!wallet) return [];
  if (typeof window === "undefined") return [];
  const key = outboxStorageKey(wallet);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(key);
      return [];
    }
    const valid = parsed.filter(isSnapshot);
    if (valid.length === 0) {
      window.localStorage.removeItem(key);
      return [];
    }
    return valid.slice(-OUTBOX_MAX);
  } catch {
    // Invalid JSON, blocked storage or private mode.
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to do */
    }
    return [];
  }
}

/**
 * Mirrors the in-memory queue. Called after every change, so an empty queue
 * REMOVES the key rather than leaving `[]` behind — the next open should find
 * nothing, not an empty box to parse.
 */
export function persistOutbox(
  wallet: string | null,
  snapshots: readonly AttemptSnapshot[],
): void {
  if (!wallet) return;
  if (typeof window === "undefined") return;
  const key = outboxStorageKey(wallet);
  try {
    if (snapshots.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    // Same cap and same drop rule as the reducer: on overflow the OLDEST goes.
    window.localStorage.setItem(key, JSON.stringify(snapshots.slice(-OUTBOX_MAX)));
  } catch {
    // Quota or private mode. The queue stays alive in memory for this session;
    // losing persistence degrades comfort, never correctness.
  }
}

export function clearPersistedOutbox(wallet: string | null): void {
  if (!wallet) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(outboxStorageKey(wallet));
  } catch {
    /* nothing to do */
  }
}
