"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
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
import { isPuzzleSolution, type DailyPuzzle } from "@/lib/daily/puzzles";
import type { ChessBoardPiece } from "@/lib/game/types";

type Status = "solving" | "solved" | "resetting";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puzzle: DailyPuzzle;
  /** Fired the first time the player produces the correct move. The
   *  parent should record completion + bump the streak; the sheet
   *  auto-closes ~1.8s later so the celebration is visible. */
  onSolve: () => void;
};

const SOLVE_AUTO_CLOSE_MS = 1800;
const REJECT_SHAKE_MS = 220;
const RESET_AFTER_MS = 360;

export function DailyTacticSheet({ open, onOpenChange, puzzle, onSolve }: Props) {
  const gameRef = useRef(new Chess(puzzle.fen));
  const [fen, setFen] = useState(puzzle.fen);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [rejectingSquare, setRejectingSquare] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("solving");
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Re)load the puzzle every time the sheet opens. Keeps the board fresh
  // even if the parent kept the component mounted between sessions.
  useEffect(() => {
    if (!open) return;
    gameRef.current = new Chess(puzzle.fen);
    setFen(puzzle.fen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setRejectingSquare(null);
    setStatus("solving");
    setShowHint(false);
    setAttempts(0);
  }, [open, puzzle.fen]);

  // Cancel pending timers on unmount so a late reset never bleeds into a
  // freshly opened sheet.
  useEffect(() => {
    return () => {
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const pieces = useMemo<ChessBoardPiece[]>(() => {
    return fenToPieces(fen).map((p, i) => ({
      ...p,
      id: `${p.color}-${p.type}-${p.square}-${i}`,
    }));
  }, [fen]);

  function selectSquare(square: string) {
    if (status !== "solving") return;
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
      const isCorrect = isPuzzleSolution(
        puzzle,
        selectedSquare,
        square,
        puzzle.solution.promotion,
      );

      if (isCorrect) {
        game.move({
          from: selectedSquare,
          to: square,
          promotion: puzzle.solution.promotion,
        });
        setFen(game.fen());
        setSelectedSquare(null);
        setLegalMoves([]);
        setStatus("solved");
        hapticSuccess();
        hapticImpact();
        onSolve();
        closeTimerRef.current = setTimeout(() => {
          onOpenChange(false);
        }, SOLVE_AUTO_CLOSE_MS);
        return;
      }

      // Wrong move — shake the source piece, lock the board briefly,
      // then reset to the starting position so the player can retry
      // with the hint visible.
      hapticReject();
      setAttempts((n) => n + 1);
      setRejectingSquare(selectedSquare);
      setStatus("resetting");
      setSelectedSquare(null);
      setLegalMoves([]);

      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
      rejectTimerRef.current = setTimeout(() => {
        setRejectingSquare(null);
        rejectTimerRef.current = null;
      }, REJECT_SHAKE_MS);

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        gameRef.current = new Chess(puzzle.fen);
        setFen(puzzle.fen);
        setShowHint(true);
        setStatus("solving");
        resetTimerRef.current = null;
      }, RESET_AFTER_MS);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-testid="daily-tactic-sheet"
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
              <CandyIcon name="coach" className="h-5 w-5" />
              Daily Tactic
            </SheetTitle>
            <SheetDescription
              className="text-sm font-bold"
              style={{ color: "rgba(63, 34, 8, 0.85)" }}
            >
              {puzzle.name} — White to move, mate in one.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3">
          <div className="w-full max-w-[360px]">
            <ArenaBoard
              pieces={pieces}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
              lastMove={null}
              checkSquare={null}
              rejectingSquare={rejectingSquare}
              isLocked={status !== "solving"}
              onSquareClick={selectSquare}
              playerColor="w"
            />
          </div>
        </div>

        <div
          className="shrink-0 px-5 pb-3 pt-2 text-center text-sm"
          style={{ color: "rgba(63, 34, 8, 0.95)" }}
        >
          {status === "solved" ? (
            <p className="font-extrabold" data-testid="daily-status-solved">
              Solved! Streak banked.
            </p>
          ) : showHint ? (
            <p data-testid="daily-hint">
              <span className="font-extrabold">Hint:</span> {puzzle.hint}
            </p>
          ) : attempts === 0 ? (
            <p className="opacity-80">Find the move that delivers checkmate.</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
