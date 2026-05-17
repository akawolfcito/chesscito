"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ArenaBoard } from "@/components/arena/arena-board";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { MissionHeaderCandy } from "@/components/exercises/mission-header-candy";
import { ShareModal } from "@/components/share/share-modal";
import { fenToPieces } from "@/lib/game/arena-utils";
import {
  hapticImpact,
  hapticReject,
  hapticSuccess,
  hapticTap,
} from "@/lib/haptics";
import { ENDGAME_SHARE_COPY } from "@/lib/content/editorial";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";
import { pickAiMoveOrFallback } from "@/lib/game/mini-arena-ai";
import type { ChessBoardPiece } from "@/lib/game/types";
import { endgameStars } from "@/lib/game/scoring";
import {
  getMiniArenaBest,
  recordMiniArenaBest,
} from "@/lib/game/mini-arena-progress";
import { MiniArenaResultCeremony } from "./mini-arena-result-ceremony";

type Status = "playing" | "won" | "drawn" | "thinking";

type TerminalResult = {
  status: "won" | "drawn";
  moveCount: number;
  completionStars: number;
  isNewBest: boolean;
  previousBest: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setup: MiniArenaSetup;
  /** Fired the first time the player checkmates the opponent in this
   *  setup. Parent can use it to gate future content (badge, next
   *  setup unlock). Receives the move count for "fluid" star logic. */
  onWin?: (moveCount: number) => void;
};

const REJECT_SHAKE_MS = 220;
const DEBUG_MINI_ARENA = process.env.NODE_ENV === "development";

function debugMiniArena(...args: unknown[]) {
  if (DEBUG_MINI_ARENA) console.debug("[MiniArena]", ...args);
}

function dispatchMoveHaptic(flags: string | undefined, isCheck: boolean, isMate: boolean) {
  if (isMate) { hapticImpact(); return; }
  if (isCheck) { hapticSuccess(); return; }
  if (flags && (flags.includes("c") || flags.includes("e"))) { hapticImpact(); return; }
  hapticTap();
}

function parseFenSquares(fen: string): { wk: string; wr: string; bk: string } {
  const board = fen.split(" ")[0];
  const ranks = board.split("/");
  let wk = "", wr = "", bk = "";
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of ranks[r]) {
      if (/[1-8]/.test(ch)) {
        f += Number(ch);
      } else {
        const file = "abcdefgh"[f];
        const rank = String(8 - r);
        if (ch === "K") wk = file + rank;
        else if (ch === "R") wr = file + rank;
        else if (ch === "k") bk = file + rank;
        f++;
      }
    }
  }
  return { wk, wr, bk };
}

