# Arena — Full Chess vs AI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/arena` route where players compete against Stockfish AI on the Chesscito custom board with selectable difficulty.

**Architecture:** chess.js handles all rules (legal moves, check/mate, special moves). Stockfish WASM (lila-stockfish-web) runs in a Web Worker for AI. A new `ArenaBoard` component renders 32 pieces using the same homographic geometry extracted from the existing `board.tsx`. The existing exercise board is untouched.

**Tech Stack:** Next.js 14 App Router, TypeScript, chess.js, lila-stockfish-web (Stockfish WASM), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-15-arena-full-chess-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/lib/game/types.ts` | Add arena types (ChessPieceId, PieceColor, ChessBoardPiece, ArenaDifficulty, ArenaStatus) |
| `apps/web/src/lib/game/board-geometry.ts` | **New** — extracted pure math from board.tsx (interpolateQuad, corners, lerp, Point) |
| `apps/web/src/lib/game/arena-utils.ts` | **New** — fenToPieces(), squareToFileRank(), ARENA_PIECE_IMG |
| `apps/web/src/lib/game/arena-worker.ts` | **New** — Stockfish Web Worker (UCI protocol, difficulty config) |
| `apps/web/src/lib/game/use-chess-game.ts` | **New** — game state hook (chess.js + worker orchestration) |
| `apps/web/src/components/board.tsx` | Refactor: import geometry from board-geometry.ts (zero behavior change) |
| `apps/web/src/components/arena/arena-board.tsx` | **New** — full chess board with 32 pieces, homographic rendering |
| `apps/web/src/components/arena/promotion-overlay.tsx` | **New** — pawn promotion piece picker (4 buttons) |
| `apps/web/src/components/arena/difficulty-selector.tsx` | **New** — pre-match difficulty selection screen |
| `apps/web/src/components/arena/arena-hud.tsx` | **New** — top bar (difficulty label + AI thinking indicator) |
| `apps/web/src/components/arena/arena-end-state.tsx` | **New** — game over overlay (PhaseFlash pattern) |
| `apps/web/src/app/arena/page.tsx` | **New** — arena route, orchestrates all arena components |
| `apps/web/src/app/globals.css` | Add arena CSS classes (.piece-white, .piece-black, .arena-board-cell states) |
| `apps/web/src/lib/content/editorial.ts` | Add ARENA_COPY constants |
| `apps/web/public/engines/` | **New dir** — Stockfish WASM files copied from lila-stockfish-web |
| `apps/web/next.config.js` | Add headers() for /engines/* MIME type + cache |
| `apps/web/src/components/play-hub/mission-panel.tsx` | Add "Free Play" entry point button |
| `apps/web/scripts/copy-stockfish.sh` | **New** — build script to copy WASM from node_modules to public |

**Intentionally deferred (v1):** Captured pieces display, soft-gating tutorial prompt, move animations for castling/en passant (pieces snap instead of glide for special moves).

---

## Chunk 1: Foundation (Types, Geometry, Utils, Dependencies)

### Task 1: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install chess.js**

```bash
cd apps/web && pnpm add chess.js
```

- [ ] **Step 2: Verify chess.js is importable**

Create a quick sanity check:
```bash
cd apps/web && node -e "const { Chess } = require('chess.js'); const g = new Chess(); console.log(g.fen()); console.log('chess.js OK')"
```

Expected: starting FEN + "chess.js OK"

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(arena): add chess.js dependency"
```

> **Note on lila-stockfish-web:** We defer Stockfish installation to Task 7 (Worker task) because it requires copying WASM files and configuring Next.js. chess.js is sufficient for all game logic tasks.

---

### Task 2: Add arena types

**Files:**
- Modify: `apps/web/src/lib/game/types.ts` (append after line 38)

- [ ] **Step 1: Add arena types to types.ts**

Append after the existing `PieceProgress` type:

```ts
/* ── Arena (full chess) types ── */

export type ChessPieceId = PieceId | "pawn" | "queen" | "king";

export type PieceColor = "w" | "b";

export type ChessBoardPiece = {
  type: ChessPieceId;
  color: PieceColor;
  square: string; // algebraic notation, e.g. "e4"
};

export type ArenaDifficulty = "easy" | "medium" | "hard";

export type ArenaStatus =
  | "loading"
  | "selecting"
  | "playing"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned";
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/game/types.ts
git commit -m "feat(arena): add ChessPieceId, PieceColor, ChessBoardPiece, ArenaDifficulty, ArenaStatus types"
```

---

### Task 3: Extract board geometry

**Files:**
- Create: `apps/web/src/lib/game/board-geometry.ts`
- Modify: `apps/web/src/components/board.tsx` (lines 27-48 → import)

- [ ] **Step 1: Create board-geometry.ts**

Extract from `board.tsx` lines 27-48 (Point, corners, lerp, BOARD_V_GAMMA, interpolateQuad) plus a new `cellGeometry()` helper:

