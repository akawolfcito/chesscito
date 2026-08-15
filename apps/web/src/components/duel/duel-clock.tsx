"use client";

import { useEffect, useState } from "react";

import { displayedRemainingMs } from "@/lib/duel/arena-state";
import type { DuelColor, DuelPublic } from "@/lib/duel/types";

/**
 * One seat's clock, redrawn locally between polls.
 *
 * ⛔ THIS IS A RENDERING, NOT A RULE. The server charges with its own clock
 * when it applies a move; this only keeps the number moving so the display does
 * not stutter for three seconds at a time. Reaching zero here means "ask the
 * server", never "you lost" — a defeat painted by the client that the server
 * has not confirmed is a number the player cannot reconcile.
 *
 * ⚠️ And it is why the poll does NOT need to be faster. The client knows
 * `lastMoveAt` and whose turn it is, so it draws its own countdown; the network
 * cadence exists only to find out that the rival moved.
 */

type Props = {
  duel: DuelPublic;
  seat: DuelColor;
  label: string;
  /**
   * Hold the number still while a move is in flight.
   *
   * ⚠️ Without this the display keeps counting during the round trip and then
   * JUMPS UP when the answer lands, because the server charged at the instant
   * it processed and the client had already spent that time on screen. The jump
   * is always in the player's favour and the final number is right either way,
   * but a clock that visibly runs backwards reads as broken. Freezing at the
   * tap and adopting the server's value is the same truth without the flinch.
   */
  frozen?: boolean;
  /** Fires once when a running clock first reaches zero, so the Arena can go
   *  ask the server what really happened. */
  onReachedZero?: () => void;
};

const TICK_MS = 250;

export function DuelClock({ duel, seat, label, frozen = false, onReachedZero }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const running = duel.status === "active" && duel.turnOf === seat;

  useEffect(() => {
    if (!running || frozen) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [frozen, running]);

  const remaining = displayedRemainingMs(duel, seat, now);

  // Reported once per arrival at zero, not on every tick after it.
  const [reported, setReported] = useState(false);
  useEffect(() => {
    if (!running || remaining > 0) {
      if (reported) setReported(false);
      return;
    }
    if (reported) return;
    setReported(true);
    onReachedZero?.();
  }, [onReachedZero, remaining, reported, running]);

  return (
    <div
      className={`duel-clock${running ? " is-running" : ""}${
        running && remaining <= 30_000 ? " is-low" : ""
      }`}
    >
      <span className="duel-clock-label">{label}</span>
      <span className="duel-clock-time" aria-live={running ? "off" : undefined}>
        {formatClock(remaining)}
      </span>
    </div>
  );
}

/** `m:ss` above a minute, and `s.d` below ten seconds so the last moments read
 *  as urgent rather than as a stuck `0:07`. */
export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10_000) return (total / 1000).toFixed(1);

  const seconds = Math.floor(total / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
