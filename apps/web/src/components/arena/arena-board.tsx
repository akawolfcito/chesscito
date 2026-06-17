"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cellGeometry, cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import { ARENA_PIECE_IMG, squareToFileRank } from "@/lib/game/arena-utils";
import { GameBoard } from "@/lib/game/game-board";
import { THEME_CONFIG } from "@/lib/theme";
import type { ChessBoardPiece } from "@/lib/game/types";
import type { PlayerColor } from "@/lib/game/use-chess-game";

const CAPTURE_FADE_MS = 200;

type ArenaSquareState = {
  file: number;
  rank: number;
  label: string;
  isDark: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  isLastMove: boolean;
  isCheck: boolean;
};

type ArenaBoardProps = {
  pieces: ChessBoardPiece[];
  selectedSquare: string | null;
  legalMoves: string[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  rejectingSquare?: string | null;
  /** Transient capture-flash square set by useChessGame for ~280ms
   *  after a capture (player or AI). The matching cell briefly
   *  pulses amber-red so the take resolves with visible feedback.
   *  Sally audit #5. */
  captureFlashSquare?: string | null;
  isLocked: boolean;
  isThinking?: boolean;
  onSquareClick: (square: string) => void;
  isCheckmatePause?: boolean;
  /** When "b", the board is flipped to render from black's perspective
   *  (h-file on the left, rank 8 at the bottom). Square labels stay
   *  logical — click handlers still receive "a1" for the a1 square. */
  playerColor?: PlayerColor;
  /** Board migration Phase 2 (per-surface, default off). When true, the board
   *  renders on the procedural `<GameBoard>` substrate (tile grid + candy frame,
   *  orientation-aware) instead of the background-image board. Flag stays off
   *  until final art + human sign-off (founder 2026-06-17). */
  proceduralBoard?: boolean;
};

function buildArenaSquares(
  selectedSquare: string | null,
  legalMoves: string[],
  lastMove: { from: string; to: string } | null,
  checkSquare: string | null,
): ArenaSquareState[] {
  const legalSet = new Set(legalMoves);
  const squares: ArenaSquareState[] = [];

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const fileChar = String.fromCharCode(97 + file);
      const label = `${fileChar}${rank + 1}`;
      squares.push({
        file,
        rank,
        label,
        isDark: (file + rank) % 2 === 0,
        isHighlighted: legalSet.has(label),
        isSelected: label === selectedSquare,
        isLastMove: label === lastMove?.from || label === lastMove?.to,
        isCheck: label === checkSquare,
      });
    }
  }

  return squares;
}

