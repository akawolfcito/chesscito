"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { aiMove } from "js-chess-engine";
import type { ArenaDifficulty, ArenaStatus, ChessBoardPiece } from "./types";
import { fenToPieces } from "./arena-utils";

const DIFFICULTY_LEVEL: Record<ArenaDifficulty, number> = {
  easy: 1,
  medium: 3,
  hard: 5,
};

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
  moveCount: number;
  moveHistory: string[];
  elapsedMs: number;
  errorMessage: string | null;
  selectSquare: (square: string) => void;
  promoteWith: (piece: "q" | "r" | "b" | "n") => void;
  cancelPromotion: () => void;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const gameStartRef = useRef<number>(0);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());

  const pieces = useMemo(() => fenToPieces(fen), [fen]);

  const checkSquare = useMemo(() => {
    const game = gameRef.current;
    if (!game.isCheck()) return null;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  useEffect(() => {
    if (status === "checkmate" || status === "stalemate" || status === "draw" || status === "resigned") {
      setElapsedMs(gameStartRef.current > 0 ? Date.now() - gameStartRef.current : 0);
    }
  }, [status]);

  const triggerAiMove = useCallback((currentDifficulty: ArenaDifficulty) => {
    const game = gameRef.current;
    if (game.turn() !== "b") return;

    setIsThinking(true);

    // Use setTimeout to yield to the UI before computing
    setTimeout(() => {
      try {
        const result = aiMove(game.fen(), DIFFICULTY_LEVEL[currentDifficulty]);
        const entries = Object.entries(result);
        if (entries.length === 0) {
          setIsThinking(false);
          return;
        }

        const [fromUpper, toUpper] = entries[0];
        const from = fromUpper.toLowerCase();
        const to = toUpper.toLowerCase();

        // Detect AI pawn promotion
        const movingPiece = game.get(from as Square);
        const targetRank = Number(to[1]);
        const isPromotion = movingPiece?.type === "p" &&
          ((movingPiece.color === "w" && targetRank === 8) ||
           (movingPiece.color === "b" && targetRank === 1));

        game.move({ from, to, promotion: isPromotion ? "q" : undefined });
        setFen(game.fen());
        setLastMove({ from, to });
        setMoveCount(c => c + 1);
        setMoveHistory(game.history());
        setIsThinking(false);

        if (game.isCheckmate()) setStatus("checkmate");
        else if (game.isStalemate()) setStatus("stalemate");
        else if (game.isDraw()) setStatus("draw");
      } catch (err) {
        console.error("AI move error:", err);
        setIsThinking(false);
      }
    }, 50);
  }, []);

  const selectSquare = useCallback((square: string) => {
    const game = gameRef.current;
    if (status !== "playing" || isThinking || game.turn() !== "w") return;

    const piece = game.get(square as Square);

    // Clicking own piece → select and show legal moves
    if (piece && piece.color === "w") {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as Square, verbose: true });
      setLegalMoves(moves.map((m) => m.to));
      return;
    }

    // Clicking a legal move target
    if (selectedSquare && legalMoves.includes(square)) {
      // Check for pawn promotion (rank 8 for white, rank 1 for black)
      const movingPiece = game.get(selectedSquare as Square);
      const targetRank = Number(square[1]);
      const isPromotion = movingPiece?.type === "p" &&
        ((movingPiece.color === "w" && targetRank === 8) ||
         (movingPiece.color === "b" && targetRank === 1));
      if (isPromotion) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      try {
        game.move({ from: selectedSquare, to: square });
        setFen(game.fen());
        setLastMove({ from: selectedSquare, to: square });
        setMoveCount(c => c + 1);
        setMoveHistory(game.history());
        setSelectedSquare(null);
        setLegalMoves([]);

        if (game.isCheckmate()) setStatus("checkmate");
        else if (game.isStalemate()) setStatus("stalemate");
        else if (game.isDraw()) setStatus("draw");
        else triggerAiMove(difficulty);
      } catch {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return;
    }

    // Deselect
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [status, isThinking, selectedSquare, legalMoves, triggerAiMove, difficulty]);

  const promoteWith = useCallback((piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    const game = gameRef.current;

    try {
      game.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
      setFen(game.fen());
      setLastMove({ from: pendingPromotion.from, to: pendingPromotion.to });
      setMoveCount(c => c + 1);
      setMoveHistory(game.history());
      setPendingPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);

      if (game.isCheckmate()) setStatus("checkmate");
      else if (game.isStalemate()) setStatus("stalemate");
      else if (game.isDraw()) setStatus("draw");
      else triggerAiMove(difficulty);
    } catch {
      setPendingPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [pendingPromotion, triggerAiMove, difficulty]);

  const cancelPromotion = useCallback(() => {
    if (!pendingPromotion) return;
    setPendingPromotion(null);
    setSelectedSquare(pendingPromotion.from);
    // Re-show legal moves for the pawn
    const game = gameRef.current;
    const moves = game.moves({ square: pendingPromotion.from as Square, verbose: true });
    setLegalMoves(moves.map((m) => m.to));
  }, [pendingPromotion]);

  const reset = useCallback(() => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setIsThinking(false);
    setErrorMessage(null);
    setMoveCount(0);
    setMoveHistory([]);
    setElapsedMs(0);
    gameStartRef.current = 0;
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
    setErrorMessage(null);
    setMoveCount(0);
    setMoveHistory([]);
    setElapsedMs(0);
    gameStartRef.current = Date.now();
    setStatus("playing");
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
    moveCount,
    moveHistory,
    elapsedMs,
    errorMessage,
    selectSquare,
    promoteWith,
    cancelPromotion,
    reset,
    resign,
    setDifficulty,
    startGame,
  };
}
