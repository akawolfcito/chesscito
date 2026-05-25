"use client";

import { useMemo } from "react";

import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import { ARENA_PIECE_IMG, fenToPieces, squareToFileRank } from "@/lib/game/arena-utils";
import { THEME_CONFIG } from "@/lib/theme";

type Props = {
  /** Standard FEN string describing the position to render. Anything
   *  invalid falls through to an empty board (no pieces rendered). */
  fen: string;
  /** Pixel size of the thumbnail's outer box. Width === height; the
   *  board image scales to fill. Defaults to 56px (row-thumb size). */
  size?: number;
  /** When `"b"`, the board renders from black's perspective (h-file
   *  left, rank 8 bottom). Matches the `<ArenaBoard>` flipping rule. */
  perspective?: "w" | "b";
  /** Optional class for the outer wrapper — lets callers add their
   *  own card framing without restyling the internals. */
  className?: string;
  /** ARIA description rendered as `alt` on the board image. Keep it
   *  contextual (e.g. "Final position of game from May 24"). */
  ariaLabel?: string;
};

/**
 * Read-only chess board thumbnail. Derived from `<ArenaBoard>` but
 * strips everything interactive — no click handlers, no a-h/1-8
 * coordinate labels, no legal-move dots, no capture animations. The
 * goal is a static "snapshot" tile that fits in lists and hero cards.
 *
 * Used by the Coach JOURNAL (2026-05-24) to show each entry's final
 * position alongside the meta. Reconstructed FENs come from
 * `movesToFen()` — the underlying GameRecord stores moves, not FEN,
 * so the conversion is the caller's responsibility.
 */
export function BoardThumbnail({
  fen,
  size = 56,
  perspective = "w",
  className,
  ariaLabel = "Chess position",
}: Props) {
  const pieces = useMemo(() => fenToPieces(fen), [fen]);
  const flipped = perspective === "b";

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        position: "relative",
        flexShrink: 0,
      }}
      aria-label={ariaLabel}
      role="img"
    >
      <picture
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <source srcSet="/art/redesign/board/board-ch.avif" type="image/avif" />
        <source srcSet="/art/redesign/board/board-ch.webp" type="image/webp" />
        <img
          src="/art/redesign/board/board-ch.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            // `fill` (not `contain`) — matches the ArenaBoard contract.
            // The board image is intentionally distorted into the
            // square canvas; `cellCenter()` percentages are calibrated
            // against the filled box, not the natural aspect ratio.
            objectFit: "fill",
            display: "block",
          }}
        />
      </picture>

      {/* Pieces live INSIDE the playable-area inset, mirroring the
       *  `.playhub-board-hitgrid` shape used by ArenaBoard. Without
       *  this inset the `cellCenter()` percentages resolve against
       *  the full canvas and pieces drift onto the frame/labels.
       *  Source of truth for the inset values: globals.css
       *  `.playhub-board-hitgrid`. */}
      <div
        style={{
          position: "absolute",
          top: "5.25%",
          right: "9.25%",
          bottom: "12.75%",
          left: "10.25%",
          pointerEvents: "none",
        }}
      >
        {pieces.map((p) => {
          const { file, rank } = squareToFileRank(p.square);
          const vf = flipped ? 7 - file : file;
          const vr = flipped ? 7 - rank : rank;
          const center = cellCenter(vf, vr);
          const pw = pieceWidth();
          const src = ARENA_PIECE_IMG[p.color][p.type];
          // The FEN -> RawPiece array has no `id`. `square` is unique
          // per render (no two pieces occupy the same square in a valid
          // position) so it's a stable React key for this read-only thumb.
          return (
            <picture
              key={p.square}
              style={{
                position: "absolute",
                left: `${center.x}%`,
                top: `${center.y}%`,
                width: `${pw}%`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
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
                className={THEME_CONFIG.pieceTintClass[p.color]}
                style={{ width: "100%", display: "block" }}
              />
            </picture>
          );
        })}
      </div>
    </div>
  );
}
