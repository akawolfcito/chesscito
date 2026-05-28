"use client";

import { useTranslations } from "next-intl";
import { BoardThumbnail } from "@/components/board/board-thumbnail";
import { useGameReplay } from "@/lib/game/use-game-replay";

type Props = {
  moves: string[];
  startingFen?: string;
};

export function GameViewer({ moves, startingFen }: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const replay = useGameReplay(moves, startingFen);

  if (replay.totalMoves === 0) {
    return (
      <div className="game-viewer game-viewer--empty">
        <BoardThumbnail fen={replay.currentFen} />
        <p className="game-viewer__empty-message">{t("tooShortToReview")}</p>
      </div>
    );
  }

  return (
    <div className="game-viewer">
      <BoardThumbnail fen={replay.currentFen} />

      {replay.error && (
        <div role="alert" className="game-viewer__error-banner">
          {t("replayStoppedAtMove", {
            n: String(replay.error.atIndex + 1),
            san: replay.error.badSan,
          })}
        </div>
      )}

      <div
        className="game-viewer__controls"
        role="group"
        aria-label={t("controlsAriaLabel")}
      >
        <button
          type="button"
          onClick={replay.goPrev}
          disabled={!replay.canPrev}
          aria-label={t("previousMove")}
          className="game-viewer__nav-btn"
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
          className="game-viewer__slider"
        />
        <button
          type="button"
          onClick={replay.goNext}
          disabled={!replay.canNext}
          aria-label={t("nextMove")}
          className="game-viewer__nav-btn"
        >
          →
        </button>
      </div>

      <ol className="game-viewer__san-list" aria-label={t("sanListAriaLabel")}>
        {moves.slice(0, replay.lastValidIndex).map((san, i) => {
          const moveNum = Math.floor(i / 2) + 1;
          const isWhite = i % 2 === 0;
          return (
            <li
              key={i}
              data-active={i === replay.currentIndex - 1}
              onClick={() => replay.goTo(i + 1)}
              className="game-viewer__san-item"
            >
              <span className="game-viewer__san-num">
                {moveNum}
                {isWhite ? "." : "..."}
              </span>
              <span className="game-viewer__san-text">{san}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
