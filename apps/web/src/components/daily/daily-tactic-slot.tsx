"use client";

import { useEffect, useState } from "react";
import { DailyTacticCard } from "./daily-tactic-card";
import { DailyTacticSheet } from "./daily-tactic-sheet";
import {
  getDailyProgress,
  isCompletedToday,
  recordDailyCompletion,
  todayUtc,
  type DailyProgress,
} from "@/lib/daily/progress";
import { getDailyPuzzle } from "@/lib/daily/puzzles";

const DEFAULT_PROGRESS: DailyProgress = {
  streak: 0,
  lastCompletedDate: null,
  totalCompleted: 0,
};

function hoursUntilNextUtcDay(now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return Math.max(0, (next.getTime() - now.getTime()) / (1000 * 60 * 60));
}

type DailyTacticSlotProps = {
  /** When true, renders the compact icon-only variant suited for the
   *  action row next to the contextual action pin. */
  compact?: boolean;
};

/**
 * Smart container for the Daily Tactic feature. Hydrates progress from
 * localStorage on mount (so SSR + first render stay default-empty), then
 * wires the Card → Sheet → completion flow.
 *
 * Lives in the Play Hub between the chip row and the board (default)
 * or in the action row when rendered compact.
 */
export function DailyTacticSlot({ compact = false }: DailyTacticSlotProps = {}) {
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState<DailyProgress>(DEFAULT_PROGRESS);
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<string>(() => todayUtc());
  const puzzle = getDailyPuzzle(today);
  const completed = isCompletedToday(today, progress);

  useEffect(() => {
    setHydrated(true);
    setProgress(getDailyProgress());
    setToday(todayUtc());
  }, []);

  function handleSolve() {
    const next = recordDailyCompletion(today);
    setProgress(next);
  }

  if (!hydrated) {
    // Render a layout-stable placeholder so the hub doesn't jump when
    // the card hydrates with the real streak count.
    return (
      <div
        aria-hidden="true"
        className={`daily-tactic-slot-placeholder ${compact ? "h-12 w-12" : "h-[68px]"}`}
      />
    );
  }

  return (
    <>
      <DailyTacticCard
        puzzleName={puzzle.name}
        streak={progress.streak}
        isCompletedToday={completed}
        hoursUntilNext={hoursUntilNextUtcDay()}
        onPlay={() => setOpen(true)}
        compact={compact}
      />
      <DailyTacticSheet
        open={open}
        onOpenChange={setOpen}
        puzzle={puzzle}
        onSolve={handleSolve}
      />
    </>
  );
}
