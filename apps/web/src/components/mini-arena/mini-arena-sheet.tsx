"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { aiMove } from "js-chess-engine";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArenaBoard } from "@/components/arena/arena-board";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { fenToPieces } from "@/lib/game/arena-utils";
import {
  hapticImpact,
  hapticReject,
  hapticSuccess,
  hapticTap,
} from "@/lib/haptics";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";
import type { ChessBoardPiece } from "@/lib/game/types";

type Status = "playing" | "won" | "drawn" | "thinking";

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

function dispatchMoveHaptic(flags: string | undefined, isCheck: boolean, isMate: boolean) {
  if (isMate) { hapticImpact(); return; }
  if (isCheck) { hapticSuccess(); return; }
  if (flags && (flags.includes("c") || flags.includes("e"))) { hapticImpact(); return; }
  hapticTap();
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
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winFiredRef = useRef(false);

  // Re-init on open with a fresh FEN. Keeps the sheet self-contained.
  useEffect(() => {
    if (!open) return;
    gameRef.current = new Chess(setup.fen);
    setFen(setup.fen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setRejectingSquare(null);
    setStatus("playing");
    setMoveCount(0);
    setLastMove(null);
    winFiredRef.current = false;
  }, [open, setup.fen]);

  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
    };
  }, []);

  const pieces = useMemo<ChessBoardPiece[]>(() => {
    return fenToPieces(fen).map((p, i) => ({
      ...p,
      id: `${p.color}-${p.type}-${p.square}-${i}`,
    }));
  }, [fen]);

  const checkSquare = useMemo(() => {
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
  }, [fen]);

  function endIfTerminal(): boolean {
    const game = gameRef.current;
    if (game.isCheckmate()) {
      const playerWon = game.turn() === "b"; // black to move = white delivered mate
      setStatus(playerWon ? "won" : "drawn");
      if (playerWon && !winFiredRef.current) {
        winFiredRef.current = true;
        onWin?.(moveCount + 1);
      }
      return true;
    }
    if (game.isStalemate() || game.isDraw() || game.isInsufficientMaterial()) {
      setStatus("drawn");
      return true;
    }
    return false;
  }

  function triggerAi() {
    setStatus("thinking");
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      const game = gameRef.current;
      if (game.isGameOver()) { endIfTerminal(); return; }
      try {
        const result = aiMove(game.fen(), setup.aiLevel);
        const entries = Object.entries(result);
        if (entries.length === 0) { setStatus("drawn"); return; }
        const [fromUpper, toUpper] = entries[0];
        const from = fromUpper.toLowerCase();
        const to = toUpper.toLowerCase();
        const move = game.move({ from, to });
        setFen(game.fen());
        setLastMove({ from, to });
        dispatchMoveHaptic(move?.flags, game.isCheck(), game.isCheckmate());
        if (!endIfTerminal()) setStatus("playing");
      } catch {
        setStatus("playing");
      }
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
      setFen(game.fen());
      setLastMove({ from: selectedSquare, to: square });
      setMoveCount((n) => n + 1);
      setSelectedSquare(null);
      setLegalMoves([]);
      dispatchMoveHaptic(move?.flags, game.isCheck(), game.isCheckmate());
      if (!endIfTerminal()) triggerAi();
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

  function reset() {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    gameRef.current = new Chess(setup.fen);
    setFen(setup.fen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setRejectingSquare(null);
    setStatus("playing");
    setMoveCount(0);
    setLastMove(null);
    winFiredRef.current = false;
  }

  const isWithinPar = moveCount <= setup.parMoves;
  const footerCopy =
    status === "won"
      ? isWithinPar
        ? `Mate en ${moveCount} jugadas. Dentro del objetivo (${setup.parMoves}).`
        : `Mate en ${moveCount} jugadas. Vuelve a intentarlo bajo ${setup.parMoves}.`
      : status === "drawn"
        ? "Tablas. La técnica del rey al borde es la clave — vuelve a intentarlo."
        : status === "thinking"
          ? "Pensando…"
          : `Movimientos: ${moveCount} / ${setup.parMoves}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-testid="mini-arena-sheet"
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="shrink-0 border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-none px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title flex items-center gap-2"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              <CandyIcon name="trophy" className="h-5 w-5" />
              {setup.name}
            </SheetTitle>
            <SheetDescription
              className="text-sm font-bold"
              style={{ color: "rgba(63, 34, 8, 0.85)" }}
            >
              {setup.description}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3">
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

        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-2 text-sm"
          style={{ color: "rgba(63, 34, 8, 0.95)" }}
        >
          <p data-testid="mini-arena-status" className="flex-1">
            {footerCopy}
          </p>
          {status !== "playing" && (
            <button
              type="button"
              onClick={reset}
              className="rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide"
              style={{
                background: "rgba(63, 34, 8, 0.85)",
                color: "rgba(255, 245, 215, 0.98)",
                boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.18)",
              }}
            >
              Reintentar
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