```ts
// apps/web/src/lib/game/board-geometry.ts

export type Point = { x: number; y: number };

// Corners calibrated from bg-with-grid.png pixel analysis (% of 1011×934 canvas)
export const BOARD_TOP_LEFT: Point = { x: 11.6, y: 1.4 };
export const BOARD_TOP_RIGHT: Point = { x: 88.2, y: 1.4 };
export const BOARD_BOTTOM_LEFT: Point = { x: 0.1, y: 98.2 };
export const BOARD_BOTTOM_RIGHT: Point = { x: 99.2, y: 98.2 };

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Gamma > 1 compresses top rows to match board perspective foreshortening
export const BOARD_V_GAMMA = 1.15;

export function interpolateQuad(u: number, v: number): Point {
  const vg = Math.pow(v, BOARD_V_GAMMA);
  return {
    x: lerp(lerp(BOARD_TOP_LEFT.x, BOARD_TOP_RIGHT.x, u), lerp(BOARD_BOTTOM_LEFT.x, BOARD_BOTTOM_RIGHT.x, u), vg),
    y: lerp(lerp(BOARD_TOP_LEFT.y, BOARD_TOP_RIGHT.y, u), lerp(BOARD_BOTTOM_LEFT.y, BOARD_BOTTOM_RIGHT.y, u), vg),
  };
}

/**
 * Compute bounding box + clip-path for a cell at (file, rank).
 * Rank 0 = row 1 (bottom), rank 7 = row 8 (top).
 */
export function cellGeometry(file: number, rank: number) {
  const row = 7 - rank;
  const col = file;
  const u0 = col / 8;
  const u1 = (col + 1) / 8;
  const v0 = row / 8;
  const v1 = (row + 1) / 8;
  const p00 = interpolateQuad(u0, v0);
  const p10 = interpolateQuad(u1, v0);
  const p01 = interpolateQuad(u0, v1);
  const p11 = interpolateQuad(u1, v1);
  const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
  const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
  const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
  const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);
  const cW = maxX - minX || 0.01;
  const cH = maxY - minY || 0.01;

  function relPt(pt: Point) {
    return `${(((pt.x - minX) / cW) * 100).toFixed(1)}% ${(((pt.y - minY) / cH) * 100).toFixed(1)}%`;
  }

  return {
    left: minX,
    top: minY,
    width: cW,
    height: cH,
    clipPath: `polygon(${relPt(p00)}, ${relPt(p10)}, ${relPt(p11)}, ${relPt(p01)})`,
  };
}

/**
 * Get center point for placing a piece at (file, rank).
 */
export function cellCenter(file: number, rank: number): Point {
  const row = 7 - rank;
  const col = file;
  return interpolateQuad((col + 0.5) / 8, (row + 0.5) / 8);
}
```

- [ ] **Step 2: Refactor board.tsx to import from board-geometry.ts**

Replace lines 27-48 in `board.tsx` with imports. The component's inline geometry computation (lines 140-161) stays as-is for now — we extract the math but the component still does its own cell loop. The key change is that `Point`, `interpolateQuad`, and the constants now come from the shared module.

Replace the block from `type Point = { x: number; y: number };` through the closing `}` of `interpolateQuad`:

```ts
import { interpolateQuad, type Point } from "@/lib/game/board-geometry";
```

Remove these lines from board.tsx (they now live in board-geometry.ts):
- `type Point = { x: number; y: number };` (line 27)
- Corner constants (lines 29-33)
- `function lerp(...)` (lines 35-37)
- `const BOARD_V_GAMMA = 1.15;` (line 40)
- `function interpolateQuad(...)` (lines 42-48)

- [ ] **Step 3: Verify exercise board still works**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

Expected: no errors. Then run dev server and manually verify the board renders correctly at `/play-hub`.

```bash
cd apps/web && pnpm dev
```

Open `http://localhost:3000/play-hub` and confirm:
- Board renders with correct perspective
- Piece moves correctly
- Tutorial hints still work

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/game/board-geometry.ts apps/web/src/components/board.tsx
git commit -m "refactor(board): extract geometry math to board-geometry.ts

Shared module for interpolateQuad, cellGeometry, cellCenter.
Existing board.tsx imports from it — zero behavior change."
```

---

### Task 4: Arena utils (FEN conversion)

**Files:**
- Create: `apps/web/src/lib/game/arena-utils.ts`

- [ ] **Step 1: Create arena-utils.ts**

```ts
// apps/web/src/lib/game/arena-utils.ts

import { Chess } from "chess.js";
import type { ChessBoardPiece, ChessPieceId, PieceColor } from "./types";

/** Map chess.js single-char piece types to our ChessPieceId */
const PIECE_MAP: Record<string, ChessPieceId> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

/** All piece image paths keyed by ChessPieceId */
export const ARENA_PIECE_IMG: Record<ChessPieceId, string> = {
  pawn: "/art/piece-pawn.png",
  knight: "/art/piece-knight.png",
  bishop: "/art/piece-bishop.png",
  rook: "/art/piece-rook.png",
  queen: "/art/piece-queen.png",
  king: "/art/piece-king.png",
};

/**
 * Convert a FEN string to an array of ChessBoardPiece.
 * Uses chess.js board() which returns an 8x8 grid.
 */
export function fenToPieces(fen: string): ChessBoardPiece[] {
  const game = new Chess(fen);
  const board = game.board();
  const pieces: ChessBoardPiece[] = [];

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const cell = board[rank][file];
      if (cell) {
        const fileChar = String.fromCharCode(97 + file); // a-h
        const rankNum = 8 - rank; // chess.js board[0] = rank 8
        pieces.push({
          type: PIECE_MAP[cell.type],
          color: cell.color as PieceColor,
          square: `${fileChar}${rankNum}`,
        });
      }
    }
  }

  return pieces;
}

/**
 * Convert algebraic square notation to file/rank indices.
 * "e4" → { file: 4, rank: 3 }
 */
