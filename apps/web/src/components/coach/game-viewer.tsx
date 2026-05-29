"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { BoardThumbnail } from "@/components/board/board-thumbnail";
import { useGameReplay, type GameReplayState } from "@/lib/game/use-game-replay";

type Props = {
  moves: string[];
  startingFen?: string;
  /** When true, GameViewer skips rendering its internal thumbnail and
   *  only emits the replay controls + SAN list. The host renders the
   *  hero board above as a sibling. */
  hideBoardThumbnail?: boolean;
  /** When provided, GameViewer uses the host's replay state instead
   *  of creating its own — keeps the hero board and the slider/list
   *  in lock-step during scrubbing. */
  replay?: GameReplayState;
  /** 2026-05-29 (Cluster C, commit 5): telemetry callbacks. The host
   *  owns event names so the wire format stays consistent with the
   *  other `coach_viewer_*` events fired from coach-game-client. All
   *  optional so non-visor callers (none today, but reserved) don't
   *  need to opt in. `onMoveListToggle` removed in M1 — the move list
   *  is now always visible (no toggle event to emit). */
  onMoveJump?: (ply: number) => void;
  onReplayScrub?: (fromPly: number, toPly: number) => void;
  onReplayErrorShown?: (atIndex: number, badSan: string) => void;
};

export function GameViewer({
  moves,
  startingFen,
  hideBoardThumbnail,
  replay: replayProp,
  onMoveJump,
  onReplayScrub,
  onReplayErrorShown,
}: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const internalReplay = useGameReplay(moves, startingFen);
  const replay = replayProp ?? internalReplay;
  // Capture the slider's position at scrub start so we can report a
  // single from→to event when the user releases — not one event per
  // intermediate value (would flood telemetry).
  const scrubStartRef = useRef<number | null>(null);
  // Fire `coach_viewer_replay_error_shown` once per mount when the
  // error transitions from absent → present. Ref-gated so re-renders
  // don't re-fire.
  const errorReportedRef = useRef(false);
  useEffect(() => {
    if (!replay.error) return;
    if (errorReportedRef.current) return;
    errorReportedRef.current = true;
    onReplayErrorShown?.(replay.error.atIndex, replay.error.badSan);
  }, [replay.error, onReplayErrorShown]);

  if (replay.totalMoves === 0) {
    return (
      <div className="game-viewer game-viewer--empty">
        {!hideBoardThumbnail && <BoardThumbnail fen={replay.currentFen} />}
        <p className="game-viewer__empty-message">{t("tooShortToReview")}</p>
      </div>
    );
  }

  const playedMoves = moves.slice(0, replay.lastValidIndex);
  const totalPlayed = playedMoves.length;

  return (
    <>
      {!hideBoardThumbnail && <BoardThumbnail fen={replay.currentFen} />}

      {replay.error && (
        <div role="alert" className="coach-viewer__replay-error">
          {t("replayStoppedAtMove", {
            n: String(replay.error.atIndex + 1),
            san: replay.error.badSan,
          })}
        </div>
      )}

      <div
        className="coach-viewer__replay"
        role="group"
        aria-label={t("controlsAriaLabel")}
      >
        <button
          type="button"
          onClick={replay.goPrev}
          disabled={!replay.canPrev}
          aria-label={t("previousMove")}
          className="coach-viewer__replay-arrow"
        >
          ←
        </button>
        <input
          type="range"
          min={0}
          max={replay.lastValidIndex}
          step={1}
          value={replay.currentIndex}
          onChange={(e) => replay.goTo(Number(e.target.value))}
          onPointerDown={() => {
            scrubStartRef.current = replay.currentIndex;
          }}
          onPointerUp={() => {
            const from = scrubStartRef.current;
            scrubStartRef.current = null;
            if (from == null) return;
            onReplayScrub?.(from, replay.currentIndex);
          }}
          aria-label={t("sliderAriaLabel")}
          aria-valuetext={t("sliderProgress", {
            current: String(replay.currentIndex),
            total: String(replay.lastValidIndex),
          })}
          className="coach-viewer__replay-slider"
        />
        <button
          type="button"
          onClick={replay.goNext}
          disabled={!replay.canNext}
          aria-label={t("nextMove")}
          className="coach-viewer__replay-arrow"
        >
          →
        </button>
        <span className="coach-viewer__replay-counter" aria-hidden="true">
          {replay.currentIndex} / {replay.lastValidIndex}
        </span>
      </div>

      <div className="coach-viewer__move-list">
        <header
          className="coach-viewer__move-list-header"
          aria-hidden="true"
        >
          <span className="coach-viewer__move-list-header-flourish">⊰</span>
          <span className="coach-viewer__move-list-header-title">
            {t("movesPanelTitle")}
          </span>
          <span className="coach-viewer__move-list-header-flourish">⊱</span>
        </header>
        <ol
          className="coach-viewer__move-list-grid"
          aria-label={t("sanListAriaLabel")}
        >
          {playedMoves.map((san, i) => {
            const moveNum = Math.floor(i / 2) + 1;
            const isWhite = i % 2 === 0;
            const isActive = i === replay.currentIndex - 1;
            const isMate = san.endsWith("#");
            const isCheck = san.endsWith("+");
            return (
              <li
                key={i}
                data-active={isActive}
                className="coach-viewer__move-item"
              >
                <button
                  type="button"
                  className="coach-viewer__move-item-btn"
                  onClick={() => {
                    replay.goTo(i + 1);
                    onMoveJump?.(i + 1);
                  }}
                  aria-pressed={isActive}
                >
                  <span className="coach-viewer__move-item-num">
                    {moveNum}
                    {isWhite ? "." : "..."}
                  </span>
                  <span className="coach-viewer__move-item-san">{san}</span>
                  {(isMate || isCheck) && (
                    <span className="coach-viewer__move-item-annotation">
                      {isMate ? t("moveAnnotationMate") : t("moveAnnotationCheck")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
