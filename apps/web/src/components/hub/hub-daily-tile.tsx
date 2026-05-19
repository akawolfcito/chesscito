"use client";

import { useEffect, useState } from "react";

import { DailyTacticSheet } from "@/components/daily/daily-tactic-sheet";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";
import {
  getDailyProgress,
  isCompletedToday,
  recordDailyCompletion,
  todayUtc,
  yesterdayUtc,
  type DailyProgress,
} from "@/lib/daily/progress";

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

type SolveStreakType = "first" | "extended" | "reset";

/** Hub right-rail Daily Tactic tile. Same state machine as
 *  `DailyTacticSlot` (localStorage hydration → DailyTacticSheet) but
 *  rendered as a `.reward-tile.is-locked` so the right rail matches
 *  the LEARN rail's tile structure. Suppresses replay when already
 *  completed today, mirrors streak count as the floating badge. */
export function HubDailyTile() {
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
  const shareSolvedUrl =
    progress.streak > 0
      ? `${shareUrl}&solved=true&streak=${progress.streak}`
      : `${shareUrl}&solved=true`;

  if (!hydrated) {
    return (
      <div
        aria-hidden="true"
        className="reward-tile is-locked"
        style={{ visibility: "hidden" }}
      />
    );
  }

  const ariaLabel = completed
    ? `Daily Tactic completed. Fresh in ${Math.floor(hoursUntilNextUtcDay())}h.`
    : `Play today's Daily Tactic. ${puzzleData.name}.`;

  const badge =
    progress.streak > 0 ? (
      <span
        className="reward-tile-notif-streak"
        data-state={completed ? "completed" : "pending"}
        aria-hidden="true"
      >
        {progress.streak}
      </span>
    ) : null;

  return (
    <>
      <HubActionTile
        iconSrc="/art/new-icons-chesscito/ejercicio-diario-chess.png"
        label="Daily"
        ariaLabel={ariaLabel}
        onClick={() => setOpen(true)}
        disabled={completed}
        badge={badge}
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