export function squareToFileRank(square: string): { file: number; rank: number } {
  return {
    file: square.charCodeAt(0) - 97,
    rank: Number(square[1]) - 1,
  };
}
```

- [ ] **Step 2: Quick smoke test**

```bash
cd apps/web && node -e "
const { Chess } = require('chess.js');
const g = new Chess();
const board = g.board();
let count = 0;
for (const row of board) for (const cell of row) if (cell) count++;
console.log('Pieces on starting position:', count);
console.assert(count === 32, 'Expected 32 pieces');
console.log('OK');
"
```

Expected: `Pieces on starting position: 32` + `OK`

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/game/arena-utils.ts
git commit -m "feat(arena): add arena-utils with fenToPieces and squareToFileRank"
```

---

### Task 5: Editorial copy for Arena

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`

- [ ] **Step 1: Add ARENA_COPY to editorial.ts**

Append at the end of the file:

```ts
export const ARENA_COPY = {
  title: "Free Play",
  subtitle: "Challenge the AI",
  difficulty: {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  },
  difficultyDesc: {
    easy: "Friendly AI — makes mistakes often",
    medium: "Solid player — a fair challenge",
    hard: "Expert — plays to win",
  },
  startMatch: "Start Match",
  backToHub: "Back to Hub",
  resign: "Resign",
  newGame: "New Game",
  aiThinking: "AI is thinking...",
  preparingAi: "Preparing AI...",
  promotionTitle: "Promote pawn to:",
  endState: {
    checkmate: {
      win: "Checkmate — You Win!",
      lose: "Checkmate — AI Wins",
    },
    stalemate: "Stalemate — Draw",
    draw: "Draw",
    resigned: "You Resigned",
  },
  playAgain: "Play Again",
  softGate: "Try learning a piece first?",
  softGateSkip: "Skip",
  aiError: "AI disconnected",
  aiTimeout: "AI timed out",
  restartMatch: "Restart Match",
  noWasm: "Your browser doesn't support the AI engine",
} as const;
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "feat(arena): add ARENA_COPY editorial constants"
```

---

## Chunk 2: ArenaBoard Component + CSS

### Task 6: Arena CSS classes

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add arena CSS classes**

Add after the existing `.playhub-board-piece-img` block (around line 386) in the `@layer components` section:

```css
  /* ── Arena board (full chess) ── */

  .arena-board-cell {
    position: absolute;
    border: 0;
    background: transparent;
    padding: 0;
    margin: 0;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .arena-board-cell:active {
    transform: scale(0.98);
  }

  .arena-board-cell.is-highlighted {
    background: rgba(251, 191, 36, 0.22);
    box-shadow:
      inset 0 0 0 1.5px rgba(252, 211, 77, 0.6),
      0 0 6px rgba(251, 191, 36, 0.3);
  }

  .arena-board-cell.is-selected {
    background: rgba(252, 211, 77, 0.3);
    box-shadow:
      inset 0 0 0 1.5px rgba(253, 224, 71, 0.85),
      0 0 8px rgba(252, 211, 77, 0.4);
  }

  .arena-board-cell.is-last-move {
    background: rgba(139, 92, 246, 0.15);
    box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.3);
  }

  .arena-board-cell.is-check {
    background: rgba(239, 68, 68, 0.3);
    box-shadow:
      inset 0 0 0 2px rgba(239, 68, 68, 0.6),
      0 0 12px rgba(239, 68, 68, 0.4);
  }

  .arena-board-cell.is-capturable {
    background: rgba(251, 191, 36, 0.15);
  }

  .arena-piece-float {
    position: absolute;
    z-index: 10;
    transform: translate(-50%, -55%);
    pointer-events: none;
    transition: left 320ms ease-in-out, top 320ms ease-in-out, opacity 300ms ease;
  }

  .arena-piece-img {
    height: clamp(44px, 15vw, 64px);
    width: auto;
    object-fit: contain;
  }

  .piece-white {
    filter: sepia(0.3) saturate(1.5) brightness(1.1);
  }

  .piece-black {
    filter: hue-rotate(260deg) saturate(0.8) brightness(0.7);
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style(arena): add arena board CSS — cell states, piece tint, animations"
```

---

### Task 7: ArenaBoard component

**Files:**
- Create: `apps/web/src/components/arena/arena-board.tsx`

- [ ] **Step 1: Create the ArenaBoard component**

```tsx
// apps/web/src/components/arena/arena-board.tsx
"use client";

import { useMemo } from "react";
import { cellGeometry, cellCenter } from "@/lib/game/board-geometry";
import { ARENA_PIECE_IMG, squareToFileRank } from "@/lib/game/arena-utils";
import type { ChessBoardPiece } from "@/lib/game/types";

type ArenaSquareState = {
  file: number;
  rank: number;
  label: string;
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
  checkSquare: string | null; // square where king is in check
  isLocked: boolean;
  onSquareClick: (square: string) => void;
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
  isLocked,
  onSquareClick,
}: ArenaBoardProps) {
  const squares = useMemo(
    () => buildArenaSquares(selectedSquare, legalMoves, lastMove, checkSquare),
    [selectedSquare, legalMoves, lastMove, checkSquare],
  );

  const pieceMap = useMemo(() => {
    const map = new Map<string, ChessBoardPiece>();
    for (const p of pieces) map.set(p.square, p);
    return map;
  }, [pieces]);

  return (
    <div className="playhub-stage-shell w-full">
      <div className="playhub-game-stage">
        <div className="playhub-game-grid">
          <div className="playhub-board-canvas">
            <div className="playhub-board-hitgrid" role="grid" aria-label="Chess board">
              {squares.map((sq) => {
                const geo = cellGeometry(sq.file, sq.rank);
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
                      clipPath: geo.clipPath,
                    }}
                    className={[
                      "arena-board-cell",
                      sq.isHighlighted ? "is-highlighted" : "",
                      sq.isSelected ? "is-selected" : "",
                      sq.isLastMove ? "is-last-move" : "",
                      sq.isCheck ? "is-check" : "",
                    ].join(" ")}
                  >
                    <span className="playhub-board-label">{sq.label}</span>
                    {sq.isHighlighted && !pieceMap.has(sq.label) ? (
                      <span className="playhub-board-dot" />
                    ) : null}
                  </button>
                );
              })}

              {/* Floating piece layer — one element per piece.
                  Key uses color+type+square for now (pieces snap on move).
                  Stable piece identity for smooth CSS transitions is deferred —
                  requires tracking piece IDs across FEN changes. */}
              {pieces.map((p) => {
                const { file, rank } = squareToFileRank(p.square);
                const center = cellCenter(file, rank);
                const tintClass = p.color === "w" ? "piece-white" : "piece-black";
                return (
                  <picture
                    key={`${p.color}-${p.type}-${p.square}`}
                    className="arena-piece-float"
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                    }}
                  >
                    <source
                      srcSet={ARENA_PIECE_IMG[p.type].replace(".png", ".avif")}
                      type="image/avif"
                    />
                    <source
                      srcSet={ARENA_PIECE_IMG[p.type].replace(".png", ".webp")}
                      type="image/webp"
                    />
                    <img
                      src={ARENA_PIECE_IMG[p.type]}
                      alt={`${p.color === "w" ? "White" : "Black"} ${p.type}`}
                      className={`arena-piece-img ${tintClass}`}
                    />
                  </picture>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/arena/arena-board.tsx
git commit -m "feat(arena): add ArenaBoard component with multi-piece homographic rendering"
```

---

### Task 8: Tint spike — verify CSS filters on piece art

**Files:** None (visual verification only)

- [ ] **Step 1: Create a temporary test page**

Create `apps/web/src/app/arena/page.tsx` temporarily to visually test the tint:

```tsx
// apps/web/src/app/arena/page.tsx
"use client";

import { ArenaBoard } from "@/components/arena/arena-board";
import { fenToPieces } from "@/lib/game/arena-utils";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function ArenaPage() {
  const pieces = fenToPieces(START_FEN);
  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-[#0a1628] p-4">
      <h1 className="mb-4 text-xl font-bold text-white">Tint Spike</h1>
      <div className="w-full max-w-[390px]">
        <ArenaBoard
          pieces={pieces}
          selectedSquare={null}
          legalMoves={[]}
          lastMove={null}
          checkSquare={null}
          isLocked={false}
          onSquareClick={() => {}}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

```bash
cd apps/web && pnpm dev
```

Open `http://localhost:3000/arena` and verify:
- 32 pieces render on the board in correct positions
- White pieces have warm gold tint (sepia + saturate + brightness)
- Black pieces have purple tint (hue-rotate + saturate + brightness)
- Tints look distinct and readable, not muddy

**If tints look bad:** Adjust the CSS filter values in `globals.css` until they look good. If no filter combination works, flag for new black piece art assets.

- [ ] **Step 3: Commit the test page (will be replaced in Task 12)**

```bash
git add apps/web/src/app/arena/page.tsx
git commit -m "spike(arena): temporary arena page for tint verification"
```

---

## Chunk 3: Stockfish Worker + Game Hook

### Task 9: Stockfish setup (WASM files + Next.js config)

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/public/engines/` (directory)
- Modify: `apps/web/next.config.js`
- Create: `apps/web/scripts/copy-stockfish.sh`

- [ ] **Step 1: Install lila-stockfish-web**

```bash
cd apps/web && pnpm add lila-stockfish-web
```

- [ ] **Step 2: Create copy script for WASM files**

```bash
# apps/web/scripts/copy-stockfish.sh
#!/bin/bash
# Copy Stockfish WASM files from node_modules to public/engines
set -e
SRC="node_modules/lila-stockfish-web"
DEST="public/engines"
mkdir -p "$DEST"

# Find and copy the relevant .js and .wasm files
# lila-stockfish-web structure may vary — adapt file names as needed
if [ -f "$SRC/stockfish.js" ]; then
  cp "$SRC/stockfish.js" "$DEST/"
  cp "$SRC/stockfish.wasm" "$DEST/"
  echo "Stockfish files copied to $DEST"
elif [ -f "$SRC/sf16.js" ]; then
  cp "$SRC/sf16.js" "$DEST/stockfish.js"
  cp "$SRC/sf16.wasm" "$DEST/stockfish.wasm"
  echo "Stockfish (sf16) files copied to $DEST"
else
  echo "WARNING: Could not find Stockfish files in $SRC"
  ls -la "$SRC/"
  exit 1
fi
```

Make it executable and run:
```bash
chmod +x apps/web/scripts/copy-stockfish.sh
cd apps/web && bash scripts/copy-stockfish.sh
```

> **Important:** Inspect the actual `node_modules/lila-stockfish-web/` structure after install. The file names above are best-guess — adjust the copy script based on what's actually there.

- [ ] **Step 3: Add .gitignore for engines directory**

Create `apps/web/public/engines/.gitignore`:
```
# WASM files are copied from node_modules at build time
*.wasm
*.js
!.gitignore
```

- [ ] **Step 4: Add postinstall script to package.json**

In `apps/web/package.json`, add to the `"scripts"` section:

```json
"postinstall": "bash scripts/copy-stockfish.sh"
```

- [ ] **Step 5: Update next.config.js with headers**

Add `headers()` to the existing config:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage": false,
      "@react-native-async-storage/async-storage": false,
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  async headers() {
    return [
      {
        source: "/engines/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

> **Note:** `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers are needed for `SharedArrayBuffer`, which Stockfish WASM may require. If not needed, the cache header alone is sufficient.

- [ ] **Step 6: Verify WASM files serve correctly**

```bash
cd apps/web && pnpm dev
```

Then test that the WASM file is accessible:
```bash
curl -sI http://localhost:3000/engines/stockfish.wasm | head -5
```

Expected: HTTP 200 with correct headers.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/scripts/copy-stockfish.sh apps/web/public/engines/.gitignore apps/web/next.config.js
git commit -m "feat(arena): add lila-stockfish-web + WASM copy script + Next.js headers"
```

---

### Task 10: Stockfish Web Worker

**Files:**
- Create: `apps/web/src/lib/game/arena-worker.ts`

- [ ] **Step 1: Create the worker**

```ts
// apps/web/src/lib/game/arena-worker.ts

// This file runs as a Web Worker.
// It loads Stockfish WASM and communicates via postMessage.

type SearchMessage = {
  type: "search";
  fen: string;
  difficulty: "easy" | "medium" | "hard";
};

type InMessage = SearchMessage | { type: "init" };

type OutMessage =
  | { type: "ready" }
  | { type: "bestmove"; move: string }
  | { type: "error"; message: string };

const DIFFICULTY_CONFIG = {
  easy: { depth: 2, skillLevel: 0, elo: 400 },
  medium: { depth: 8, skillLevel: 10, elo: 1200 },
  hard: { depth: 15, skillLevel: 20, elo: 2000 },
} as const;

let stockfish: Worker | null = null;
let resolveMove: ((move: string) => void) | null = null;

function postOut(msg: OutMessage) {
  self.postMessage(msg);
}

function initEngine() {
  try {
    // Load Stockfish from public/engines/
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).importScripts("/engines/stockfish.js");

    // Stockfish creates a global — find it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sf = (self as any).Stockfish?.() || (self as any).stockfish;

    if (!sf) {
      postOut({ type: "error", message: "Failed to initialize Stockfish" });
      return;
    }

    stockfish = sf;

    sf.addMessageListener?.((line: string) => handleUCI(line));
    // Alternative: sf.onmessage for some builds
    if (!sf.addMessageListener && sf.addEventListener) {
      sf.addEventListener("message", (e: MessageEvent) => handleUCI(e.data));
    }

    sendUCI("uci");
  } catch (err) {
    postOut({ type: "error", message: `Engine load failed: ${err}` });
  }
}

function sendUCI(cmd: string) {
  if (!stockfish) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sf = stockfish as any;
  if (sf.postMessage) sf.postMessage(cmd);
  else if (sf.postRun) sf.postRun(cmd);
}

function handleUCI(line: string) {
  if (line === "uciok") {
    sendUCI("isready");
  } else if (line === "readyok") {
    postOut({ type: "ready" });
  } else if (line.startsWith("bestmove")) {
    const move = line.split(" ")[1];
    if (move && resolveMove) {
      resolveMove(move);
      resolveMove = null;
    }
  }
}

function search(fen: string, difficulty: SearchMessage["difficulty"]) {
  const config = DIFFICULTY_CONFIG[difficulty];

  sendUCI(`setoption name Skill Level value ${config.skillLevel}`);
  sendUCI(`setoption name UCI_LimitStrength value true`);
  sendUCI(`setoption name UCI_Elo value ${config.elo}`);
  sendUCI(`position fen ${fen}`);
  sendUCI(`go depth ${config.depth}`);

  // Set up a timeout
  const timeoutId = setTimeout(() => {
    if (resolveMove) {
      resolveMove = null;
      postOut({ type: "error", message: "AI timed out" });
    }
  }, 10_000);

  resolveMove = (move: string) => {
    clearTimeout(timeoutId);
    postOut({ type: "bestmove", move });
  };
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "init":
      initEngine();
      break;
    case "search":
      search(msg.fen, msg.difficulty);
      break;
  }
};
```

> **Implementation note:** The exact Stockfish initialization API depends on the `lila-stockfish-web` version. After installing in Task 9, inspect the actual module structure and adjust `initEngine()` accordingly. The pattern above covers the two most common Stockfish-in-worker APIs.

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

> Worker files may need special tsconfig handling. If tsc complains about `self`, add `"lib": ["webworker"]` to a dedicated `tsconfig.worker.json` or add `/// <reference lib="webworker" />` at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/game/arena-worker.ts
git commit -m "feat(arena): add Stockfish Web Worker with UCI protocol and difficulty config"
```

---

### Task 11: useChessGame hook

**Files:**
- Create: `apps/web/src/lib/game/use-chess-game.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/src/lib/game/use-chess-game.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { ArenaDifficulty, ArenaStatus, ChessBoardPiece, ChessPieceId } from "./types";
import { fenToPieces } from "./arena-utils";

type WorkerMessage =
  | { type: "ready" }
  | { type: "bestmove"; move: string }
  | { type: "error"; message: string };

export type ChessGameState = {
  fen: string;
  pieces: ChessBoardPiece[];
  status: ArenaStatus;
  isThinking: boolean;
  selectedSquare: string | null;
  legalMoves: string[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  pendingPromotion: { from: string; to: string } | null;
  difficulty: ArenaDifficulty;
  // Actions
  selectSquare: (square: string) => void;
  promoteWith: (piece: "q" | "r" | "b" | "n") => void;
  reset: () => void;
  resign: () => void;
  setDifficulty: (d: ArenaDifficulty) => void;
  startGame: () => void;
};

export function useChessGame(): ChessGameState {
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>("easy");
  const [status, setStatus] = useState<ArenaStatus>("selecting");
  const [isThinking, setIsThinking] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const gameRef = useRef(new Chess());
  const workerRef = useRef<Worker | null>(null);
  const [fen, setFen] = useState(gameRef.current.fen());

  // Derived state
  const pieces = fenToPieces(fen);

  const checkSquare = (() => {
    const game = gameRef.current;
    if (!game.isCheck()) return null;
    // Find the king of the side to move
    const board = game.board();
    const turn = game.turn();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (cell && cell.type === "k" && cell.color === turn) {
          const fileChar = String.fromCharCode(97 + f);
          return `${fileChar}${8 - r}`;
        }
      }
    }
    return null;
  })();

  // Initialize worker
  useEffect(() => {
    if (status !== "loading") return;

    const worker = new Worker(
      new URL("./arena-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case "ready":
          workerRef.current = worker;
          setStatus("playing");
          break;
        case "bestmove":
          handleAiMove(msg.move);
          break;
        case "error":
          console.error("Stockfish error:", msg.message);
          setIsThinking(false);
          break;
      }
    };

    worker.onerror = () => {
      console.error("Worker crashed");
      setIsThinking(false);
    };

    worker.postMessage({ type: "init" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleAiMove = useCallback((moveStr: string) => {
    const game = gameRef.current;
    const from = moveStr.slice(0, 2);
    const to = moveStr.slice(2, 4);
    const promotion = moveStr.length > 4 ? moveStr[4] : undefined;

    try {
      game.move({ from, to, promotion });
      setFen(game.fen());
      setLastMove({ from, to });
      setIsThinking(false);

      // Check end states
      if (game.isCheckmate()) setStatus("checkmate");
      else if (game.isStalemate()) setStatus("stalemate");
      else if (game.isDraw()) setStatus("draw");
    } catch {
      console.error("Invalid AI move:", moveStr);
      setIsThinking(false);
    }
  }, []);

  const triggerAiMove = useCallback(() => {
    const worker = workerRef.current;
    const game = gameRef.current;
    if (!worker || game.turn() !== "b") return;

    setIsThinking(true);
    worker.postMessage({
      type: "search",
      fen: game.fen(),
      difficulty,
    });
  }, [difficulty]);

  const selectSquare = useCallback((square: string) => {
    const game = gameRef.current;
    if (status !== "playing" || isThinking || game.turn() !== "w") return;

    const piece = game.get(square);

    // If clicking on own piece, select it
    if (piece && piece.color === "w") {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalMoves(moves.map((m) => m.to));
      return;
    }

    // If a square is selected and clicking a legal move target
    if (selectedSquare && legalMoves.includes(square)) {
      // Check if this is a pawn promotion
      const movingPiece = game.get(selectedSquare);
      const targetRank = Number(square[1]);
      if (movingPiece?.type === "p" && targetRank === 8) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      // Execute normal move
      try {
        game.move({ from: selectedSquare, to: square });
        setFen(game.fen());
        setLastMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setLegalMoves([]);

        // Check end states
        if (game.isCheckmate()) setStatus("checkmate");
        else if (game.isStalemate()) setStatus("stalemate");
        else if (game.isDraw()) setStatus("draw");
        else triggerAiMove();
      } catch {
        // Invalid move — deselect
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return;
    }

    // Deselect
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [status, isThinking, selectedSquare, legalMoves, triggerAiMove]);

  const promoteWith = useCallback((piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    const game = gameRef.current;

    try {
      game.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
      setFen(game.fen());
      setLastMove({ from: pendingPromotion.from, to: pendingPromotion.to });
      setPendingPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);

      if (game.isCheckmate()) setStatus("checkmate");
      else if (game.isStalemate()) setStatus("stalemate");
      else if (game.isDraw()) setStatus("draw");
      else triggerAiMove();
    } catch {
      setPendingPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [pendingPromotion, triggerAiMove]);

  const reset = useCallback(() => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setIsThinking(false);
    setStatus("selecting");
  }, []);

  const resign = useCallback(() => {
    setStatus("resigned");
    setIsThinking(false);
  }, []);

  const startGame = useCallback(() => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setStatus("loading");
  }, []);

  return {
    fen,
    pieces,
    status,
    isThinking,
    selectedSquare,
    legalMoves,
    lastMove,
    checkSquare,
    pendingPromotion,
    difficulty,
    selectSquare,
    promoteWith,
    reset,
    resign,
    setDifficulty,
    startGame,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/game/use-chess-game.ts
git commit -m "feat(arena): add useChessGame hook — chess.js + Stockfish orchestration"
```

---

## Chunk 4: Arena UI Components + Page

### Task 12: Arena sub-components

**Files:**
- Create: `apps/web/src/components/arena/difficulty-selector.tsx`
- Create: `apps/web/src/components/arena/arena-hud.tsx`
- Create: `apps/web/src/components/arena/promotion-overlay.tsx`
- Create: `apps/web/src/components/arena/arena-end-state.tsx`

- [ ] **Step 1: DifficultySelector**

```tsx
// apps/web/src/components/arena/difficulty-selector.tsx
"use client";

import Link from "next/link";
import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaDifficulty } from "@/lib/game/types";

type Props = {
  selected: ArenaDifficulty;
  onSelect: (d: ArenaDifficulty) => void;
  onStart: () => void;
};

const LEVELS: { key: ArenaDifficulty; dot: string }[] = [
  { key: "easy", dot: "bg-emerald-400" },
  { key: "medium", dot: "bg-amber-400" },
  { key: "hard", dot: "bg-rose-400" },
];

export function DifficultySelector({ selected, onSelect, onStart }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">{ARENA_COPY.title}</h1>
      <p className="text-sm text-white/60">{ARENA_COPY.subtitle}</p>

      <div className="flex w-full max-w-[280px] flex-col gap-3">
        {LEVELS.map(({ key, dot }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={[
              "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
              selected === key
                ? "bg-white/15 ring-2 ring-cyan-400/60"
                : "bg-white/5 hover:bg-white/10",
            ].join(" ")}
          >
            <span className={`h-3 w-3 rounded-full ${dot}`} />
            <div>
              <span className="font-semibold text-white">
                {ARENA_COPY.difficulty[key]}
              </span>
              <p className="text-xs text-white/50">
                {ARENA_COPY.difficultyDesc[key]}
              </p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-2 rounded-xl bg-cyan-500 px-8 py-3 font-bold text-white transition-all hover:bg-cyan-400 active:scale-95"
      >
        {ARENA_COPY.startMatch}
      </button>

      <Link
        href="/play-hub"
        className="text-sm text-white/40 transition-colors hover:text-white/60"
      >
        ← {ARENA_COPY.backToHub}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: ArenaHud**

```tsx
// apps/web/src/components/arena/arena-hud.tsx
"use client";

import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaDifficulty } from "@/lib/game/types";

type Props = {
  difficulty: ArenaDifficulty;
  isThinking: boolean;
};

export function ArenaHud({ difficulty, isThinking }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-sm font-semibold text-white/80">
        ♟ {ARENA_COPY.difficulty[difficulty]}
      </span>
      <span aria-live="polite" className="text-sm">
        {isThinking && (
          <span className="animate-pulse text-amber-300">
            {ARENA_COPY.aiThinking}
          </span>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: PromotionOverlay**

```tsx
// apps/web/src/components/arena/promotion-overlay.tsx
"use client";

import { ARENA_COPY } from "@/lib/content/editorial";
import { ARENA_PIECE_IMG } from "@/lib/game/arena-utils";

type PromotionChoice = "q" | "r" | "b" | "n";

type Props = {
  onSelect: (piece: PromotionChoice) => void;
};

const CHOICES: { key: PromotionChoice; label: string }[] = [
  { key: "q", label: "Queen" },
  { key: "r", label: "Rook" },
  { key: "b", label: "Bishop" },
  { key: "n", label: "Knight" },
];

const PIECE_KEY_MAP: Record<PromotionChoice, keyof typeof ARENA_PIECE_IMG> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

export function PromotionOverlay({ onSelect }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-800/95 p-5">
        <p className="text-sm font-semibold text-white/80">
          {ARENA_COPY.promotionTitle}
        </p>
        <div className="flex gap-3">
          {CHOICES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/10 p-3 transition-all hover:bg-white/20 active:scale-95"
            >
              <img
                src={ARENA_PIECE_IMG[PIECE_KEY_MAP[key]]}
                alt={label}
                className="h-10 w-10 object-contain piece-white"
              />
              <span className="text-xs text-white/60">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: ArenaEndState**

```tsx
// apps/web/src/components/arena/arena-end-state.tsx
"use client";

import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaStatus } from "@/lib/game/types";

type Props = {
  status: ArenaStatus;
  isPlayerWin: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
};

function getResultText(status: ArenaStatus, isPlayerWin: boolean): string {
  switch (status) {
    case "checkmate":
      return isPlayerWin
        ? ARENA_COPY.endState.checkmate.win
        : ARENA_COPY.endState.checkmate.lose;
    case "stalemate":
      return ARENA_COPY.endState.stalemate;
    case "draw":
      return ARENA_COPY.endState.draw;
    case "resigned":
      return ARENA_COPY.endState.resigned;
    default:
      return "";
  }
}

export function ArenaEndState({ status, isPlayerWin, onPlayAgain, onBackToHub }: Props) {
  const text = getResultText(status, isPlayerWin);
  if (!text) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="alert" aria-live="assertive">
      <div className="flex flex-col items-center gap-5 rounded-2xl bg-slate-800/95 p-8 animate-in zoom-in-90 duration-300">
        <h2 className={`text-2xl font-bold ${isPlayerWin ? "text-emerald-300" : "text-rose-300"}`}>
          {text}
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-xl bg-cyan-500 px-6 py-2.5 font-semibold text-white transition-all hover:bg-cyan-400 active:scale-95"
          >
            {ARENA_COPY.playAgain}
          </button>
          <button
            type="button"
            onClick={onBackToHub}
            className="rounded-xl bg-white/10 px-6 py-2.5 font-semibold text-white/80 transition-all hover:bg-white/20 active:scale-95"
          >
            {ARENA_COPY.backToHub}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/arena/difficulty-selector.tsx apps/web/src/components/arena/arena-hud.tsx apps/web/src/components/arena/promotion-overlay.tsx apps/web/src/components/arena/arena-end-state.tsx
git commit -m "feat(arena): add DifficultySelector, ArenaHud, PromotionOverlay, ArenaEndState"
```

---

### Task 13: Arena page (full route)

**Files:**
- Modify: `apps/web/src/app/arena/page.tsx` (replace spike from Task 8)

- [ ] **Step 1: Replace the spike page with the full arena page**

```tsx
// apps/web/src/app/arena/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useChessGame } from "@/lib/game/use-chess-game";
import { ArenaBoard } from "@/components/arena/arena-board";
import { DifficultySelector } from "@/components/arena/difficulty-selector";
import { ArenaHud } from "@/components/arena/arena-hud";
import { PromotionOverlay } from "@/components/arena/promotion-overlay";
import { ArenaEndState } from "@/components/arena/arena-end-state";
import { ARENA_COPY } from "@/lib/content/editorial";

export default function ArenaPage() {
  const router = useRouter();
  const game = useChessGame();

  const isEndState = ["checkmate", "stalemate", "draw", "resigned"].includes(game.status);

  // After checkmate, chess.js turn belongs to the mated side.
  // If black to move (" b ") → black is mated → player (white) wins.
  const isPlayerWin = game.status === "checkmate" && game.fen.includes(" b ");

  const handleBackToHub = () => router.push("/play-hub");

  // Loading state
  if (game.status === "loading") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a1628]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-white/60">{ARENA_COPY.preparingAi}</p>
        </div>
      </main>
    );
  }

  // Difficulty selection
  if (game.status === "selecting") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a1628]">
        <DifficultySelector
          selected={game.difficulty}
          onSelect={game.setDifficulty}
          onStart={game.startGame}
        />
      </main>
    );
  }

  // Playing + end states
  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-[#0a1628]">
      <div className="flex w-full max-w-[var(--app-max-width,390px)] flex-col">
        <ArenaHud difficulty={game.difficulty} isThinking={game.isThinking} />

        <div className="relative w-full">
          <ArenaBoard
            pieces={game.pieces}
            selectedSquare={game.selectedSquare}
            legalMoves={game.legalMoves}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            isLocked={game.isThinking || isEndState}
            onSquareClick={game.selectSquare}
          />
          {game.pendingPromotion && (
            <PromotionOverlay onSelect={game.promoteWith} />
          )}
        </div>

        {/* Actions bar */}
        {!isEndState && (
          <div className="flex items-center justify-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={game.resign}
              className="rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-white/70 transition-all hover:bg-white/20 active:scale-95"
            >
              {ARENA_COPY.resign}
            </button>
          </div>
        )}
      </div>

      {isEndState && (
        <ArenaEndState
          status={game.status}
          isPlayerWin={isPlayerWin}
          onPlayAgain={game.reset}
          onBackToHub={handleBackToHub}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

- [ ] **Step 3: Manual test**

```bash
cd apps/web && pnpm dev
```

Open `http://localhost:3000/arena`:
1. Verify difficulty selector renders
2. Select a difficulty and click "Start Match"
3. Verify loading spinner shows ("Preparing AI...")
4. Verify board renders with 32 pieces
5. Click a white piece — verify legal moves highlight
6. Make a move — verify AI responds
7. Test resign button
8. Play to checkmate or stalemate if possible

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/arena/page.tsx
git commit -m "feat(arena): add full arena page with game flow (select → play → end)"
```

---

### Task 14: Play-hub entry point

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx`

- [ ] **Step 1: Add Free Play button to the HUD zone**

Add a `Link` import and a "Free Play" button. Place it in the HUD bar area of `MissionPanel`, after the piece selector.

Read the full `mission-panel.tsx` to find the exact insertion point (look for the piece selector buttons and add the Free Play link after them).

Add this button component after the piece selector row:

```tsx
<Link
  href="/arena"
  className="flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/30 active:scale-95"
>
  ♟ Free Play
</Link>
```

Import at the top:
```tsx
import Link from "next/link";
```

- [ ] **Step 2: Verify in dev**

```bash
cd apps/web && pnpm dev
```

Open `http://localhost:3000/play-hub`:
- Verify "Free Play" button is visible in the HUD area
- Click it → should navigate to `/arena`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "feat(arena): add Free Play entry point in play-hub HUD"
```

---

### Task 15: Final integration test

**Files:** None (testing only)

- [ ] **Step 1: Full type-check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

- [ ] **Step 3: Verify exercise board not broken**

Open `http://localhost:3000/play-hub`:
- Select rook → verify exercises work
- Tutorial hints work
- Piece moves correctly
- Stars/scoring unaffected

- [ ] **Step 4: Full arena flow**

Open `http://localhost:3000/arena`:
- Select Easy → Start Match → loading → board with 32 pieces
- Click white pawn → see legal moves → make move → AI responds
- Play several moves, verify:
  - Legal move highlights
  - Last move indicators
  - Check indicator (if applicable)
  - Piece tints (gold vs purple)
- Test resign → end state overlay → Play Again → back to selector
- Test Back to Hub → navigates to /play-hub

- [ ] **Step 5: Commit any final fixes**

If any fixes were needed during testing:
```bash
git add -u
git commit -m "fix(arena): address integration test findings"
```
