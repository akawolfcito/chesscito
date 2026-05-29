"use client";

import { useTranslations } from "next-intl";
import { BoardThumbnail } from "@/components/board/board-thumbnail";
import { useGameReplay, type GameReplayState } from "@/lib/game/use-game-replay";

type Props = {
  moves: string[];
  startingFen?: string;
  /** 2026-05-29 (Cluster C, commit 1): when true, GameViewer skips
   *  rendering its internal thumbnail and only emits the replay
   *  controls + SAN list. The host (`coach-game-client`) renders the
   *  hero board above as a sibling so the player sees one large board,
   *  not a thumbnail + hero. Slider/list refactor lands in commit 2. */
  hideBoardThumbnail?: boolean;
  /** 2026-05-29 (Cluster C, commit 1): when provided, GameViewer uses
   *  the host's replay state instead of creating its own. Lets the
   *  hero board (rendered in the host) and the slider/list (rendered
   *  here) stay in lock-step during scrubbing. When omitted, falls
   *  back to internal replay state — preserves back-compat with any
   *  future standalone caller. */
  replay?: GameReplayState;
};

export function GameViewer({ moves, startingFen, hideBoardThumbnail, replay: replayProp }: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const internalReplay = useGameReplay(moves, startingFen);
  const replay = replayProp ?? internalReplay;

  if (replay.totalMoves === 0) {
    return (
      <div className="game-viewer game-viewer--empty">
        {!hideBoardThumbnail && <BoardThumbnail fen={replay.currentFen} />}
        <p className="game-viewer__empty-message">{t("tooShortToReview")}</p>
      </div>
    );
  }

  return (
    <div className="game-viewer">
      {!hideBoardThumbnail && <BoardThumbnail fen={replay.currentFen} />}

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
