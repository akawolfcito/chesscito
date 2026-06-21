"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DailyTacticCard } from "./daily-tactic-card";
import { DailyTacticSheet } from "./daily-tactic-sheet";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { useWelcomePackage } from "@/lib/welcome-package/use-welcome-package";
import { WelcomePackageModal } from "@/components/welcome-package/welcome-package-modal";
import { FirstFocusDayOverlay } from "@/components/welcome-package/first-focus-day-overlay";
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
import {
  submitDailyTacticEarn,
  type DailyTacticRewardState,
} from "@/lib/daily/peones-earn";
import {
  emitPeonesCapReached,
  emitPeonesEarned,
} from "@/lib/peones/telemetry";
import { computeStars } from "@/lib/game/scoring";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { shareUrlForDaily } from "@/lib/og/share-urls";
import { useAccount } from "wagmi";

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
  const { isConnected, address } = useAccount();
  const welcomePackage = useWelcomePackage();
  const [showAchievement, setShowAchievement] = useState(false);
  const [showWelcomePackage, setShowWelcomePackage] = useState(false);
  const [wpClaimConfirm, setWpClaimConfirm] = useState(false);
  const wpClaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFocusDayJustEarned = useRef(false);
  /** Sprint 2 commit D — same dedup pattern as HubDailyTile. */
  const startedFiredRef = useRef(false);
  /** Sprint 3 commit E — earn POST dedup, mirrors HubDailyTile. */
  const earnFiredRef = useRef(false);
  /** Sprint 3 commit H — cap_reached dedup, mirrors HubDailyTile. */
  const capReachedFiredKeyRef = useRef<string | null>(null);
  const [reward, setReward] = useState<DailyTacticRewardState | null>(null);

  const puzzleData = getDailyTactic(today);
  const completed = isCompletedToday(today, progress);

  useEffect(() => {
    setHydrated(true);
    setProgress(getDailyProgress());
    setToday(todayUtc());
  }, []);

  useEffect(() => {
    return () => { if (wpClaimTimerRef.current) clearTimeout(wpClaimTimerRef.current); };
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

  async function handleSolve(movesUsed: number) {
    const prev = progress;
    if (CHESSCITO_LITE_MODE && prev.totalCompleted === 0) {
      firstFocusDayJustEarned.current = true;
      welcomePackage.unlock();
    }
    const next = recordDailyCompletion(today);
    setProgress(next);

    const starsEarned = computeStars(movesUsed, puzzleData.exercise.optimalMoves);

    const streakType = classifyStreakChange(prev, next);
    if (streakType) {
      emitDailyStreakUpdated({ newStreak: next.streak, streakType });
      setSolveResult({ streak: next.streak, streakType });
    } else {
      setSolveResult(null);
    }

    let peonesEarned = 0;
    if (isConnected && address && !earnFiredRef.current) {
      earnFiredRef.current = true;
      setReward({ kind: "pending" });
      const result = await submitDailyTacticEarn({
        wallet: address,
        dayUtc: today,
        puzzle: puzzleData,
      });
      setReward(result);

      if (result.kind === "success") {
        peonesEarned = result.credited;
        if (result.credited > 0) {
          emitPeonesEarned({
            source: "daily_tactic",
            sourceId: puzzleData.id,
            requested: 3,
            credited: result.credited,
            capReached: result.capReached,
            newBalance: result.newBalance,
            dailyEarnedCapped: result.dailyEarnedCapped,
            dailyCap: result.dailyCap,
            attestationHash: result.attestationHash,
            duplicate: result.duplicate,
          });
        }
      }

      const capReached =
        result.kind === "cap_exhausted" ||
        (result.kind === "success" && result.capReached);
      if (capReached) {
        const dedupKey = `${address}|${today}|daily_tactic`;
        if (capReachedFiredKeyRef.current !== dedupKey) {
          capReachedFiredKeyRef.current = dedupKey;
          const credited = result.kind === "cap_exhausted" ? 0 : result.credited;
          emitPeonesCapReached({
            source: "daily_tactic",
            sourceId: puzzleData.id,
            requested: 3,
            credited,
            dailyEarnedCapped: result.dailyEarnedCapped,
            dailyCap: result.dailyCap,
          });
        }
      }
    }

    emitDailyTacticCompleted({
      puzzle: puzzleData,
      puzzleDate: today,
      movesUsed,
      starsEarned,
      newStreak: next.streak,
      isPro,
      rewardPreviewPeones: peonesEarned,
      peonesEarned,
    });
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
      {/* Retire-when-done (Sally pass 2026-06-11): a completed daily is
          dead weight until tomorrow (tap is already suppressed), so the
          card leaves the action row instead of sitting there checked —
          less noise, the row reads "what's alive now". Kept mounted
          while the sheet is open so the solve ceremony finishes before
          the card disappears. */}
      {completed && !open ? null : (
        <DailyTacticCard
          puzzleName={puzzleData.name}
          streak={progress.streak}
          isCompletedToday={completed}
          hoursUntilNext={hoursUntilNextUtcDay()}
          onPlay={() => setOpen(true)}
        />
      )}
      <DailyTacticSheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            if (firstFocusDayJustEarned.current) {
              setShowAchievement(true);
            }
            firstFocusDayJustEarned.current = false;
            setSolveResult(null);
            setReward(null);
            earnFiredRef.current = false;
          }
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
        reward={reward ?? undefined}
      />
      {hydrated && showAchievement && createPortal(
        <FirstFocusDayOverlay
          onContinue={() => {
            setShowAchievement(false);
            if (welcomePackage.shouldAutoShow) {
              welcomePackage.markShown();
              setShowWelcomePackage(true);
            }
          }}
        />,
        document.body
      )}
      {hydrated && showWelcomePackage && createPortal(
        <WelcomePackageModal
          claimed={wpClaimConfirm}
          onClaim={() => {
            welcomePackage.claim();
            setWpClaimConfirm(true);
            wpClaimTimerRef.current = setTimeout(() => {
              setShowWelcomePackage(false);
              setWpClaimConfirm(false);
            }, 1200);
          }}
          onDismiss={() => {
            welcomePackage.dismiss();
            setShowWelcomePackage(false);
          }}
        />,
        document.body
      )}
    </>
  );
}
