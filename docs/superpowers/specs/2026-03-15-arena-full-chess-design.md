# Arena — Full Chess vs AI

**Date:** 2026-03-15
**Status:** Draft
**Issue:** N/A (new feature)

## Overview

Add a full chess game mode to Chesscito where players compete against Stockfish AI on the custom Chesscito board. Accessible via `/arena` route with entry point from the play-hub. Three difficulty levels (Easy/Medium/Hard). No timer in v1.

This extends Chesscito's educational flow: learn piece movements in tutorials → play full chess in the arena → (future) wager on matches.

## Decisions

| Decision | Value |
|---|---|
| Game mode | vs AI (Stockfish WASM) |
| Route | `/arena` with entry from play-hub |
| Difficulty | Selectable: Easy / Medium / Hard |
| Black pieces | CSS tint overlay (gold vs purple) |
| Timer | Not in v1 |
| Rules engine | chess.js |
| Board rendering | New `ArenaBoard` component sharing `interpolateQuad` from a `BoardRenderer` |
| Pawn promotion | Compact overlay with 4 piece options |
| Game persistence | Not in v1 |
| Captured pieces | Nice-to-have v1 |

## Dependencies

### New packages
- `chess.js` (~30KB) — legal move generation, check/mate/draw detection, FEN/PGN, all special moves
- `lila-stockfish-web` (Lichess's Stockfish WASM build) — AI engine, supports `UCI_Elo` and `Skill Level`, ~3MB compressed with Brotli. Loaded lazily only when entering `/arena`. This is the same build powering Lichess, well-maintained and confirmed to support difficulty tuning via UCI options.

### Existing (reused)
- `board.tsx` — homographic rendering, `interpolateQuad`, clip-path cells, CSS transitions
- `globals.css` — `.playhub-board-*` classes
- Piece art in `/public/art/piece-*.png` (all 6 types already exist)

## Architecture

### Types (`lib/game/types.ts`)

New types added alongside existing ones (no modifications to Exercise/PieceProgress):

```ts
type ChessPieceId = PieceId | "pawn" | "queen" | "king"  // superset of existing PieceId
type PieceColor = "w" | "b"
type ChessBoardPiece = { type: ChessPieceId; color: PieceColor; square: string }
type ArenaDifficulty = "easy" | "medium" | "hard"
type ArenaStatus = "loading" | "selecting" | "playing" | "checkmate" | "stalemate" | "draw" | "resigned"
```

Note: `ChessPieceId` is explicitly a superset of the existing `PieceId` to avoid divergent unions. `"loading"` status covers the Stockfish WASM fetch phase.

### Game State Hook: `useChessGame(difficulty)`

Located at `lib/game/use-chess-game.ts`.

```
State:
- game: Chess instance (chess.js)
- fen: string (current board position)
- difficulty: ArenaDifficulty
- status: ArenaStatus
- playerColor: "w" (always white in v1)
- isThinking: boolean (AI processing)
- lastMove: { from: string; to: string } | null
- selectedSquare: string | null
- legalMoves: string[] (valid targets for selected piece)
- capturedPieces: { w: ChessPieceId[]; b: ChessPieceId[] }

Actions:
- selectSquare(square) → if own piece, show legal moves; if legal target, execute move
- makeMove(from, to, promotion?) → validate with chess.js, update FEN, trigger AI
- aiMove() → send position to Stockfish worker, receive best move, execute
- reset() → new game with same difficulty
- resign() → end game as loss
- setDifficulty(d) → change difficulty (only in "selecting" status)
```

### Stockfish Web Worker (`lib/game/arena-worker.ts`)

Separate Web Worker that loads Stockfish WASM.

```
Communication protocol:
1. Main thread creates Worker
2. Worker loads stockfish.js + .wasm from /public/engines/
3. Worker sends { type: "ready" }
4. Per AI turn:
   - Main → Worker: { type: "search", fen: string, difficulty: ArenaDifficulty }
   - Worker configures UCI options (Skill Level, UCI_Elo)
   - Worker → Stockfish: "position fen ...", "go depth N"
   - Stockfish → Worker: "bestmove e2e4"
   - Worker → Main: { type: "bestmove", move: "e2e4" }
5. On /arena unmount: Worker.terminate()
```

Difficulty mapping:

| Level | UCI_Elo | Depth | Skill Level | Experience |
|---|---|---|---|---|
| Easy | 400 | 2 | 0 | Frequent mistakes, ideal post-tutorial |
| Medium | 1200 | 8 | 10 | Decent play, challenging for intermediates |
| Hard | 2000 | 15 | 20 | Strong play, for experts |

**Loading strategy (MiniPay bandwidth-aware):**
- WASM files served from `/public/engines/` with Brotli/gzip compression (~3MB → ~1.5MB transfer)
- Loading state: `ArenaStatus = "loading"` with progress indicator ("Preparing AI..." + spinner)
- HTTP cache headers: `Cache-Control: public, max-age=31536000, immutable` (WASM is versioned)
- Timeout: 30s max for WASM fetch; on timeout show retry button
- Browser support: if no WASM support, show "Your browser doesn't support the AI engine"

**Worker error handling:**
- Worker crash mid-game → show "AI disconnected" + offer to restart match
- Stockfish invalid move (rare) → log error, request new search with increased depth
- `bestmove` timeout (10s) → terminate worker, show "AI timed out" + restart option
- All errors keep the game state intact so the user doesn't lose their position

**Next.js config:**
- Add `headers()` in `next.config.js` for `/engines/*` MIME type (`application/wasm`) and cache headers
- No webpack WASM loader needed — Stockfish loads via Worker `importScripts()`

### Board Component Architecture (split approach)

The existing `board.tsx` already has `mode: "tutorial" | "practice"` and is purpose-built for single-piece exercises. Rather than overloading it, we extract the shared rendering math into a utility and create a new `ArenaBoard` component.

**Shared: `lib/game/board-geometry.ts` (extracted from board.tsx)**
- `interpolateQuad(u, v)` — homographic cell positioning
- `cellClipPath(file, rank)` — clip-path polygon for a cell
- Corner constants, `lerp`, `BOARD_V_GAMMA`
- Pure functions, no React dependencies

**Existing: `components/board.tsx` (unchanged)**
- Continues to use extracted geometry via import
- `mode: "tutorial" | "practice"` — no changes to props or behavior
- Exercise/tutorial flow is untouched, zero regression risk

**New: `components/arena/arena-board.tsx`**
- Uses same `board-geometry.ts` for cell positioning
- Accepts `pieces: ChessBoardPiece[]` — derived from FEN via `fenToPieces()` utility
- Renders N `<picture>` elements, each positioned via `interpolateQuad`
- CSS tint by color:
  - `.piece-white`: `filter: sepia(0.3) saturate(1.5) brightness(1.1)` (warm gold)
  - `.piece-black`: `filter: hue-rotate(260deg) saturate(0.8) brightness(0.7)` (purple)
  - Fallback: if tint looks muddy on Chesscito art, create separate black piece PNGs
- `onSquareClick(square: string)` callback
- Only player-color pieces interactive on player's turn
- `isThinking=true` → board locked

**New: `lib/game/arena-utils.ts`**
- `fenToPieces(fen: string): ChessBoardPiece[]` — converts chess.js board state to our type
- `squareToFileRank(square: string): { file: number; rank: number }` — maps "e4" → {file:4, rank:3}

**New CSS cell states (in globals.css):**
- `.arena-board-cell.is-last-move` — subtle border on from/to squares of last move
- `.arena-board-cell.is-check` — red tint on king's square when in check
- `.arena-board-cell.is-highlighted` — legal move indicator (same style as exercise)

**Move animations:**
- Single piece moves: CSS transition on position (same pattern as exercise board)
- Castling: both king and rook transition simultaneously (two elements moving)
- En passant: captured pawn fades out via `opacity` transition
- Promotion: piece image swaps after promotion overlay selection

### Pawn Promotion UI

When a pawn reaches the last rank:
- Compact overlay appears over the board (not fullscreen)
- Shows 4 buttons with piece images: Queen, Rook, Bishop, Knight
- Gold tint applied (player is always white)
- Selection triggers `makeMove(from, to, promotion)`
- AI promotion is automatic (Stockfish decides)

## Screens

### `/arena` — Difficulty Selection (pre-match)

```
┌─────────────────────┐
│     ♟ Free Play     │  title
│                     │
│  ┌───────────────┐  │
│  │  🟢 Easy      │  │  difficulty buttons
│  │  🟡 Medium    │  │  consistent with app
│  │  🔴 Hard      │  │  design system
│  └───────────────┘  │
│                     │
│   [ Start Match ]   │  CTA (cyan, like submitScore)
│                     │
│   ← Back to Hub     │  link to /play-hub
└─────────────────────┘
```

### `/arena` — In Match

```
┌─────────────────────┐
│ ♟ Hard   AI 🤔      │  HUD: difficulty + thinking indicator
├─────────────────────┤
│                     │
│     Board (full)    │  board.tsx mode="full"
│     32 pieces       │
│                     │
├─────────────────────┤
│  Captured: ♙♙♗     │  captured pieces (nice-to-have v1)
├─────────────────────┤
│ [ Resign ]  [ New ] │  actions
└─────────────────────┘
```

### End State

Reuses `PhaseFlash` pattern — overlay with result:
- "Checkmate — You Win!" / "Checkmate — AI Wins" / "Stalemate — Draw"
- Buttons: `[ Play Again ]` `[ Back to Hub ]`

### Entry Point from Play-Hub

- Button/card in HUD zone or below piece selector: **"Free Play ♟"**
- Navigates to `/arena` via `next/link`
- Soft gating: if no tutorials completed, show a one-time prompt "Try learning a piece first?" with skip option. Never a hard block.

## Edge Cases

All handled by chess.js — no custom logic needed:
- Threefold repetition → `game.isThreefoldRepetition()`
- Fifty-move rule → `game.isDraw()`
- Insufficient material → `game.isInsufficientMaterial()`
- Stalemate → `game.isStalemate()`
- Castling, en passant → built into chess.js move validation

## Out of Scope (v1)

- Timer / chess clock
- Game persistence (resume after leaving)
- Multiplayer (P2P or server)
- On-chain wagering / economy
- Opening book / endgame tablebase
- Move history panel / PGN export
- Sound effects
- Player plays as black

## Future (v2+)

- Timer with configurable time controls
- Wagering: bet cUSD/USDC per match, winner takes pot (on-chain escrow)
- Play as black option
- Game persistence via localStorage
- Move history sidebar
- Sound effects for moves, captures, check

## File Map

| File | Action |
|---|---|
| `apps/web/package.json` | Add chess.js, lila-stockfish-web |
| `apps/web/src/lib/game/types.ts` | Add ChessPieceId, PieceColor, ChessBoardPiece, ArenaDifficulty, ArenaStatus |
| `apps/web/src/lib/game/board-geometry.ts` | New — extracted from board.tsx (interpolateQuad, corners, clipPath) |
| `apps/web/src/lib/game/arena-utils.ts` | New — fenToPieces(), squareToFileRank() |
| `apps/web/src/lib/game/use-chess-game.ts` | New — game state hook |
| `apps/web/src/lib/game/arena-worker.ts` | New — Stockfish Web Worker |
| `apps/web/src/components/board.tsx` | Refactor: import geometry from board-geometry.ts (no behavior change) |
| `apps/web/src/components/arena/arena-board.tsx` | New — full chess board, multi-piece rendering |
| `apps/web/src/components/arena/promotion-overlay.tsx` | New — pawn promotion piece picker |
| `apps/web/src/components/arena/difficulty-selector.tsx` | New — pre-match difficulty selection |
| `apps/web/src/components/arena/arena-hud.tsx` | New — top bar with difficulty + AI indicator |
| `apps/web/src/components/arena/arena-end-state.tsx` | New — game over overlay (PhaseFlash pattern) |
| `apps/web/src/app/globals.css` | Add .piece-white, .piece-black, .arena-board-cell states |
| `apps/web/src/app/arena/page.tsx` | New — arena page with selection + game screens |
| `apps/web/src/lib/content/editorial.ts` | Add ARENA_COPY constants |
| `apps/web/public/engines/` | Stockfish WASM files (lila-stockfish-web) |
| `apps/web/next.config.js` | Add headers for /engines/* MIME type + cache |
| `apps/web/src/components/play-hub/mission-panel.tsx` | Add "Free Play" entry point |

## Accessibility

- `ArenaBoard` maintains `role="grid"` and `aria-label` on cells (same as exercise board)
- `aria-live="polite"` region for AI thinking indicator and game state announcements
- Screen reader announces: AI moves, check, checkmate, stalemate
- Keyboard: Tab to navigate cells, Enter to select/move (relevant for assistive tech on mobile)
