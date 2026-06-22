"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Board } from "@/components/board";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { MissionHeaderCandy } from "@/components/exercises/mission-header-candy";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { ShareModal } from "@/components/share/share-modal";
import { hapticImpact, hapticReject, hapticSuccess } from "@/lib/haptics";
import { DAILY_SHARE_COPY } from "@/lib/content/editorial";
import { recordDailyCompletion, getDailyProgress } from "@/lib/daily/progress";
import { dispatchDailyProgressChanged } from "@/lib/daily/events";
import {
  emitChallengeLinkOpened,
  emitChallengeStarted,
  emitChallengeCompleted,
  emitChallengeShared,
  emitChallengeContinueToLite,
} from "@/lib/daily/challenge-telemetry";
import { getShareOrigin } from "@/lib/og/share-urls";
import { posToString } from "@/lib/game/notation";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";
import type { BoardPosition } from "@/lib/game/types";

type Status = "solving" | "solved" | "resetting";

type Props = {
  puzzleData: DailyTacticData;
  today: string; // "YYYY-MM-DD"
};

const RESET_AFTER_MS = 360;

function buildOgCardUrl(
  origin: string,
  puzzleData: DailyTacticData,
  streak?: number,
  solved?: boolean,
): string {
  const params = new URLSearchParams({
    type: "daily",
    piece: puzzleData.piece,
    name: puzzleData.name,
    start: posToString(puzzleData.exercise.startPos),
    target: posToString(puzzleData.exercise.targetPos),
  });
  if (solved) {
    params.set("solved", "true");
    if (streak && streak > 0) params.set("streak", String(streak));
  }
  return `${origin}/api/og/exercise?${params.toString()}`;
}

function buildShareUrl(origin: string, today: string): string {
  return `${origin}/challenge/daily?date=${today}`;
}

