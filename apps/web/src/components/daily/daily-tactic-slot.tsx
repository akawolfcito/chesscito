"use client";

import { useEffect, useRef, useState } from "react";
import { DailyTacticCard } from "./daily-tactic-card";
import { DailyTacticSheet } from "./daily-tactic-sheet";
import {
  getDailyProgress,
  isCompletedToday,
  recordDailyCompletion,
  todayUtc,
  type DailyProgress,
} from "@/lib/daily/progress";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";
import {
  classifyStreakChange,
  emitDailyStreakUpdated,
  emitDailyTacticCompleted,
  emitDailyTacticStarted,
} from "@/lib/daily/telemetry";
import { computeStars } from "@/lib/game/scoring";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { shareUrlForDaily } from "@/lib/og/share-urls";
import { useAccount } from "wagmi";

const SPRINT_2_DAILY_REWARD_PREVIEW = 3;

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
  const isPro = useIsProActive();
  const { isConnected } = useAccount();
  const rewardPreviewPeones = isConnected ? SPRINT_2_DAILY_REWARD_PREVIEW : 0;
  /** Sprint 2 commit D — same dedup pattern as HubDailyTile. */
  const startedFiredRef = useRef(false);

  const puzzleData = getDailyTactic(today);
  const completed = isCompletedToday(today, progress);

  useEffect(() => {
    setHydrated(true);
    setProgress(getDailyProgress());
    setToday(todayUtc());
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (open && !startedFiredRef.current) {
      startedFiredRef.current = true;
      emitDailyTacticStarted({
        puzzle: puzzleData,
        puzzleDate: today,
        currentStreak: progress.streak,
        isPro,
      });
    }
    if (!open) startedFiredRef.current = false;
  }, [open, hydrated, puzzleData, today, progress.streak, isPro]);

  function handleSolve(movesUsed: number) {
    const prev = progress;
    const next = recordDailyCompletion(today);
    setProgress(next);

    const starsEarned = computeStars(movesUsed, puzzleData.exercise.optimalMoves);
    emitDailyTacticCompleted({
      puzzle: puzzleData,
      puzzleDate: today,
      movesUsed,
      starsEarned,
      newStreak: next.streak,
      isPro,
      rewardPreviewPeones,
    });

    const streakType = classifyStreakChange(prev, next);
    if (streakType) {
      emitDailyStreakUpdated({ newStreak: next.streak, streakType });
      setSolveResult({ streak: next.streak, streakType });
    } else {
      setSolveResult(null);
    }
  }

  const startAlg = posToAlgebraic(puzzleData.exercise.startPos);
  const targetAlg = posToAlgebraic(puzzleData.exercise.targetPos);
  const shareUrl = `/api/og/exercise?type=daily&piece=${puzzleData.piece}&name=${encodeURIComponent(puzzleData.name)}&start=${startAlg}&target=${targetAlg}`;
  const shareSolvedUrl = progress.streak > 0
    ? `${shareUrl}&solved=true&streak=${progress.streak}`
    : `${shareUrl}&solved=true`;
  const shareLinkUrl = shareUrlForDaily({
    piece: puzzleData.piece,
    name: puzzleData.name,
    start: startAlg,
    target: targetAlg,
  });
  const shareSolvedLinkUrl = shareUrlForDaily({
    piece: puzzleData.piece,
    name: puzzleData.name,
    start: startAlg,
    target: targetAlg,
    solved: true,
    streak: progress.streak,
  });

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
        shareLinkUrl={shareLinkUrl}
        shareSolvedLinkUrl={shareSolvedLinkUrl}
        isConnected={isConnected}
      />
    </>
  );
}
