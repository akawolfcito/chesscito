"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslations } from "next-intl";
import { DailyTacticSheet } from "@/components/daily/daily-tactic-sheet";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { HubTileStatusChip } from "@/components/hub/hub-tile-status-chip";
import {
  cooldownLabel,
  dailyAvailability,
} from "@/lib/hub/tile-availability";
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
  emitPassportSlotsUpdated,
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
import { useAccount } from "wagmi";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { useWelcomePackage } from "@/lib/welcome-package/use-welcome-package";
import { useLiteWelcomeGiftClaim } from "@/lib/welcome-package/use-lite-welcome-gift-claim";
import { WelcomePackageModal } from "@/components/welcome-package/welcome-package-modal";
import { FirstFocusDayOverlay } from "@/components/welcome-package/first-focus-day-overlay";

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
  const { isConnected, address } = useAccount();
  const welcomePackage = useWelcomePackage();
  const [showAchievement, setShowAchievement] = useState(false);
  const [showWelcomePackage, setShowWelcomePackage] = useState(false);
  const { claimPhase, handleClaim, handleRetry, handleSuccess } = useLiteWelcomeGiftClaim();
  // Set when handleSolve detects this is the first Focus Day (prev.totalCompleted === 0)
  const firstFocusDayJustEarned = useRef(false);
  /** Sprint 2 commit D — guards `daily_tactic_started` against duplicate
   *  emission on re-render. Set when `open` flips true; cleared when
   *  it flips false. Re-renders with open already true do not re-emit. */
  const startedFiredRef = useRef(false);
  /** Sprint 3 commit E — guards the /api/peones/earn POST against
   *  double-fire if handleSolve is somehow re-entered. Cleared
   *  when the sheet closes so the next open can submit again
   *  (the server-side idempotency_key still collapses replays). */
  const earnFiredRef = useRef(false);
  /** Sprint 3 commit H — dedup key for `peones_cap_reached` per
   *  (wallet, day_utc, source). Re-renders or sheet reopens within
   *  the same component instance NEVER re-emit; a process restart
   *  or new wallet does. Daily-only — Training never caps. */
  const capReachedFiredKeyRef = useRef<string | null>(null);
  const [reward, setReward] = useState<DailyTacticRewardState | null>(null);

  const puzzleData = getDailyTactic(today);
  const completed = isCompletedToday(today, progress);

  useEffect(() => {
    setHydrated(true);
    setProgress(getDailyProgress());
    setToday(todayUtc());
  }, []);

  // Re-show Welcome Package on Hub mount if user dismissed it in a previous session
  // (firstFocusDayJustEarned is false here — that case is handled by onOpenChange)
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    if (welcomePackage.shouldAutoShow && !firstFocusDayJustEarned.current) {
      welcomePackage.markShown();
      setShowWelcomePackage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        isLite: CHESSCITO_LITE_MODE,
      });
    }
    if (!open) startedFiredRef.current = false;
  }, [open, hydrated, puzzleData, today, progress.streak, isPro]);

  async function handleSolve(movesUsed: number) {
    const prev = progress;
    // Detect first Focus Day before recording completion
    if (CHESSCITO_LITE_MODE && prev.totalCompleted === 0) {
      firstFocusDayJustEarned.current = true;
      welcomePackage.unlock();
    }
    const next = recordDailyCompletion(today);
    setProgress(next);

    const starsEarned = computeStars(movesUsed, puzzleData.exercise.optimalMoves);

    // Streak telemetry fires immediately — local state, no network.
    const streakType = classifyStreakChange(prev, next);
    if (streakType) {
      emitDailyStreakUpdated({ newStreak: next.streak, streakType, isLite: CHESSCITO_LITE_MODE });
      setSolveResult({ streak: next.streak, streakType });
    } else {
      setSolveResult(null);
    }

    // Sprint 3 commit E — earn POST only when connected. Daily
    // completion + streak persist regardless of the earn outcome.
    // Sprint 3 commit H — emit peones_earned / peones_cap_reached
    // from the result. Both events are best-effort; failures inside
    // track() are swallowed by the existing telemetry contract.
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
          const earnedToday =
            result.kind === "cap_exhausted"
              ? result.dailyEarnedCapped
              : result.dailyEarnedCapped;
          const dailyCap =
            result.kind === "cap_exhausted" ? result.dailyCap : result.dailyCap;
          const credited = result.kind === "cap_exhausted" ? 0 : result.credited;
          emitPeonesCapReached({
            source: "daily_tactic",
            sourceId: puzzleData.id,
            requested: 3,
            credited,
            dailyEarnedCapped: earnedToday,
            dailyCap,
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
      rewardPreviewPeones: peonesEarned, // overlap field tracks credited
      peonesEarned,
      isLite: CHESSCITO_LITE_MODE,
    });

    if (CHESSCITO_LITE_MODE) {
      emitPassportSlotsUpdated({
        newStreak: next.streak,
        filledSlots: Math.min(next.streak, 7),
      });
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

  // Availability signal (founder micro-block 2026-06-11): computed
  // once per render from mount-hydrated state — STATIC approximate
  // label, no live countdown, no setInterval. Re-entering /hub
  // remounts and recomputes.
  const availability = dailyAvailability(completed);
  const waitLabel = cooldownLabel(availability);
  const statusChip =
    availability.state === "ready" ? (
      <HubTileStatusChip kind="ready" />
    ) : waitLabel ? (
      <HubTileStatusChip kind="label" text={waitLabel} />
    ) : null;

  return (
    <>
      <HubActionTile
        iconSrc="/art/new-icons-chesscito/daily-icon-v1.png"
        label={t("dailyLabel")}
        ariaLabel={ariaLabel}
        onClick={() => setOpen(true)}
        disabled={completed}
        badge={
          <>
            {badge}
            {statusChip}
          </>
        }
        priority
        iconWidth={228}
        iconHeight={256}
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
          phase={claimPhase}
          onClaim={() => handleClaim(() => { welcomePackage.claim(); })}
          onDismiss={() => {
            if (claimPhase === "signing") return;
            if (claimPhase === "success") {
              handleSuccess();
              setShowWelcomePackage(false);
              return;
            }
            welcomePackage.dismiss();
            handleSuccess();
            setShowWelcomePackage(false);
          }}
          onSuccess={() => {
            handleSuccess();
            setShowWelcomePackage(false);
          }}
          onRetry={handleRetry}
        />,
        document.body
      )}
      <DailyTacticSheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            // After sheet closes: if first Focus Day just earned, show achievement overlay
            // The achievement overlay's "Continue" then shows the Welcome Package
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
        isConnected={isConnected}
        reward={reward ?? undefined}
      />
    </>
  );
}
