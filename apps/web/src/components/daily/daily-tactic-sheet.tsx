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
import { MissionHeaderCandy } from "@/components/exercises/mission-header-candy";
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
        <MissionHeaderCandy
          title="Daily Tactic"
          subtitle={puzzle.name}
          icon="coach"
          objective="White to move · Mate in one"
        />

        <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
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
          className="shrink-0 px-5 pb-4 pt-2 text-center"
          style={{ color: "rgba(63, 34, 8, 0.95)" }}
        >
          {status === "solved" ? (
            <div className="flex items-center justify-center gap-2 rounded-full border border-[rgba(255,255,255,0.45)] bg-white/20 py-2 px-4 shadow-sm">
              <CandyIcon name="star" className="h-4 w-4" />
              <p className="text-sm font-extrabold uppercase tracking-tight" data-testid="daily-status-solved">
                Solved! Streak banked
              </p>
            </div>
          ) : showHint ? (
            <div className="rounded-xl border border-[rgba(110,65,15,0.20)] bg-[rgba(110,65,15,0.05)] p-3 text-xs leading-tight shadow-inner">
              <span className="font-extrabold uppercase opacity-60 block mb-1">Hint</span>
              {puzzle.hint}
            </div>
          ) : (
            <p className="text-xs font-bold opacity-60 uppercase tracking-widest">
              Find the move
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
