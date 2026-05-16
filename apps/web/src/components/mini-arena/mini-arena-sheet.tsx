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
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [completionStars, setCompletionStars] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [previousBest, setPreviousBest] = useState<number | null>(null);

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
    setShowResultOverlay(false);
    setCompletionStars(0);
    setIsNewBest(false);
    setPreviousBest(null);
  }, [open, setup.fen]);

  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
    };
  }, []);

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

  function endIfTerminal(): boolean {
    const game = gameRef.current;
    if (game.isCheckmate()) {
      const playerWon = game.turn() === "b"; // black to move = white delivered mate
      setStatus(playerWon ? "won" : "drawn");
      if (playerWon && !winFiredRef.current) {
        winFiredRef.current = true;
        const totalMoves = moveCount + 1;
        onWin?.(totalMoves);

        const stars = endgameStars(totalMoves, setup.parMoves);
        const prev = getMiniArenaBest(setup.id);
        const newBest = recordMiniArenaBest(setup.id, totalMoves);
        setCompletionStars(stars);
        setIsNewBest(newBest);
        setPreviousBest(prev);
      }
      setShowResultOverlay(true);
      return true;
    }
    if (game.isStalemate() || game.isDraw() || game.isInsufficientMaterial()) {
      setStatus("drawn");
      setShowResultOverlay(true);
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

      // pickAiMoveOrFallback never returns an illegal move and never
      // hangs on engine misbehavior — see lib/game/mini-arena-ai.ts.
      // null = no legal moves left → resolve via endIfTerminal.
      const suggestion = pickAiMoveOrFallback(game, setup.aiLevel);
      if (!suggestion) { endIfTerminal(); return; }

      const move = game.move(suggestion);
      setFen(game.fen());
      setLastMove(suggestion);
      dispatchMoveHaptic(move?.flags, game.isCheck(), game.isCheckmate());
      if (!endIfTerminal()) setStatus("playing");
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

  function handleShareOpen() {
    setShareOpen(true);
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
    setShowResultOverlay(false);
    setCompletionStars(0);
    setIsNewBest(false);
    setPreviousBest(null);
    setShareOpen(false);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
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
          <div
            className="flex items-center justify-between gap-3 w-full"
            style={{ color: "rgba(63, 34, 8, 0.95)" }}
          >
            <div className="flex-1 flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.45)] bg-white/20 py-1.5 px-3 shadow-sm min-w-0">
              <CandyIcon name={status === "won" ? "star" : "move"} className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <p data-testid="mini-arena-status" className="text-[0.8rem] font-extrabold uppercase tracking-tight truncate">
                {footerStatus}
              </p>
            </div>
            {status !== "playing" && (
              <div className="flex items-center gap-2 shrink-0">
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
          {status === "playing" && (
            <button
              type="button"
              onClick={handleShareOpen}
              className="text-xs font-semibold underline underline-offset-2 self-center"
              style={{ color: "rgba(110, 65, 15, 0.50)" }}
            >
              {ENDGAME_SHARE_COPY.shareChallenge}
            </button>
          )}
        </div>
      </SheetContent>

      {showResultOverlay && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-250"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={() => setShowResultOverlay(false)}
        >
          <div
            className="relative w-full max-w-xs rounded-2xl p-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-400"
            style={{
              background: "linear-gradient(180deg, #FEF7E6 0%, #F8E8C8 100%)",
              boxShadow:
                "0 8px 32px rgba(63, 34, 8, 0.25), inset 0 1px 0 rgba(255, 245, 215, 0.9)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowResultOverlay(false)}
              className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full text-sm"
              style={{ color: "rgba(110, 65, 15, 0.5)" }}
              aria-label="Close"
            >
              ✕
            </button>

            {status === "won" ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative flex items-center justify-center">
                  <div
                    className="absolute h-20 w-20 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(217, 180, 74, 0.14) 50%, transparent 75%)",
                    }}
                  />
                  <CandyIcon name="trophy" className="relative h-12 w-12" />
                </div>

                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <CandyIcon
                      key={i}
                      name="star"
                      className="h-6 w-6"
                      style={{
                        opacity: i < completionStars ? 1 : 0.25,
                        filter:
                          i < completionStars
                            ? "drop-shadow(0 0 4px rgba(245, 158, 11, 0.55))"
                            : "none",
                      }}
                    />
                  ))}
                </div>

                <p
                  className="text-sm font-extrabold"
                  style={{
                    color: "rgba(63, 34, 8, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                  }}
                >
                  Checkmate in {moveCount} moves
                </p>

                {completionStars === 3 && (
                  <p
                    className="text-xs"
                    style={{ color: "rgba(110, 65, 15, 0.75)" }}
                  >
                    ★ Perfect path
                  </p>
                )}

                {isNewBest ? (
                  <p
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.10em]"
                    style={{
                      background: "rgba(245, 158, 11, 0.85)",
                      color: "rgba(63, 34, 8, 0.95)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                      boxShadow:
                        "0 0 12px rgba(245, 158, 11, 0.55), inset 0 1px 0 rgba(255, 245, 215, 0.45)",
                    }}
                  >
                    {previousBest != null
                      ? `New best! Beat ${previousBest} → ${moveCount}`
                      : `First completion · ${moveCount} moves`}
                  </p>
                ) : previousBest != null ? (
                  <p
                    className="text-xs"
                    style={{ color: "rgba(110, 65, 15, 0.65)" }}
                  >
                    Your best: {previousBest} moves
                  </p>
                ) : null}

                <div className="flex w-full gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="flex-1 rounded-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-md active:scale-95 transition-transform"
                    style={{
                      background: "rgba(110, 65, 15, 0.15)",
                      color: "rgba(63, 34, 8, 0.95)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255, 255, 255, 0.35)",
                    }}
                  >
                    {ENDGAME_SHARE_COPY.shareResult}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-md active:scale-95 transition-transform"
                    style={{
                      background: "rgba(63, 34, 8, 0.92)",
                      color: "rgba(255, 245, 215, 0.98)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255, 245, 215, 0.2)",
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative flex items-center justify-center">
                  <div
                    className="absolute h-20 w-20 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(110, 65, 15, 0.12) 0%, transparent 70%)",
                    }}
                  />
                  <CandyIcon
                    name="move"
                    className="relative h-12 w-12 opacity-60"
                  />
                </div>

                <p
                  className="text-sm font-extrabold"
                  style={{
                    color: "rgba(63, 34, 8, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                  }}
                >
                  Draw
                </p>
                <p
                  className="text-xs"
                  style={{ color: "rgba(110, 65, 15, 0.65)" }}
                >
                  Keep the king at the edge!
                </p>

                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-md active:scale-95 transition-transform"
                  style={{
                    background: "rgba(63, 34, 8, 0.92)",
                    color: "rgba(255, 245, 215, 0.98)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255, 245, 215, 0.2)",
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
    </Sheet>
  );
}
