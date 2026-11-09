"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { BoardThumbnail } from "@/components/board/board-thumbnail";
import { useGameReplay, type GameReplayState } from "@/lib/game/use-game-replay";

type Props = {
  moves: string[];
  startingFen?: string;
  /** When true, GameViewer skips rendering its internal thumbnail and
   *  only emits the moves panel. The host renders the hero board
   *  above as a sibling. */
  hideBoardThumbnail?: boolean;
  /** When provided, GameViewer uses the host's replay state instead
   *  of creating its own — keeps the hero board and the move list in
   *  lock-step when the slider scrubs in the parent's action deck. */
  replay?: GameReplayState;
  /** Telemetry: move-cell tap. Replay slider events live in the host
   *  now (Sally pass 2 — replay row moved into the action deck). */
  onMoveJump?: (ply: number) => void;
};

/**
 * Moves panel (Sally pass 2). The replay row + arrows used to live
 * here but moved up to the host so they could be wrapped together
 * with the action tiles into one bottom-anchored "Action Deck"
 * panel. GameViewer now owns ONLY the moves list.
 */
export function GameViewer({
  moves,
  startingFen,
  hideBoardThumbnail,
  replay: replayProp,
  onMoveJump,
}: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const internalReplay = useGameReplay(moves, startingFen);
  const replay = replayProp ?? internalReplay;

  // Auto-scroll the active move into view as the player scrubs / taps
  // arrows. `block: "nearest"` keeps the page from jumping; only the
  // bounded `<ol>` scrolls. JSDOM doesn't ship `scrollIntoView` — guard
  // so unit tests don't crash.
  const moveListRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const active = moveListRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (typeof active?.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [replay.currentIndex]);

  if (replay.totalMoves === 0) {
    return (
      <div className="game-viewer game-viewer--empty">
        {!hideBoardThumbnail && <BoardThumbnail fen={replay.currentFen} />}
        <p className="game-viewer__empty-message">{t("tooShortToReview")}</p>
      </div>
    );
  }

  const playedMoves = moves.slice(0, replay.lastValidIndex);

  return (
    <>
      {!hideBoardThumbnail && <BoardThumbnail fen={replay.currentFen} />}

      <div className="coach-viewer__move-list">
        <header className="coach-viewer__move-list-header" aria-hidden="true">
          <span className="coach-viewer__move-list-header-title">
            {t("movesPanelTitle")}
          </span>
        </header>
        <ol
          ref={moveListRef}
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
                  <span className="coach-viewer__move-item-san-cluster">
                    <span className="coach-viewer__move-item-san">{san}</span>
                    {(isMate || isCheck) && (
                      <span className="coach-viewer__move-item-annotation">
                        {isMate ? t("moveAnnotationMate") : t("moveAnnotationCheck")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