export function MiniArenaSheet({ open, onOpenChange, setup, onWin }: Props) {
  const gameRef = useRef(new Chess(setup.fen));
  const [fen, setFen] = useState(setup.fen);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [rejectingSquare, setRejectingSquare] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("playing");
  const [moveCount, setMoveCount] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winFiredRef = useRef(false);
  const wasOpenRef = useRef(false);
  const terminalResultRef = useRef<TerminalResult | null>(null);
  const dismissedTerminalRef = useRef(false);
  const [terminalResult, setTerminalResult] = useState<TerminalResult | null>(null);

  // Keep a ref in sync with state for closure-safe access in timers.
  useEffect(() => {
    terminalResultRef.current = terminalResult;
  }, [terminalResult]);

  const initializeGame = useCallback((source: string) => {
    debugMiniArena("initializeGame", { source });
    gameRef.current = new Chess(setup.fen);
    setFen(setup.fen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setRejectingSquare(null);
    setStatus("playing");
    setMoveCount(0);
    setLastMove(null);
    setShareOpen(false);
    dismissedTerminalRef.current = false;
    winFiredRef.current = false;
    debugMiniArena("clear terminalResult", { source });
    setTerminalResult(null);
  }, [setup.fen]);

  // Only re-init when sheet transitions closed→open.  The wasOpenRef
  // guard prevents stale dependency updates (e.g. setup.id/fen) from
  // silently wiping terminalResult mid-game.
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    initializeGame("fresh open");
  }, [initializeGame, open, setup.id]);

  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
    };
  }, []);

  // Defensive recovery: if status is terminal but terminalResult is
  // null (e.g. from stale closure or strict-mode double-render), fill
  // it in so the ceremony always appears.  Skips when the user has
  // explicitly dismissed (dismissedTerminalRef).
  useEffect(() => {
    if (terminalResult) return;
    if (dismissedTerminalRef.current) return;
    if (status !== "won" && status !== "drawn") return;

    debugMiniArena("terminal recovery effect", { status, moveCount, fen });

    if (status === "won") {
      const safeMoveCount = Math.max(moveCount, 1);
      const stars = endgameStars(safeMoveCount, setup.parMoves);
      const previousBest = getMiniArenaBest(setup.id);
      const isNewBest = recordMiniArenaBest(setup.id, safeMoveCount);

      const recovered: TerminalResult = {
        status: "won",
        moveCount: safeMoveCount,
        completionStars: stars,
        isNewBest,
        previousBest,
      };

      debugMiniArena("setTerminalResult from recovery", recovered);
      setTerminalResult(recovered);
      return;
    }

    const recovered: TerminalResult = {
      status: "drawn",
      moveCount,
      completionStars: 0,
      isNewBest: false,
      previousBest: getMiniArenaBest(setup.id),
    };

    debugMiniArena("setTerminalResult from recovery", recovered);
    setTerminalResult(recovered);
  }, [status, terminalResult, moveCount, fen, setup.id, setup.parMoves]);

  const shareBaseUrl = useMemo(() => {
    const squares = parseFenSquares(setup.fen);
    return `/api/og/endgame?mode=krk&name=${encodeURIComponent(setup.name)}&wk=${squares.wk}&wr=${squares.wr}&bk=${squares.bk}`;
  }, [setup.fen, setup.name]);

  const pieces = useMemo<ChessBoardPiece[]>(() => {
    return fenToPieces(fen).map((p, i) => ({
      ...p,
      id: `${p.color}-${p.type}-${p.square}-${i}`,
    }));
  }, [fen]);

  const checkSquare = (() => {
    const game = gameRef.current;
    if (!game.isCheck()) return null;
    const board = game.board();
    const turn = game.turn();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (cell && cell.type === "k" && cell.color === turn) {
          return `${String.fromCharCode(97 + f)}${8 - r}`;
        }
      }
    }
    return null;
  })();

  function endIfTerminal(source: "player" | "ai", nextMoveCount = moveCount): boolean {
    const game = gameRef.current;

    debugMiniArena("endIfTerminal", {
      source,
      fen: game.fen(),
      turn: game.turn(),
      isCheckmate: game.isCheckmate(),
      isStalemate: game.isStalemate(),
      isDraw: game.isDraw(),
      isInsufficientMaterial: game.isInsufficientMaterial(),
      moveCount,
      nextMoveCount,
    });

    if (game.isCheckmate()) {
      const playerWon = game.turn() === "b";
      debugMiniArena("checkmate detected, playerWon:", playerWon);

      if (playerWon) {
        const totalMoves = nextMoveCount;
        if (!winFiredRef.current) {
          winFiredRef.current = true;
          onWin?.(totalMoves);
        }
        const stars = endgameStars(totalMoves, setup.parMoves);
        const previousBest = getMiniArenaBest(setup.id);
        const isNewBest = recordMiniArenaBest(setup.id, totalMoves);

        const result: TerminalResult = {
          status: "won",
          moveCount: totalMoves,
          completionStars: stars,
          isNewBest,
          previousBest,
        };

        debugMiniArena("setTerminalResult", result);
        dismissedTerminalRef.current = false;
        setStatus("won");
        setTerminalResult(result);
        return true;
      }

      const result: TerminalResult = {
        status: "drawn",
        moveCount: nextMoveCount,
        completionStars: 0,
        isNewBest: false,
        previousBest: getMiniArenaBest(setup.id),
      };

      debugMiniArena("setTerminalResult", result);
      dismissedTerminalRef.current = false;
      setStatus("drawn");
      setTerminalResult(result);
      return true;
    }

    if (game.isStalemate() || game.isDraw() || game.isInsufficientMaterial()) {
      const result: TerminalResult = {
        status: "drawn",
        moveCount: nextMoveCount,
        completionStars: 0,
        isNewBest: false,
        previousBest: getMiniArenaBest(setup.id),
      };

      debugMiniArena("setTerminalResult", result);
      dismissedTerminalRef.current = false;
      setStatus("drawn");
      setTerminalResult(result);
      return true;
    }

    return false;
  }

  function triggerAi() {
    // Guard against scheduling AI after a terminal result.
    if (terminalResultRef.current) {
      debugMiniArena("triggerAi skipped — terminalResult already set");
      return;
    }

    const game = gameRef.current;
    if (game.isCheckmate() || game.isDraw() || game.isStalemate() || game.isGameOver()) {
      debugMiniArena("triggerAi skipped — game already over");
      endIfTerminal("ai", moveCount);
      return;
    }

    setStatus("thinking");
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      const game = gameRef.current;

      if (game.isCheckmate() || game.isDraw() || game.isStalemate() || game.isGameOver()) {
        endIfTerminal("ai", moveCount);
        return;
      }

      // pickAiMoveOrFallback never returns an illegal move and never
      // hangs on engine misbehavior — see lib/game/mini-arena-ai.ts.
      // null = no legal moves left → resolve via endIfTerminal.
      const suggestion = pickAiMoveOrFallback(game, setup.aiLevel);
      if (!suggestion) { endIfTerminal("ai", moveCount); return; }

      const aiMove = game.move(suggestion);
      const aiFen = game.fen();
      setFen(aiFen);
      setLastMove(suggestion);
      dispatchMoveHaptic(aiMove?.flags, game.isCheck(), game.isCheckmate());
      const aiTerminal = endIfTerminal("ai", moveCount);
      debugMiniArena("AI move", { from: suggestion.from, to: suggestion.to, fen: aiFen, terminal: aiTerminal });
      if (!aiTerminal) setStatus("playing");
    }, 250);
  }

  function selectSquare(square: string) {
    if (status !== "playing") return;
    const game = gameRef.current;
    const piece = game.get(square as Square);

    if (piece && piece.color === "w") {
      hapticTap();
      setSelectedSquare(square);
      const moves = game.moves({ square: square as Square, verbose: true });
      setLegalMoves(moves.map((m) => m.to));
      return;
    }

    if (selectedSquare && legalMoves.includes(square)) {
      const movingPiece = game.get(selectedSquare as Square);
      const promo =
        movingPiece?.type === "p" && Number(square[1]) === 8 ? "q" : undefined;
      const move = game.move({ from: selectedSquare, to: square, promotion: promo });
      const san = move?.san;
      const afterFen = game.fen();
      const nextMoveCount = moveCount + 1;

      debugMiniArena("player move committed", {
        from: selectedSquare,
        to: square,
        san,
        fen: afterFen,
        moveCount,
        nextMoveCount,
      });

      setFen(afterFen);
      setLastMove({ from: selectedSquare, to: square });
      setMoveCount(nextMoveCount);
      setSelectedSquare(null);
      setLegalMoves([]);
      dispatchMoveHaptic(move?.flags, game.isCheck(), game.isCheckmate());

      debugMiniArena("after player move, before terminal check", {
        fen: game.fen(),
        turn: game.turn(),
        isCheckmate: game.isCheckmate(),
        isStalemate: game.isStalemate(),
        isDraw: game.isDraw(),
        isInsufficientMaterial: game.isInsufficientMaterial(),
        moveCount,
        nextMoveCount,
      });

      if (endIfTerminal("player", nextMoveCount)) {
        return;
      }

      triggerAi();
      return;
    }

    if (selectedSquare) {
      hapticReject();
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
      setRejectingSquare(selectedSquare);
      rejectTimerRef.current = setTimeout(() => {
        setRejectingSquare(null);
        rejectTimerRef.current = null;
      }, REJECT_SHAKE_MS);
    }
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    debugMiniArena("handleOpenChange", { nextOpen, currentOpen: open, stack: new Error().stack });
    if (!nextOpen) {
      setShareOpen(false);
      debugMiniArena("clear terminalResult", { source: "handleOpenChange(close)" });
      dismissedTerminalRef.current = true;
      setTerminalResult(null);
    }
    onOpenChange(nextOpen);
  }

  function handleShareOpen() {
    setShareOpen(true);
  }

  function reset() {
    debugMiniArena("reset");
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    initializeGame("retry/reset");
  }

  const isWithinPar = moveCount <= setup.parMoves;
  const footerStatus =
    status === "won"
      ? isWithinPar
        ? `Mate in ${moveCount}. Target reached!`
        : `Mate in ${moveCount}. Try again under ${setup.parMoves}.`
      : status === "drawn"
        ? "Draw. Keep the king at the edge!"
        : status === "thinking"
          ? "Thinking…"
          : `Moves: ${moveCount} / ${setup.parMoves}`;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          data-testid="mini-arena-sheet"
          className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
        >
          <MissionHeaderCandy
              title={setup.name}
              subtitle="Special Training"
              icon="trophy"
              objective={setup.description}
            />

            <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
              <div className="w-full max-w-[360px]">
                <ArenaBoard
                  pieces={pieces}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  rejectingSquare={rejectingSquare}
                  isLocked={status !== "playing"}
                  isThinking={status === "thinking"}
                  onSquareClick={selectSquare}
                  playerColor="w"
                />
              </div>
            </div>

            <div className="flex flex-col shrink-0 px-5 pb-4 pt-2 gap-2">
            {status === "playing" ? (
              <>
                <div
                  className="flex items-center justify-between gap-3 w-full"
                  style={{ color: "rgba(63, 34, 8, 0.95)" }}
                >
                  <div className="flex-1 flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.45)] bg-white/20 py-1.5 px-3 shadow-sm min-w-0">
                    <CandyIcon name="move" className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <p data-testid="mini-arena-status" className="text-[0.8rem] font-extrabold uppercase tracking-tight truncate">
                      {footerStatus}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleShareOpen}
                  className="text-xs font-semibold underline underline-offset-2 self-center"
                  style={{ color: "rgba(110, 65, 15, 0.50)" }}
                >
                  {ENDGAME_SHARE_COPY.shareChallenge}
                </button>
              </>
            ) : status === "thinking" ? (
              <div
                className="flex items-center gap-3 w-full"
                style={{ color: "rgba(63, 34, 8, 0.95)" }}
              >
                <div className="flex-1 flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.45)] bg-white/20 py-1.5 px-3 shadow-sm min-w-0">
                  <CandyIcon name="move" className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <p data-testid="mini-arena-status" className="text-[0.8rem] font-extrabold uppercase tracking-tight truncate">
                    {footerStatus}
                  </p>
                </div>
              </div>
            ) : !terminalResult && (
              <div className="flex items-center justify-end gap-2 w-full">
                {status === "won" && (
                  <button
                    type="button"
                    onClick={handleShareOpen}
                    className="rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-md active:scale-95 transition-transform"
                    style={{
                      background: "rgba(110, 65, 15, 0.15)",
                      color: "rgba(63, 34, 8, 0.95)",
                      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35)",
                    }}
                  >
                    {ENDGAME_SHARE_COPY.shareResult}
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-md active:scale-95 transition-transform"
                  style={{
                    background: "rgba(63, 34, 8, 0.92)",
                    color: "rgba(255, 245, 215, 0.98)",
                    boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.2)",
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
          {terminalResult ? (
            <MiniArenaResultCeremony
              terminalResult={terminalResult}
              parMoves={setup.parMoves}
              onShare={handleShareOpen}
              onRetry={reset}
              onClose={() => {
                debugMiniArena("clear terminalResult", { source: "ceremony onClose" });
                dismissedTerminalRef.current = true;
                setTerminalResult(null);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {shareOpen && (
        <ShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          cardUrl={
            status === "won"
              ? `${shareBaseUrl}&solved=true&moves=${moveCount}&limit=${setup.parMoves}`
              : shareBaseUrl
          }
          text={
            status === "won"
              ? ENDGAME_SHARE_COPY.ctaSolved(moveCount, setup.parMoves)
              : ENDGAME_SHARE_COPY.ctaChallenge
          }
          title={status === "won" ? ENDGAME_SHARE_COPY.shareResult : ENDGAME_SHARE_COPY.shareChallenge}
        />
      )}

      {DEBUG_MINI_ARENA ? (
        <div
          data-testid="mini-arena-debug-state"
          style={{
            position: "fixed",
            bottom: 72,
            right: 8,
            zIndex: 99999,
            maxWidth: 320,
            fontSize: 10,
            background: "rgba(0,0,0,.75)",
            color: "white",
            padding: 6,
            borderRadius: 6,
            pointerEvents: "none",
          }}
        >
          {JSON.stringify({
            open,
            status,
            hasTerminalResult: terminalResult !== null,
            moveCount,
            fen,
          })}
        </div>
      ) : null}
    </>
  );
}
