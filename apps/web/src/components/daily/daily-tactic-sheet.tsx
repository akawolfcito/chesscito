"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Board } from "@/components/board";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { MissionHeaderCandy } from "@/components/exercises/mission-header-candy";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { ShareModal } from "@/components/share/share-modal";
import {
  hapticImpact,
  hapticReject,
  hapticSuccess,
  hapticTap,
} from "@/lib/haptics";
import { DAILY_SOLVE_COPY, DAILY_SHARE_COPY } from "@/lib/content/editorial";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";
import type { BoardPosition } from "@/lib/game/types";

type Status = "solving" | "solved" | "resetting";

type StreakType = "first" | "extended" | "reset";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puzzleData: DailyTacticData;
  /** Fires once when the user reaches targetPos with the move count
   *  used. Sprint 2 commit D (Training Economy Alpha 2026-06-06) —
   *  signature extended from `() => void` so the consumer can attach
   *  it to telemetry without re-deriving the count from board state. */
  onSolve: (movesUsed: number) => void;
  /** Gates the reward block branch (connected vs guest). Sprint 3
   *  commit E — when true, the sheet renders state from `reward`
   *  below; when false, only the guest CTA appears. Default `false`
   *  keeps every legacy consumer on the guest branch. */
  isConnected?: boolean;
  /** Sprint 3 commit E — state of the `/api/peones/earn` POST the
   *  mount component fires after a Daily Tactic solve. Sheet renders
   *  one of FOUR states from this; if undefined the sheet renders
   *  the connected branch as if `pending` (a stale value would be
   *  worse than "saving"). Ignored entirely when isConnected=false. */
  reward?: import("@/lib/daily/peones-earn").DailyTacticRewardState;
  streakAfterSolve?: number;
  streakType?: StreakType;
  shareUrl?: string;
  shareSolvedUrl?: string;
  /**
   * Canonical `/share/daily?...` URL handed to social-platform share
   * intents. The crawler fetches this HTML page and reads its OG meta
   * to render the rich preview. Without it, crawlers fall back to the
   * generic site card.
   */
  shareLinkUrl?: string;
  shareSolvedLinkUrl?: string;
};

const SOLVE_AUTO_CLOSE_MS = 3200;
const RESET_AFTER_MS = 360;

