"use client";

import { useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";
import { DailyTacticSheet } from "@/components/daily/daily-tactic-sheet";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";
import {
  getDailyProgress,
  isCompletedToday,
  recordDailyCompletion,
  todayUtc,
  type DailyProgress,
} from "@/lib/daily/progress";
import {
  classifyStreakChange,
  emitDailyStreakUpdated,
  emitDailyTacticCompleted,
  emitDailyTacticStarted,
} from "@/lib/daily/telemetry";
import { computeStars } from "@/lib/game/scoring";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { useAccount } from "wagmi";

/** Sprint 2 commit E reward preview value for connected users. Guests
 *  see no number on the completion screen — only a connect CTA. The
 *  ledger lands in Sprint 3; until then this number is purely visual
 *  + telemetry-side, never written to any balance. */
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

type SolveStreakType = "first" | "extended" | "reset";

/** Hub right-rail Daily Tactic tile. Same state machine as
 *  `DailyTacticSlot` (localStorage hydration → DailyTacticSheet) but
 *  rendered as a `.reward-tile.is-locked` so the right rail matches
 *  the LEARN rail's tile structure. Suppresses replay when already
 *  completed today, mirrors streak count as the floating badge. */
export function HubDailyTile() {
  const t = useTranslations("HUB_ACTION_RAIL_COPY");
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
  /** Sprint 2 commit D — guards `daily_tactic_started` against duplicate
   *  emission on re-render. Set when `open` flips true; cleared when
   *  it flips false. Re-renders with open already true do not re-emit. */
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
      // No-op classification (replay of already-completed day) —
      // keep the previous UI badge state untouched.
      setSolveResult(null);
    }
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
    ? t("dailyCompletedAriaFormat", { hours: Math.floor(hoursUntilNextUtcDay()) })
    : t("dailyPlayAriaFormat", { name: puzzleData.name });

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
        label={t("dailyLabel")}
        ariaLabel={ariaLabel}
        onClick={() => setOpen(true)}
        disabled={completed}
        badge={badge}
        priority
        iconWidth={256}
        iconHeight={273}
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
        isConnected={isConnected}
      />
    </>
  );
}