export function ArenaBoard({
  pieces,
  selectedSquare,
  legalMoves,
  lastMove,
  checkSquare,
  rejectingSquare = null,
  captureFlashSquare = null,
  isLocked,
  isThinking = false,
  onSquareClick,
  isCheckmatePause = false,
  playerColor = "w",
  proceduralBoard = false,
}: ArenaBoardProps) {
  const t = useTranslations("ARENA_COPY");
  const flipped = playerColor === "b";
  const squares = useMemo(
    () => buildArenaSquares(selectedSquare, legalMoves, lastMove, checkSquare),
    [selectedSquare, legalMoves, lastMove, checkSquare],
  );

  const pieceMap = useMemo(() => {
    const map = new Map<string, ChessBoardPiece>();
    for (const p of pieces) map.set(p.square, p);
    return map;
  }, [pieces]);

  const squareByLabel = useMemo(() => {
    const map = new Map<string, ArenaSquareState>();
    for (const s of squares) map.set(s.label, s);
    return map;
  }, [squares]);

  /** Pieces that were on the board last render but are no longer present —
   *  rendered for CAPTURE_FADE_MS so the player sees the capture instead
   *  of the piece blinking out. Each "ghost" carries its last-known
   *  square so positioning stays correct during the animation. */
  const [dyingPieces, setDyingPieces] = useState<ChessBoardPiece[]>([]);
  const prevPiecesRef = useRef<ChessBoardPiece[]>([]);

  useEffect(() => {
    const prev = prevPiecesRef.current;
    const currentIds = new Set(pieces.map((p) => p.id));
    const captured = prev.filter((p) => !currentIds.has(p.id));
    prevPiecesRef.current = pieces;
    if (captured.length === 0) return;
    setDyingPieces((d) => [...d, ...captured]);
    const timer = setTimeout(() => {
      setDyingPieces((d) =>
        d.filter((p) => !captured.some((c) => c.id === p.id)),
      );
    }, CAPTURE_FADE_MS);
    return () => clearTimeout(timer);
  }, [pieces]);

  if (pieces.length === 0) {
    return (
      <div className="playhub-stage-shell w-full">
        <div className="playhub-game-stage">
          <div className="flex items-center justify-center aspect-square w-full">
            <p className="text-sm text-rose-400">{t("boardError")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Live + dying piece layer. `pos(file, rank)` (rank 0–7) resolves the cell
  // center as % of the parent region — supplied by the image board (manual
  // vf/vr flip, % of the hit-grid) or the procedural board (GameBoard's
  // orientation-aware overlay geometry, % of the frame opening). Shared verbatim
  // so the two substrates can't drift apart.
  const renderPieceLayer = (
    pos: (file: number, rank: number) => { x: number; y: number },
  ) => (
    <>
      {pieces.map((p) => {
        const { file, rank } = squareToFileRank(p.square);
        const center = pos(file, rank);
        const pw = pieceWidth();
        const src = ARENA_PIECE_IMG[p.color][p.type];
        const isPieceSelected = p.square === selectedSquare;
        const isPieceInCheck = p.square === checkSquare;
        const isPieceRejecting = p.square === rejectingSquare;
        return (
          <picture
            key={p.id}
            className={`arena-piece-float${isPieceSelected ? " is-selected" : ""}${isPieceInCheck ? " is-check" : ""}${isPieceRejecting ? " is-rejecting" : ""}`}
            style={{
              left: `${center.x}%`,
              top: `${center.y}%`,
              width: `${pw}%`,
            }}
          >
            {THEME_CONFIG.hasOptimizedFormats && (
              <>
                <source srcSet={src.replace(".png", ".avif")} type="image/avif" />
                <source srcSet={src.replace(".png", ".webp")} type="image/webp" />
              </>
            )}
            <img
              src={src}
              alt={`${p.color === "w" ? "White" : "Black"} ${p.type}`}
              className={`arena-piece-img ${THEME_CONFIG.pieceTintClass[p.color]}`}
              style={{ width: "100%" }}
            />
          </picture>
        );
      })}

      {/* Captured pieces — rendered for CAPTURE_FADE_MS with the
          is-dying animation so the kill registers visually. */}
      {dyingPieces.map((p) => {
        const { file, rank } = squareToFileRank(p.square);
        const center = pos(file, rank);
        const pw = pieceWidth();
        const src = ARENA_PIECE_IMG[p.color][p.type];
        return (
          <picture
            key={`dying-${p.id}`}
            className="arena-piece-float is-dying"
            style={{
              left: `${center.x}%`,
              top: `${center.y}%`,
              width: `${pw}%`,
            }}
          >
            {THEME_CONFIG.hasOptimizedFormats && (
              <>
                <source srcSet={src.replace(".png", ".avif")} type="image/avif" />
                <source srcSet={src.replace(".png", ".webp")} type="image/webp" />
              </>
            )}
            <img
              src={src}
              alt=""
              className={`arena-piece-img ${THEME_CONFIG.pieceTintClass[p.color]}`}
              style={{ width: "100%" }}
            />
          </picture>
        );
      })}
    </>
  );

  // Per-cell substrate overlay for the procedural board: the arena cell's state
  // visuals (highlight / capturable / selected / last-move / check / capture-
  // flash) as a full-cell child reusing `.arena-board-cell` CSS. GameBoard owns
  // the cell <button> (click); this paints the glow + dot inside it.
  const renderArenaCell = (_file: number, _rank: number, sq: string) => {
    const s = squareByLabel.get(sq);
    if (!s) return null;
    const occupied = pieceMap.has(sq);
    return (
      <span
        aria-hidden="true"
        className={[
          "arena-board-cell",
          s.isDark ? "is-dark" : "is-light",
          s.isHighlighted ? "is-highlighted" : "",
          s.isHighlighted && occupied ? "is-capturable" : "",
          s.isSelected ? "is-selected" : "",
          s.isLastMove ? "is-last-move" : "",
          s.isCheck ? "is-check" : "",
          sq === captureFlashSquare ? "is-capture-flash" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ position: "absolute", inset: 0 }}
      >
        {s.isHighlighted && !occupied ? (
          <span className="playhub-board-dot" />
        ) : null}
      </span>
    );
  };

  if (proceduralBoard) {
    return (
      <div className="playhub-stage-shell w-full">
        <div className="playhub-game-stage">
          <div className="playhub-game-grid">
            <div
              className="playhub-board-canvas arena-board-canvas relative"
              data-checkmate={isCheckmatePause ? "true" : undefined}
            >
              {isThinking && (
                <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-2xl ring-2 ring-amber-400/20" />
              )}
              <GameBoard
                orientation={flipped ? "black" : "white"}
                maxWidth="100%"
                onCellClick={(_file, _rank, sq) => {
                  if (!isLocked) onSquareClick(sq);
                }}
                renderCell={renderArenaCell}
                renderOverlay={(geo) =>
                  renderPieceLayer((file, rank) => {
                    const c = geo.center(file, rank + 1);
                    return { x: c.leftPct, y: c.topPct };
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="playhub-stage-shell w-full">
      <div className="playhub-game-stage">
        <div className="playhub-game-grid">
          <div className="playhub-board-canvas arena-board-canvas relative" data-checkmate={isCheckmatePause ? "true" : undefined}>
            {/* Same <picture>/<img> pattern as the exercise board to avoid
                the iOS WebKit rendering bug around CSS ::before + filter
                + negative z-index. */}
            <picture className="playhub-board-img">
              <source srcSet="/art/redesign/board/board-ch.avif" type="image/avif" />
              <source srcSet="/art/redesign/board/board-ch.webp" type="image/webp" />
              <img src="/art/redesign/board/board-ch.png" alt="" />
            </picture>
            {isThinking && (
              <div className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl ring-2 ring-amber-400/20" />
            )}
            <div className="playhub-board-hitgrid" role="grid" aria-label="Chess board">
              {squares.map((sq) => {
                const vf = flipped ? 7 - sq.file : sq.file;
                const vr = flipped ? 7 - sq.rank : sq.rank;
                const geo = cellGeometry(vf, vr);
                return (
                  <button
                    key={sq.label}
                    type="button"
                    role="gridcell"
                    aria-label={`Square ${sq.label}`}
                    disabled={isLocked}
                    onClick={() => onSquareClick(sq.label)}
                    style={{
                      left: `${geo.left}%`,
                      top: `${geo.top}%`,
                      width: `${geo.width}%`,
                      height: `${geo.height}%`,
                    }}
                    className={[
                      "arena-board-cell",
                      sq.isDark ? "is-dark" : "is-light",
                      sq.isHighlighted ? "is-highlighted" : "",
                      sq.isHighlighted && pieceMap.has(sq.label) ? "is-capturable" : "",
                      sq.isSelected ? "is-selected" : "",
                      sq.isLastMove ? "is-last-move" : "",
                      sq.isCheck ? "is-check" : "",
                      sq.label === captureFlashSquare ? "is-capture-flash" : "",
                    ].join(" ")}
                  >
                    <span className="playhub-board-label">{sq.label}</span>
                    {sq.isHighlighted && !pieceMap.has(sq.label) ? (
                      <span className="playhub-board-dot" />
                    ) : null}
                  </button>
                );
              })}

              {renderPieceLayer((file, rank) => {
                const vf = flipped ? 7 - file : file;
                const vr = flipped ? 7 - rank : rank;
                return cellCenter(vf, vr);
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