export function DailyTacticSheet({ open, onOpenChange, puzzleData, onSolve, streakAfterSolve, streakType, shareUrl, shareSolvedUrl, shareLinkUrl, shareSolvedLinkUrl, isConnected = false, reward }: Props) {
  const [status, setStatus] = useState<Status>("solving");
  const [showHint, setShowHint] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("solving");
    setShowHint(false);
    setBoardKey((k) => k + 1);
  }, [open, puzzleData.id]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const isLabyrinth =
    (puzzleData.exercise.obstacles && puzzleData.exercise.obstacles.length > 0) ||
    (puzzleData.exercise.captureTargets && puzzleData.exercise.captureTargets.length > 0);

  function handleShareOpen() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShareOpen(true);
  }

  function isShareUrlValid(url: string | undefined): url is string {
    return typeof url === "string" && url.length > 0;
  }

  function handleMove(position: BoardPosition, movesCount: number) {
    if (status !== "solving") return;
    const reached =
      position.file === puzzleData.exercise.targetPos.file &&
      position.rank === puzzleData.exercise.targetPos.rank;
    if (!reached) {
      if (puzzleData.exercise.optimalMoves === 1) {
        hapticReject();
        setStatus("resetting");
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          setBoardKey((k) => k + 1);
          setShowHint(true);
          setStatus("solving");
        }, RESET_AFTER_MS);
      }
      return;
    }
    hapticSuccess();
    hapticImpact();
    setStatus("solved");
    onSolve(movesCount);
    closeTimerRef.current = setTimeout(() => {
      onOpenChange(false);
    }, SOLVE_AUTO_CLOSE_MS);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title="Daily Tactic"
        description={puzzleData.name}
        data-testid="daily-tactic-sheet"
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <MissionHeaderCandy
          title="Daily Tactic"
          subtitle={puzzleData.name}
          iconSlot={<TileIconSlot src="/art/new-icons-chesscito/ejercicio-diario-chess" />}
          objective={`Move the ${puzzleData.piece} to the target square.`}
          onClose={() => onOpenChange(false)}
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
          className="shrink-0 px-5 pb-4 pt-2 text-center"
          style={{ color: "rgba(63, 34, 8, 0.95)" }}
        >
          {status === "solved" ? (
            <div
              className="flex flex-col items-center gap-1.5 py-1"
              style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
            >
              <div className="flex items-center gap-2">
                <CandyIcon name="star" className="h-5 w-5" />
                <span className="text-base font-extrabold uppercase tracking-tight" data-testid="daily-status-solved">
                  {DAILY_SOLVE_COPY.solved}
                </span>
              </div>
              <span className="text-xs font-bold opacity-60">{puzzleData.name}</span>
              {/* Lite: streak/focus info lives in the overlay pills — bottom stays minimal. */}
              {!CHESSCITO_LITE_MODE && (
                <>
                  {streakAfterSolve != null && streakAfterSolve > 0 && (
                    <span className="text-sm font-extrabold">{DAILY_SOLVE_COPY.streakLabel(streakAfterSolve)}</span>
                  )}
                  {streakType === "first" && (
                    <span className="text-xs font-bold opacity-70">{DAILY_SOLVE_COPY.firstStreak}</span>
                  )}
                  {streakType === "extended" && (
                    <span className="text-xs font-bold opacity-70">{DAILY_SOLVE_COPY.extendedStreak}</span>
                  )}
                  {streakType === "reset" && (
                    <span className="text-xs font-bold opacity-70">{DAILY_SOLVE_COPY.newStreak}</span>
                  )}
                </>
              )}
              {/* Lite: no Peones block. Full: connected/guest reward. */}
              {!CHESSCITO_LITE_MODE && (
                <>
                  {/* Sprint 3 commit E — REAL reward block (Full mode only).
                   *  /api/peones/earn passes state via `reward`. Four states:
                   *  pending / success / cap_exhausted / error. */}
                  {isConnected ? (
                    <div
                      className="mt-1 flex flex-col items-center gap-0.5"
                      data-testid="daily-reward-connected"
                      data-state={reward?.kind ?? "pending"}
                    >
                      {(() => {
                        const state = reward ?? { kind: "pending" as const };
                        if (state.kind === "pending") {
                          return (
                            <span className="text-xs font-bold opacity-70">
                              {DAILY_SOLVE_COPY.rewardSaving}
                            </span>
                          );
                        }
                        if (state.kind === "error") {
                          return (
                            <span className="text-xs font-bold opacity-70">
                              {DAILY_SOLVE_COPY.rewardSaveFailed}
                            </span>
                          );
                        }
                        if (state.kind === "cap_exhausted") {
                          return (
                            <span className="text-xs font-bold opacity-70">
                              {DAILY_SOLVE_COPY.rewardCapExhausted}
                            </span>
                          );
                        }
                        return state.capReached ? (
                          <span className="text-sm font-extrabold tabular-nums">
                            {DAILY_SOLVE_COPY.rewardCapPartialFormat(state.credited)}
                          </span>
                        ) : (
                          <span className="text-sm font-extrabold tabular-nums">
                            {DAILY_SOLVE_COPY.rewardEarnedFormat(state.credited)}
                          </span>
                        );
                      })()}
                    </div>
                  ) : (
                    <span
                      className="mt-1 text-xs font-bold opacity-70"
                      data-testid="daily-reward-guest"
                    >
                      {DAILY_SOLVE_COPY.rewardGuestCta}
                    </span>
                  )}
                </>
              )}
              {isShareUrlValid(shareSolvedUrl) && (
                <button
                  type="button"
                  onClick={handleShareOpen}
                  className="mt-1 text-xs font-bold underline underline-offset-2"
                  style={{ color: "rgba(110, 65, 15, 0.70)" }}
                >
                  {DAILY_SHARE_COPY.shareResult}
                </button>
              )}
            </div>
          ) : showHint ? (
            <div className="rounded-xl border border-[rgba(110,65,15,0.20)] bg-[rgba(110,65,15,0.05)] p-3 text-xs leading-tight shadow-inner">
              <span className="font-extrabold uppercase opacity-60 block mb-1">Hint</span>
              {puzzleData.hint}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-bold opacity-60 uppercase tracking-widest">
                Find the move
              </p>
              {isShareUrlValid(shareUrl) && (
                <button
                  type="button"
                  onClick={handleShareOpen}
                  className="text-xs font-semibold underline underline-offset-2"
                  style={{ color: "rgba(110, 65, 15, 0.50)" }}
                >
                  {DAILY_SHARE_COPY.shareChallenge}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lite mode: PhaseFlash-style celebration overlay — reuses
         *  welldone-sms + avatar-fun assets from mission-panel-candy's
         *  PhaseFlash(success). Sheet auto-closes at SOLVE_AUTO_CLOSE_MS
         *  so no separate dismiss timer is needed here. */}
        {CHESSCITO_LITE_MODE && status === "solved" && (
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
                    style={{ animation: "reward-icon-enter 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
                  />
                </picture>
                <div className="relative flex h-80 w-80 items-center justify-center">
                  <div
                    className="pointer-events-none absolute h-72 w-72 rounded-full"
                    style={{ background: "radial-gradient(circle, rgba(245,158,11,0.32) 0%, rgba(245,158,11,0.10) 55%, transparent 80%)" }}
                  />
                  <picture className="relative z-10">
                    <source srcSet="/art/avatar-fun.avif" type="image/avif" />
                    <source srcSet="/art/avatar-fun.webp" type="image/webp" />
                    <img
                      src="/art/avatar-fun.png"
                      alt=""
                      aria-hidden="true"
                      className="h-80 w-80 object-contain drop-shadow-[0_6px_22px_rgba(255,245,215,0.95)]"
                      style={{ animation: "reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both" }}
                    />
                  </picture>
                </div>
              </div>
              {/* Reward pills — same pattern as PhaseFlash(success) */}
              <div className="fail-rescue-reward-row">
                {streakAfterSolve != null && streakAfterSolve >= 1 && (
                  <span className="fail-rescue-reward-pill fail-rescue-reward-pill--streak">
                    <span aria-hidden="true">×{streakAfterSolve}</span>
                    <span>STREAK</span>
                  </span>
                )}
                <span className="fail-rescue-reward-pill">
                  <picture>
                    <source srcSet="/art/redesign/icons/star.avif" type="image/avif" />
                    <source srcSet="/art/redesign/icons/star.webp" type="image/webp" />
                    <img src="/art/redesign/icons/star.png" alt="" aria-hidden="true" />
                  </picture>
                  <span>FOCUS</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>

      {shareOpen && (
        <ShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          cardUrl={status === "solved" && isShareUrlValid(shareSolvedUrl) ? shareSolvedUrl : (shareUrl ?? null)}
          url={
            status === "solved" && isShareUrlValid(shareSolvedLinkUrl)
              ? shareSolvedLinkUrl
              : shareLinkUrl
          }
          text={
            status === "solved"
              ? DAILY_SHARE_COPY.ctaSolved(streakAfterSolve)
              : DAILY_SHARE_COPY.ctaChallenge
          }
          title={DAILY_SHARE_COPY.shareChallenge}
        />
      )}
    </Sheet>
  );
}
