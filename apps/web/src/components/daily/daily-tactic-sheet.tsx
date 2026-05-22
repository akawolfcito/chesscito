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
import { ShareModal } from "@/components/share/share-modal";
import {
  hapticImpact,
  hapticReject,
  hapticSuccess,
  hapticTap,
} from "@/lib/haptics";
import { DAILY_SOLVE_COPY, DAILY_SHARE_COPY } from "@/lib/content/editorial";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";
import type { BoardPosition } from "@/lib/game/types";

type Status = "solving" | "solved" | "resetting";

type StreakType = "first" | "extended" | "reset";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puzzleData: DailyTacticData;
  onSolve: () => void;
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

export function DailyTacticSheet({ open, onOpenChange, puzzleData, onSolve, streakAfterSolve, streakType, shareUrl, shareSolvedUrl, shareLinkUrl, shareSolvedLinkUrl }: Props) {
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
    onSolve();
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
          icon="coach"
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