export function ChallengeDailyClient({ puzzleData, today }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("solving");
  const [showHint, setShowHint] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [streakAfterSolve, setStreakAfterSolve] = useState<number>(0);
  const hasStartedRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const origin = getShareOrigin();
  const shareUrl = buildShareUrl(origin, today);
  const ogCardUrl = buildOgCardUrl(origin, puzzleData);
  const ogCardSolvedUrl = buildOgCardUrl(origin, puzzleData, streakAfterSolve, true);

  useEffect(() => {
    emitChallengeLinkOpened({
      challengeId: today,
      puzzleId: puzzleData.id,
      puzzlePiece: puzzleData.piece,
    });
  }, [today, puzzleData.id, puzzleData.piece]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const isLabyrinth =
    (puzzleData.exercise.obstacles && puzzleData.exercise.obstacles.length > 0) ||
    (puzzleData.exercise.captureTargets && puzzleData.exercise.captureTargets.length > 0);

  function handleMove(position: BoardPosition, movesCount: number) {
    if (status !== "solving") return;

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      emitChallengeStarted({ challengeId: today, puzzleId: puzzleData.id });
    }

    const reached =
      position.file === puzzleData.exercise.targetPos.file &&
      position.rank === puzzleData.exercise.targetPos.rank;

    if (!reached) {
      if (puzzleData.exercise.optimalMoves === 1) {
        hapticReject();
        setStatus("resetting");
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setBoardKey((k) => k + 1);
          setShowHint(true);
          setStatus("solving");
        }, RESET_AFTER_MS);
      }
      return;
    }

    hapticSuccess();
    hapticImpact();

    const next = recordDailyCompletion(today);
    dispatchDailyProgressChanged();
    setStreakAfterSolve(next.streak);
    setStatus("solved");

    emitChallengeCompleted({
      challengeId: today,
      puzzleId: puzzleData.id,
      movesUsed: movesCount,
    });
  }

  function handleShareOpen() {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    emitChallengeShared({ challengeId: today, puzzleId: puzzleData.id });
    setShareOpen(true);
  }

  function handleContinue() {
    emitChallengeContinueToLite({ challengeId: today });
    router.push("/hub");
  }

  const shareText =
    status === "solved"
      ? DAILY_SHARE_COPY.ctaSolved(streakAfterSolve)
      : DAILY_SHARE_COPY.ctaChallenge;

  const activeCardUrl = status === "solved" ? ogCardSolvedUrl : ogCardUrl;

  return (
    <main
      className="mission-shell sheet-bg-hub flex min-h-[100dvh] flex-col"
      data-testid="challenge-daily-page"
    >
      <MissionHeaderCandy
        title="Daily Challenge"
        subtitle={puzzleData.name}
        iconSlot={
          <TileIconSlot src="/art/new-icons-chesscito/ejercicio-diario-chess" />
        }
        objective={`Move the ${puzzleData.piece} to the target square.`}
        onClose={handleContinue}
      />

      <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
        <div className="w-full max-w-[360px]">
          <Board
            key={boardKey}
            pieceType={puzzleData.piece}
            startPosition={puzzleData.exercise.startPos}
            mode={isLabyrinth ? "labyrinth" : "practice"}
            targetPosition={puzzleData.exercise.targetPos}
            obstacles={puzzleData.exercise.obstacles}
            captureTargets={puzzleData.exercise.captureTargets}
            isCapture={puzzleData.exercise.isCapture ?? false}
            isLocked={status !== "solving"}
            onMove={handleMove}
          />
        </div>
      </div>

      <div
        className="shrink-0 px-5 pb-6 pt-2 text-center"
        style={{ color: "rgba(63, 34, 8, 0.95)" }}
      >
        {status === "solved" ? (
          <div
            className="flex flex-col items-center gap-3 py-1"
            style={{
              animation:
                "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            <div className="flex items-center gap-2">
              <CandyIcon name="star" className="h-5 w-5" />
              <span
                className="text-base font-extrabold uppercase tracking-tight"
                data-testid="challenge-status-solved"
              >
                Solved!
              </span>
            </div>
            {streakAfterSolve > 0 && (
              <span className="text-sm font-extrabold">
                Streak: {streakAfterSolve}
              </span>
            )}
            <button
              type="button"
              onClick={handleContinue}
              data-testid="challenge-continue-cta"
              className="w-full inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-bold"
              style={{
                background: "rgba(245, 158, 11, 0.95)",
                color: "rgba(63, 34, 8, 0.95)",
                boxShadow: "0 4px 12px rgba(120, 65, 5, 0.32)",
              }}
            >
              Continue in Chesscito →
            </button>
            <button
              type="button"
              onClick={handleShareOpen}
              className="w-full inline-flex min-h-[44px] items-center justify-center rounded-full border px-6 text-sm font-bold"
              style={{
                borderColor: "rgba(110, 65, 15, 0.35)",
                color: "rgba(110, 65, 15, 0.85)",
                background: "rgba(110, 65, 15, 0.06)",
              }}
            >
              {DAILY_SHARE_COPY.shareResult}
            </button>
          </div>
        ) : showHint ? (
          <div className="rounded-xl border border-[rgba(110,65,15,0.20)] bg-[rgba(110,65,15,0.05)] p-3 text-xs leading-tight shadow-inner">
            <span className="mb-1 block font-extrabold uppercase opacity-60">
              Hint
            </span>
            {puzzleData.hint}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">
              Find the move
            </p>
            <button
              type="button"
              onClick={handleShareOpen}
              className="inline-flex min-h-[40px] items-center justify-center rounded-full border px-5 text-xs font-bold"
              style={{
                borderColor: "rgba(110, 65, 15, 0.30)",
                color: "rgba(110, 65, 15, 0.75)",
                background: "rgba(110, 65, 15, 0.05)",
              }}
            >
              {DAILY_SHARE_COPY.shareChallenge}
            </button>
          </div>
        )}
      </div>

      {/* WELL DONE overlay — always shown on solve (challenge is Lite-native) */}
      {status === "solved" && (
        <div
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center candy-modal-scrim"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-3 px-4">
            <div className="relative animate-in zoom-in-90 duration-300">
              <picture className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2">
                <source srcSet="/art/welldone-sms.avif" type="image/avif" />
                <source srcSet="/art/welldone-sms.webp" type="image/webp" />
                <img
                  src="/art/welldone-sms.png"
                  alt="WELL DONE"
                  className="h-auto w-[260px] max-w-[78vw] drop-shadow-[0_6px_14px_rgba(120,65,5,0.45)]"
                  style={{
                    animation:
                      "reward-icon-enter 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                  }}
                />
              </picture>
              <div className="relative flex h-80 w-80 items-center justify-center">
                <div
                  className="pointer-events-none absolute h-72 w-72 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(245,158,11,0.32) 0%, rgba(245,158,11,0.10) 55%, transparent 80%)",
                  }}
                />
                <picture className="relative z-10">
                  <source srcSet="/art/avatar-fun.avif" type="image/avif" />
                  <source srcSet="/art/avatar-fun.webp" type="image/webp" />
                  <img
                    src="/art/avatar-fun.png"
                    alt=""
                    aria-hidden="true"
                    className="h-80 w-80 object-contain drop-shadow-[0_6px_22px_rgba(255,245,215,0.95)]"
                    style={{
                      animation:
                        "reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both",
                    }}
                  />
                </picture>
              </div>
            </div>
            <div className="fail-rescue-reward-row">
              {streakAfterSolve >= 1 && (
                <span className="fail-rescue-reward-pill fail-rescue-reward-pill--streak">
                  <span aria-hidden="true">×{streakAfterSolve}</span>
                  <span>STREAK</span>
                </span>
              )}
              <span className="fail-rescue-reward-pill">
                <picture>
                  <source
                    srcSet="/art/redesign/icons/star.avif"
                    type="image/avif"
                  />
                  <source
                    srcSet="/art/redesign/icons/star.webp"
                    type="image/webp"
                  />
                  <img
                    src="/art/redesign/icons/star.png"
                    alt=""
                    aria-hidden="true"
                  />
                </picture>
                <span>FOCUS</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <ShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          cardUrl={activeCardUrl}
          url={shareUrl}
          text={shareText}
          title={DAILY_SHARE_COPY.shareChallenge}
        />
      )}
    </main>
  );
}
