"use client";

import { useEffect, useState } from "react";

/**
 * Session Combo counter — consecutive successful exercises without
 * a non-shielded failure. This is the value surfaced as "×N COMBO" in
 * the exercise overlay / drawer tray (`exercises.combo` icon).
 *
 * ⚠️ Canonical vocabulary (docs/product/2026-07-23-combo-streak-vocabulary.md):
 * despite the `streak` naming here, this is the SESSION COMBO metric, a
 * distinct counter from the DAILY STREAK (consecutive days, stored under
 * `chesscito:daily-progress` and surfaced as "N-day streak" 🔥). They are
 * independent — do not conflate or reuse one value under both names.
 *
 * Historical note: the identifiers keep the `streak` name (hook, storage
 * key `chesscito:streak`, CSS `--streak`) to avoid a storage/CSS/test
 * migration with no user-facing benefit; the label is already "COMBO".
 *
 * Why it matters: streak is the consumable visible state behind the
 * Shield rescue mechanic. Without streak surfaced, players don't grok
 * what they're protecting when they tap "Use Shield". With it, the
 * mechanic compounds: ganaste +1 → vas N en racha → si fallás, perdés
 * tu racha → uso del shield gana significado emocional.
 *
 * Rules:
 *   - Success on a FRESH exercise (never completed before) → bumpStreak()
 *     — N becomes N+1. Replays of an already-completed exercise do NOT
 *     bump the streak (user feedback 2026-05-31 — counting replays
 *     opened an infinite grind loophole: open the drawer, tap a
 *     completed exercise, finish it, +1 streak, repeat).
 *   - Failure + Use Shield (rescued) → streak preserved
 *   - Failure + Retry anyway / X / backdrop (skipped) → resetStreak()
 *
 * Storage: localStorage chesscito:streak. v1 keeps it client-side so
 * the counter is responsive without network deps. A future server-
 * side tally (for leaderboards / cross-device) can layer on top
 * without changing this surface — same pattern as shield-storage.
 */

const STREAK_KEY = "chesscito:streak";
const EVENT_NAME = "chesscito:streak-changed";

function safeRead(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch {
    return 0;
  }
}

function safeWrite(value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STREAK_KEY, String(Math.max(0, Math.floor(value))));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function readStreak(): number {
  return safeRead();
}

export function bumpStreak(): number {
  const next = safeRead() + 1;
  safeWrite(next);
  return next;
}

export function resetStreak(): void {
  if (safeRead() === 0) return;
  safeWrite(0);
}

/** Subscribe pattern mirror of shield-events: any code that mutates
 *  the streak via the helpers above fires `chesscito:streak-changed`,
 *  and consumers re-read. Same-tab only (window event); cross-tab is
 *  not needed since the counter is per-session in v1. */
export function useStreak(): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    setCount(safeRead());
    const handler = () => setCount(safeRead());
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  return count;
}
