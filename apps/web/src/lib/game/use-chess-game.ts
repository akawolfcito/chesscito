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
  const gameEndRef = useRef<number>(0);

  const gameRef = useRef(new Chess());
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fen, setFen] = useState(gameRef.current.fen());
  /** square -> stable piece id, used to keep React keys consistent as pieces
   *  re-sort between renders. Persists across games (ids are opaque). */
  const pieceIdsRef = useRef<Map<string, string>>(new Map());
  const pieceCounterRef = useRef(0);

  /** Snapshot end time and set terminal status (prevents elapsedMs race with reset) */
  function endGameWith(s: ArenaStatus) {
    gameEndRef.current = Date.now();
    setStatus(s);
  }

  const pieces = useMemo<ChessBoardPiece[]>(() => {
    const raw = fenToPieces(fen);
    const prev = pieceIdsRef.current;
    const next = new Map<string, string>();

    // Map of newSquare -> oldSquare for pieces that relocated this turn.
    // Covers the plain move plus the rook side of a castle (chess.js reports
    // only the king's from/to in lastMove, so we reconstruct the rook hop
    // from the king's two-square lateral jump).
    const moveMap = new Map<string, string>();
    if (lastMove) {
      moveMap.set(lastMove.to, lastMove.from);
      const fileFrom = lastMove.from.charCodeAt(0);
      const fileTo = lastMove.to.charCodeAt(0);
      const rank = lastMove.from[1];
      if (rank === lastMove.to[1] && Math.abs(fileTo - fileFrom) === 2) {
        const mover = raw.find((p) => p.square === lastMove.to);
        if (mover?.type === "king") {
          const kingside = fileTo > fileFrom;
          moveMap.set(
            (kingside ? "f" : "d") + rank,
            (kingside ? "h" : "a") + rank,
          );
        }
      }
    }

    const withIds: ChessBoardPiece[] = raw.map((p) => {
      const sourceSq = moveMap.get(p.square) ?? p.square;
      let id = prev.get(sourceSq);
      if (!id) {
        pieceCounterRef.current += 1;
        id = `${p.color}-${p.type}-${pieceCounterRef.current}`;
      }
      next.set(p.square, id);
      return { ...p, id };
    });

    pieceIdsRef.current = next;
    return withIds;
  // lastMove is set in the same render as fen, so memoizing on fen alone
  // would still capture the current lastMove via closure — include it for
  // correctness under future render orderings.
  }, [fen, lastMove]);

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
      const start = gameStartRef.current;
      const end = gameEndRef.current;
      setElapsedMs(start > 0 && end > 0 ? end - start : 0);
    }
  }, [status]);

  // Live-tick elapsedMs once per second while playing so the HUD timer
  // reflects real duration. The end-game effect above overrides the final
  // value on terminal status, so sign-victory / stats see the definitive
  // snapshot rather than the last tick.
  useEffect(() => {
    if (status !== "playing") return;
    if (!gameStartRef.current) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - gameStartRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const triggerAiMove = useCallback((currentDifficulty: ArenaDifficulty) => {
    const game = gameRef.current;
    if (game.turn() !== "b") return;

    setIsThinking(true);

    // Use setTimeout to yield to the UI before computing
    aiTimeoutRef.current = setTimeout(() => {
      aiTimeoutRef.current = null;
      if (game.isGameOver()) { setIsThinking(false); return; }
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

        if (game.isCheckmate()) endGameWith("checkmate");
        else if (game.isStalemate()) endGameWith("stalemate");
        else if (game.isDraw()) endGameWith("draw");
      } catch (err) {
        console.error("AI move error:", err);
        setIsThinking(false);
        setErrorMessage("Engine error — please restart the match");
      }
    }, 50);
  }, []);

  const selectSquare = useCallback((square: string) => {
    try {
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
        const movingPiece = game.get(selectedSquare as Square);
        const targetRank = Number(square[1]);
        const isPromotion = movingPiece?.type === "p" &&
          ((movingPiece.color === "w" && targetRank === 8) ||
           (movingPiece.color === "b" && targetRank === 1));
        if (isPromotion) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        game.move({ from: selectedSquare, to: square });
        setFen(game.fen());
        setLastMove({ from: selectedSquare, to: square });
        setMoveCount(c => c + 1);
        setMoveHistory(game.history());
        setSelectedSquare(null);
        setLegalMoves([]);

        if (game.isCheckmate()) endGameWith("checkmate");
        else if (game.isStalemate()) endGameWith("stalemate");
        else if (game.isDraw()) endGameWith("draw");
        else triggerAiMove(difficulty);
        return;
      }

      // Deselect
      setSelectedSquare(null);
      setLegalMoves([]);
    } catch (err) {
      console.error("selectSquare error:", err);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [status, isThinking, selectedSquare, legalMoves, triggerAiMove, difficulty]);

  const promoteWith = useCallback((piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion || isThinking) return;
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

      if (game.isCheckmate()) endGameWith("checkmate");
      else if (game.isStalemate()) endGameWith("stalemate");
      else if (game.isDraw()) endGameWith("draw");
      else triggerAiMove(difficulty);
    } catch {
      setPendingPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [pendingPromotion, isThinking, triggerAiMove, difficulty]);

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
    if (aiTimeoutRef.current) { clearTimeout(aiTimeoutRef.current); aiTimeoutRef.current = null; }
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
    gameEndRef.current = 0;
    setStatus("selecting");
  }, []);

  const resign = useCallback(() => {
    if (aiTimeoutRef.current) { clearTimeout(aiTimeoutRef.current); aiTimeoutRef.current = null; }
    endGameWith("resigned");
    setIsThinking(false);
  }, []);

  const startGame = useCallback(() => {
    if (aiTimeoutRef.current) { clearTimeout(aiTimeoutRef.current); aiTimeoutRef.current = null; }
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
    gameEndRef.current = 0;
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
