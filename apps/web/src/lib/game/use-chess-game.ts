"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { aiMove } from "js-chess-engine";
import type { ArenaDifficulty, ArenaStatus, ChessBoardPiece } from "./types";
import { fenToPieces } from "./arena-utils";
import { clearArenaGame, loadArenaGame, saveArenaGame } from "./arena-persistence";
import { hapticTap, hapticReject, hapticSuccess, hapticImpact } from "@/lib/haptics";

function dispatchMoveHaptic(flags: string | undefined, isCheck: boolean, isCheckmate: boolean) {
  if (isCheckmate) { hapticImpact(); return; }
  if (isCheck) { hapticSuccess(); return; }
  if (flags && (flags.includes("c") || flags.includes("e"))) { hapticImpact(); return; }
  hapticTap();
}

const DIFFICULTY_LEVEL: Record<ArenaDifficulty, number> = {
  easy: 1,
  medium: 3,
  hard: 5,
};

export type PlayerColor = "w" | "b";

export type ChessGameState = {
  fen: string;
  pieces: ChessBoardPiece[];
  status: ArenaStatus;
  isThinking: boolean;
  selectedSquare: string | null;
  legalMoves: string[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  rejectingSquare: string | null;
  pendingPromotion: { from: string; to: string } | null;
  difficulty: ArenaDifficulty;
  playerColor: PlayerColor;
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
  setPlayerColor: (c: PlayerColor) => void;
  startGame: () => void;
};

export function useChessGame(): ChessGameState {
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>("easy");
  const [playerColor, setPlayerColor] = useState<PlayerColor>("w");
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
  const [rejectingSquare, setRejectingSquare] = useState<string | null>(null);
  const gameStartRef = useRef<number>(0);
  const gameEndRef = useRef<number>(0);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    clearArenaGame();
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

  const triggerAiMove = useCallback((currentDifficulty: ArenaDifficulty, currentPlayerColor: PlayerColor) => {
    const game = gameRef.current;
    // Skip if it's the human's turn — AI only moves on the opposite color.
    if (game.turn() === currentPlayerColor) return;

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

        const moveResult = game.move({ from, to, promotion: isPromotion ? "q" : undefined });
        setFen(game.fen());
        setLastMove({ from, to });
        setMoveCount(c => c + 1);
        setMoveHistory(game.history());
        setIsThinking(false);

        const isMate = game.isCheckmate();
        dispatchMoveHaptic(moveResult?.flags, game.isCheck(), isMate);

        if (isMate) endGameWith("checkmate");
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
      if (status !== "playing" || isThinking || game.turn() !== playerColor) return;

      const piece = game.get(square as Square);

      // Clicking own piece → select and show legal moves
      if (piece && piece.color === playerColor) {
        hapticTap();
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
          hapticTap();
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        const moveResult = game.move({ from: selectedSquare, to: square });
        setFen(game.fen());
        setLastMove({ from: selectedSquare, to: square });
        setMoveCount(c => c + 1);
        setMoveHistory(game.history());
        setSelectedSquare(null);
        setLegalMoves([]);

        const isMate = game.isCheckmate();
        dispatchMoveHaptic(moveResult?.flags, game.isCheck(), isMate);

        if (isMate) endGameWith("checkmate");
        else if (game.isStalemate()) endGameWith("stalemate");
        else if (game.isDraw()) endGameWith("draw");
        else triggerAiMove(difficulty, playerColor);
        return;
      }

      // Invalid move attempt — only fire reject when the user actually had a
      // piece selected and tried an illegal target. Pure exploration clicks
      // (no selection) are silent — pedagogy without nagging.
      if (selectedSquare && status === "playing" && game.turn() === playerColor) {
        hapticReject();
        if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
        setRejectingSquare(selectedSquare);
        rejectTimerRef.current = setTimeout(() => {
          setRejectingSquare(null);
          rejectTimerRef.current = null;
        }, 220);
      }
      setSelectedSquare(null);
      setLegalMoves([]);
    } catch (err) {
      console.error("selectSquare error:", err);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [status, isThinking, selectedSquare, legalMoves, triggerAiMove, difficulty, playerColor]);

  const promoteWith = useCallback((piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion || isThinking) return;
    const game = gameRef.current;

    try {
      const moveResult = game.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
      setFen(game.fen());
      setLastMove({ from: pendingPromotion.from, to: pendingPromotion.to });
      setMoveCount(c => c + 1);
      setMoveHistory(game.history());
      setPendingPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);

      const isMate = game.isCheckmate();
      dispatchMoveHaptic(moveResult?.flags, game.isCheck(), isMate);

      if (isMate) endGameWith("checkmate");
      else if (game.isStalemate()) endGameWith("stalemate");
      else if (game.isDraw()) endGameWith("draw");
      else triggerAiMove(difficulty, playerColor);
    } catch {
      setPendingPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [pendingPromotion, isThinking, triggerAiMove, difficulty, playerColor]);

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
    if (rejectTimerRef.current) { clearTimeout(rejectTimerRef.current); rejectTimerRef.current = null; }
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
    setRejectingSquare(null);
    gameStartRef.current = 0;
    gameEndRef.current = 0;
    clearArenaGame();
    // Keep playerColor — it's a user preference, same as difficulty.
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
    clearArenaGame();
    setStatus("playing");
    // If the human picked black, white (AI) moves first.
    if (playerColor === "b") {
      triggerAiMove(difficulty, playerColor);
    }
  }, [playerColor, difficulty, triggerAiMove]);

  // Restore a saved in-progress game on mount. Runs once; if a valid
  // save exists (<24h old, parseable FEN) we rehydrate the hook into
  // status="playing" directly so the arena page skips the selector.
  // gameStartRef is adjusted so the live-tick timer continues from
  // savedElapsedMs (R10 from the red-team review). If the AI owes a
  // move on resume (save taken mid-exchange), kick it so the board
  // isn't stuck.
  useEffect(() => {
    const saved = loadArenaGame();
    if (!saved) return;
    try {
      gameRef.current = new Chess(saved.fen);
    } catch {
      clearArenaGame();
      return;
    }
    gameStartRef.current = Date.now() - saved.elapsedMs;
    gameEndRef.current = 0;
    setFen(saved.fen);
    setMoveHistory(saved.moveHistory);
    setMoveCount(saved.moveCount);
    setElapsedMs(saved.elapsedMs);
    setDifficulty(saved.difficulty);
    setPlayerColor(saved.playerColor);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setErrorMessage(null);
    setStatus("playing");
    if (
      gameRef.current.turn() !== saved.playerColor &&
      !gameRef.current.isGameOver()
    ) {
      triggerAiMove(saved.difficulty, saved.playerColor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist after every player / AI move. elapsedMs is NOT in deps so
  // the 1s live-tick doesn't trigger a save every tick (R8 from the
  // red-team review). moveHistory changes on every move already so
  // the save stays fresh.
  useEffect(() => {
    if (status !== "playing") return;
    if (moveCount === 0) return;
    saveArenaGame({
      fen,
      moveHistory,
      moveCount,
      elapsedMs,
      difficulty,
      playerColor,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, status, moveCount, difficulty, playerColor]);

  return {
    fen,
    pieces,
    status,
    isThinking,
    selectedSquare,
    legalMoves,
    lastMove,
    checkSquare,
    rejectingSquare,
    pendingPromotion,
    difficulty,
    playerColor,
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
    setPlayerColor,
    startGame,
  };
}
