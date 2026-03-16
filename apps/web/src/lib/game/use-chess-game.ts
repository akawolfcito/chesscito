"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { ArenaDifficulty, ArenaStatus, ChessBoardPiece } from "./types";
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

  const gameRef = useRef(new Chess());
  const workerRef = useRef<Worker | null>(null);
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

  const handleAiMove = useCallback((moveStr: string) => {
    const game = gameRef.current;
    const from = moveStr.slice(0, 2);
    const to = moveStr.slice(2, 4);
    const promotion = moveStr.length > 4 ? moveStr[4] as "q" | "r" | "b" | "n" : undefined;

    try {
      game.move({ from, to, promotion });
      setFen(game.fen());
      setLastMove({ from, to });
      setIsThinking(false);

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

  // Initialize worker once when status enters "loading".
  // We use a ref to track whether we've already spawned a worker so the
  // effect can depend on [status] without killing the worker when status
  // transitions from "loading" → "playing".
  const workerSpawnedRef = useRef(false);

  useEffect(() => {
    if (status !== "loading" || workerSpawnedRef.current) return;
    workerSpawnedRef.current = true;

    const worker = new Worker(
      new URL("./arena-worker.ts", import.meta.url),
      { type: "module" }
    );

    // Timeout: if engine doesn't become ready in 15s, show error
    const loadTimeout = setTimeout(() => {
      if (!workerRef.current) {
        worker.terminate();
        workerSpawnedRef.current = false;
        setErrorMessage("Your browser doesn't support the AI engine");
        setStatus("selecting");
      }
    }, 15_000);

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case "ready":
          clearTimeout(loadTimeout);
          workerRef.current = worker;
          setStatus("playing");
          break;
        case "bestmove":
          handleAiMove(msg.move);
          break;
        case "error":
          console.error("Stockfish error:", msg.message);
          setIsThinking(false);
          setErrorMessage(msg.message);
          // If still loading (engine init failed), go back to selector
          setStatus((prev) => prev === "loading" ? "selecting" : prev);
          break;
      }
    };

    worker.onerror = (err) => {
      console.error("Worker crashed", err);
      clearTimeout(loadTimeout);
      worker.terminate();
      workerSpawnedRef.current = false;
      setIsThinking(false);
      setErrorMessage("AI disconnected");
      setStatus("selecting");
    };

    worker.postMessage({ type: "init" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Cleanup worker on unmount only
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      workerSpawnedRef.current = false;
    };
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
      // Check for pawn promotion
      const movingPiece = game.get(selectedSquare as Square);
      const targetRank = Number(square[1]);
      if (movingPiece?.type === "p" && targetRank === 8) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      try {
        game.move({ from: selectedSquare, to: square });
        setFen(game.fen());
        setLastMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setLegalMoves([]);

        if (game.isCheckmate()) setStatus("checkmate");
        else if (game.isStalemate()) setStatus("stalemate");
        else if (game.isDraw()) setStatus("draw");
        else triggerAiMove();
      } catch {
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
    // Terminate old worker so a fresh one is created on next startGame
    workerRef.current?.terminate();
    workerRef.current = null;
    workerSpawnedRef.current = false;
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setIsThinking(false);
    setErrorMessage(null);
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
