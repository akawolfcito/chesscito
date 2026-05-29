"use client";

import { useState } from "react";
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
};

export function GameViewer({ moves, startingFen, hideBoardThumbnail, replay: replayProp }: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const internalReplay = useGameReplay(moves, startingFen);
  const replay = replayProp ?? internalReplay;
  const [moveListOpen, setMoveListOpen] = useState(false);

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

      <div className="coach-viewer__move-list" data-open={moveListOpen ? "true" : "false"}>
        <button
          type="button"
          className="coach-viewer__move-list-toggle"
          onClick={() => setMoveListOpen((open) => !open)}
          aria-expanded={moveListOpen}
          aria-controls="coach-viewer-move-list-region"
        >
          {moveListOpen
            ? t("moveListToggleOpen")
            : t("moveListToggleClosed", { n: String(totalPlayed) })}
        </button>
        <ol
          id="coach-viewer-move-list-region"
          className="coach-viewer__move-list-grid"
          aria-label={t("sanListAriaLabel")}
          hidden={!moveListOpen}
        >
          {playedMoves.map((san, i) => {
            const moveNum = Math.floor(i / 2) + 1;
            const isWhite = i % 2 === 0;
            const isActive = i === replay.currentIndex - 1;
            return (
              <li
                key={i}
                data-active={isActive}
                className="coach-viewer__move-item"
              >
                <button
                  type="button"
                  className="coach-viewer__move-item-btn"
                  onClick={() => replay.goTo(i + 1)}
                  aria-pressed={isActive}
                >
                  <span className="coach-viewer__move-item-num">
                    {moveNum}
                    {isWhite ? "." : "..."}
                  </span>
                  <span className="coach-viewer__move-item-san">{san}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
