"use client";

import { useEffect, useState } from "react";
import { DailyTacticCard } from "./daily-tactic-card";
import { DailyTacticSheet } from "./daily-tactic-sheet";
import {
  getDailyProgress,
  isCompletedToday,
  recordDailyCompletion,
  todayUtc,
  yesterdayUtc,
  type DailyProgress,
} from "@/lib/daily/progress";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";

const DEFAULT_PROGRESS: DailyProgress = {
  streak: 0,
  lastCompletedDate: null,
  totalCompleted: 0,
};

function posToAlgebraic(pos: { file: number; rank: number }): string {
  return "abcdefgh"[pos.file] + String(pos.rank + 1);
}

function hoursUntilNextUtcDay(now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return Math.max(0, (next.getTime() - now.getTime()) / (1000 * 60 * 60));
}

/**
 * Smart container for the Daily Tactic feature. Hydrates progress from
 * localStorage on mount (so SSR + first render stay default-empty), then
 * wires the Card → Sheet → completion flow. Renders as the StonePedestal
 * pill in the action row next to the contextual action pin.
 */
type SolveStreakType = "first" | "extended" | "reset";

export function DailyTacticSlot() {
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState<DailyProgress>(DEFAULT_PROGRESS);
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<string>(() => todayUtc());
  const [solveResult, setSolveResult] = useState<{
    streak: number;
    streakType: SolveStreakType;
  } | null>(null);
  const puzzleData = getDailyTactic(today);
  const completed = isCompletedToday(today, progress);

  useEffect(() => {
    setHydrated(true);
    setProgress(getDailyProgress());
    setToday(todayUtc());
  }, []);

  function handleSolve() {
    const prev = progress;
    const next = recordDailyCompletion(today);
    setProgress(next);
    let streakType: SolveStreakType = "extended";
    if (prev.streak === 0 && next.streak === 1) {
      streakType = "first";
    } else if (prev.lastCompletedDate !== yesterdayUtc(today)) {
      streakType = "reset";
    }
    setSolveResult({ streak: next.streak, streakType });
  }

  const shareUrl = `/api/og/exercise?type=daily&piece=${puzzleData.piece}&name=${encodeURIComponent(puzzleData.name)}&start=${posToAlgebraic(puzzleData.exercise.startPos)}&target=${posToAlgebraic(puzzleData.exercise.targetPos)}`;
  const shareSolvedUrl = progress.streak > 0
    ? `${shareUrl}&solved=true&streak=${progress.streak}`
    : `${shareUrl}&solved=true`;

  if (!hydrated) {
    return (
      <div
        aria-hidden="true"
        className="daily-tactic-slot-placeholder h-12 w-12"
      />
    );
  }

  return (
    <>
      <DailyTacticCard
        puzzleName={puzzleData.name}
        streak={progress.streak}
        isCompletedToday={completed}
        hoursUntilNext={hoursUntilNextUtcDay()}
        onPlay={() => setOpen(true)}
      />
      <DailyTacticSheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSolveResult(null);
        }}
        puzzleData={puzzleData}
        onSolve={handleSolve}
        streakAfterSolve={solveResult?.streak}
        streakType={solveResult?.streakType}
        shareUrl={shareUrl}
        shareSolvedUrl={shareSolvedUrl}
      />
    </>
  );
}
