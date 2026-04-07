"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { decodeEventLog } from "viem";
import { useChessGame } from "@/lib/game/use-chess-game";
import { ArenaBoard } from "@/components/arena/arena-board";
import { DifficultySelector } from "@/components/arena/difficulty-selector";
import { ArenaHud } from "@/components/arena/arena-hud";
import { PromotionOverlay } from "@/components/arena/promotion-overlay";
import { ArenaEndState, type ClaimPhase, type ShareStatus, type ClaimData } from "@/components/arena/arena-end-state";
import { ARENA_COPY } from "@/lib/content/editorial";
import { formatTime } from "@/lib/game/arena-utils";
import { mapArenaResult } from "@/lib/coach/game-result";
import { generateQuickReview } from "@/lib/coach/fallback-engine";
import { CoachLoading } from "@/components/coach/coach-loading";
import { CoachPanel } from "@/components/coach/coach-panel";
import { CoachFallback } from "@/components/coach/coach-fallback";
import { CoachPaywall } from "@/components/coach/coach-paywall";
import { CoachWelcome } from "@/components/coach/coach-welcome";
import type { CoachResponse, BasicCoachResponse, GameRecord } from "@/lib/coach/types";
import { getConfiguredChainId, getVictoryNFTAddress } from "@/lib/contracts/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import {
  ACCEPTED_TOKENS,
  DIFFICULTY_TO_CHAIN,
  VICTORY_PRICES,
  erc20Abi,
  formatUsd,
  normalizePrice,
} from "@/lib/contracts/tokens";

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

export default function ArenaPage() {
  const router = useRouter();
  const game = useChessGame();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("ready");
  const [claimStep, setClaimStep] = useState<"signing" | "confirming" | "done">("signing");
  const [claimData, setClaimData] = useState<ClaimData>({
    tokenId: null,
    claimTxHash: null,
    shareCardUrl: null,
    shareLinkUrl: null,
  });
  const [shareStatus, setShareStatus] = useState<ShareStatus>("locked");
  const [claimError, setClaimError] = useState<string | null>(null);
  const claimingRef = useRef(false);

  // Preparing state (loading between difficulty selection and game start)
  const [isPreparing, setIsPreparing] = useState(false);
  const preparingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delayed end overlay: gives the user 800ms to see the final board state
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const endOverlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coach state
  type CoachPhase = "idle" | "welcome" | "loading" | "result" | "fallback" | "paywall";
  const [coachPhase, setCoachPhase] = useState<CoachPhase>("idle");
  const [coachJobId, setCoachJobId] = useState<string | null>(null);
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);
  const [coachFallbackResponse, setCoachFallbackResponse] = useState<BasicCoachResponse | null>(null);
  const [coachCredits, setCoachCredits] = useState(0);
  const coachAbortRef = useRef<AbortController | null>(null);

  // Persist claim success so returning from share keeps context
  useEffect(() => {
    if (claimPhase === "success" && claimData.claimTxHash) {
      try {
        sessionStorage.setItem("chesscito:claim", JSON.stringify({
          phase: "success",
          tokenId: claimData.tokenId?.toString() ?? null,
          claimTxHash: claimData.claimTxHash,
          moves: game.moveCount,
          elapsedMs: game.elapsedMs,
          difficulty: game.difficulty,
        }));
      } catch { /* storage full or unavailable */ }
    }
  }, [claimPhase, claimData, game.moveCount, game.elapsedMs, game.difficulty]);

  // Restore claim success on mount (e.g., returning from WhatsApp)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("chesscito:claim");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.phase === "success") {
        setClaimPhase("success");
        setClaimData({
          tokenId: saved.tokenId ? BigInt(saved.tokenId) : null,
          claimTxHash: saved.claimTxHash,
          shareCardUrl: null,
          shareLinkUrl: null,
        });
        setShareStatus("ready");
      } else if (saved.phase === "claiming") {
        // Stale claiming state from a previous session — clear it.
        // The game resets on mount so there's no end state to show the
        // claiming overlay. Keeping stale "claiming" would be invisible
        // and block future claims.
        sessionStorage.removeItem("chesscito:claim");
      }
    } catch { /* corrupt data — ignore */ }
  }, []);

  const isEndState = ["checkmate", "stalemate", "draw", "resigned"].includes(game.status);
  const isPlayerWin = game.status === "checkmate" && game.fen.includes(" b ");

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const victoryNFTAddress = useMemo(() => getVictoryNFTAddress(chainId), [chainId]);

  const chainDifficulty = DIFFICULTY_TO_CHAIN[game.difficulty];
  const mintPriceUsd6 = VICTORY_PRICES[chainDifficulty] ?? 0n;
  const claimPriceLabel = formatUsd(mintPriceUsd6);

  const canClaim = isConnected && isCorrectChain && isPlayerWin && victoryNFTAddress != null;

  // Reset claim error when wallet reconnects — lets "Try Again" work after disconnect
  const prevConnected = useRef(isConnected);
  useEffect(() => {
    if (isConnected && !prevConnected.current && claimPhase === "error") {
      setClaimPhase("ready");
      setClaimError(null);
      claimingRef.current = false;
    }
    prevConnected.current = isConnected;
  }, [isConnected, claimPhase]);

  // Token balances for payment selection
  const { data: tokenBalances } = useReadContracts({
    contracts: ACCEPTED_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] as const : undefined,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: Boolean(address && canClaim), staleTime: 15_000 },
  });

  const selectPaymentToken = useCallback(
    (priceUsd6: bigint) => {
      if (!tokenBalances) return null;
      for (let i = 0; i < ACCEPTED_TOKENS.length; i++) {
        const t = ACCEPTED_TOKENS[i];
        const result = tokenBalances[i];
        if (result?.status !== "success") continue;
        const balance = result.result as bigint;
        const needed = normalizePrice(priceUsd6, t.decimals);
        if (balance >= needed) return t;
      }
      return null;
    },
    [tokenBalances]
  );

  const startCoachAnalysis = useCallback(async () => {
    if (!address) return;
    const gameResult = mapArenaResult(game.status, isPlayerWin);

    // Abort any previous in-flight analysis
    coachAbortRef.current?.abort();
    const controller = new AbortController();
    coachAbortRef.current = controller;
    const { signal } = controller;

    try {
      // Re-fetch credits (may have been seeded by welcome)
      const creditsRes = await fetch(`/api/coach/credits?wallet=${address}`, { signal });
      const creditsData = await creditsRes.json();
      const credits = creditsData.credits ?? 0;
      setCoachCredits(credits);

      if (credits <= 0) {
        setCoachPhase("paywall");
        return;
      }

      // Save game record then request analysis
      const gameRecord: GameRecord = {
        gameId: crypto.randomUUID(),
        moves: game.moveHistory,
        result: gameResult,
        difficulty: game.difficulty,
        totalMoves: game.moveHistory.length,
        elapsedMs: game.elapsedMs,
        timestamp: Date.now(),
      };

      await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address, game: gameRecord }),
        signal,
      });

      const analyzeRes = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: gameRecord.gameId, walletAddress: address }),
        signal,
      });
      const analyzeData = await analyzeRes.json();

      if (analyzeData.status === "ready") {
        setCoachResponse(analyzeData.response);
        setCoachCredits((c) => Math.max(0, c - 1));
        setCoachPhase("result");
      } else if (analyzeData.jobId) {
        setCoachJobId(analyzeData.jobId);
        setCoachPhase("loading");
      } else {
        // Fallback to quick review on error
        const quick = generateQuickReview({
          result: gameResult,
          difficulty: game.difficulty,
          totalMoves: game.moveHistory.length,
          elapsedMs: game.elapsedMs,
        });
        setCoachFallbackResponse(quick);
        setCoachPhase("fallback");
      }
    } catch (err) {
      if (signal.aborted) return; // Reset happened — don't update state
      const quick = generateQuickReview({
        result: gameResult,
        difficulty: game.difficulty,
        totalMoves: game.moveHistory.length,
        elapsedMs: game.elapsedMs,
      });
      setCoachFallbackResponse(quick);
      setCoachPhase("fallback");
    }
  }, [game.status, game.difficulty, game.moveHistory, game.elapsedMs, isPlayerWin, address]);

  const handleAskCoach = useCallback(() => {
    const gameResult = mapArenaResult(game.status, isPlayerWin);

    // No wallet → free quick review
    if (!isConnected || !address) {
      const quick = generateQuickReview({
        result: gameResult,
        difficulty: game.difficulty,
        totalMoves: game.moveHistory.length,
        elapsedMs: game.elapsedMs,
      });
      setCoachFallbackResponse(quick);
      setCoachPhase("fallback");
      return;
    }

    // First time → show welcome
    try {
      const welcomed = localStorage.getItem("chesscito:coach-welcomed");
      if (!welcomed) {
        setCoachPhase("welcome");
        return;
      }
    } catch { /* localStorage unavailable */ }

    // Returning user → go straight to analysis
    void startCoachAnalysis();
  }, [game.status, game.difficulty, game.moveHistory, game.elapsedMs, isPlayerWin, isConnected, address, startCoachAnalysis]);

  const handleClaimWelcome = useCallback(() => {
    try { localStorage.setItem("chesscito:coach-welcomed", "1"); } catch { /* ignore */ }
    setCoachPhase("idle");
    void startCoachAnalysis();
  }, [startCoachAnalysis]);

  const handleBackToHub = () => router.push("/");

  async function handleClaimVictory() {
    if (!canClaim || !address || !victoryNFTAddress || !publicClient) return;
    if (claimingRef.current) return; // Prevent double-click
    claimingRef.current = true;

    setClaimPhase("claiming");
    setClaimStep("signing");
    setClaimError(null);
    try {
      // 1. Get server signature
      const res = await fetch("/api/sign-victory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          difficulty: chainDifficulty,
          totalMoves: game.moveCount,
          timeMs: game.elapsedMs,
        }),
      });
      const payload = (await res.json()) as SignatureResponse;
      if (!res.ok || "error" in payload) {
        throw new Error(payload.error ?? "Could not fetch signature");
      }

      // Persist claiming state so page refresh can't double-mint
      try { sessionStorage.setItem("chesscito:claim", JSON.stringify({ phase: "claiming", deadline: payload.deadline })); } catch { /* ignore */ }

      // 2. Select payment token
      const token = selectPaymentToken(mintPriceUsd6);
      if (!token) throw new Error("No token with sufficient balance");

      const normalizedAmount = normalizePrice(mintPriceUsd6, token.decimals);

      // 3. Check allowance and approve if needed
      const allowance = await publicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, victoryNFTAddress],
      });

      if ((allowance as bigint) < normalizedAmount) {
        const approveHash = await writeContractAsync({
          address: token.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [victoryNFTAddress, normalizedAmount],
          chainId,
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Approve done — move to confirming step
      setClaimStep("confirming");

      // 4. Check signature hasn't expired (30s buffer for tx propagation)
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      if (nowSec + 30n >= BigInt(payload.deadline)) {
        throw new Error("Signature expired — please try again");
      }

      // 5. Claim (mint) and wait for confirmation
      const claimHash = await writeContractAsync({
        address: victoryNFTAddress,
        abi: victoryAbi,
        functionName: "mintSigned",
        args: [
          chainDifficulty,
          game.moveCount,
          game.elapsedMs,
          token.address,
          BigInt(payload.nonce),
          BigInt(payload.deadline),
          payload.signature,
        ],
        chainId,
        account: address,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });

      // 5. Extract tokenId from VictoryMinted event
      let extractedTokenId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: victoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "VictoryMinted" && "tokenId" in decoded.args) {
            extractedTokenId = decoded.args.tokenId as bigint;
            break;
          }
        } catch {
          // Not our event — skip
        }
      }

      // 6. Build victory URL + OG image URL
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const victoryId = extractedTokenId ? String(extractedTokenId) : null;
      const victoryUrl = victoryId
        ? `${origin}/victory/${victoryId}`
        : `https://celoscan.io/tx/${claimHash}`;
      const ogImageUrl = victoryId
        ? `${origin}/api/og/victory/${victoryId}`
        : null;

      setClaimStep("done");
      setClaimData({
        tokenId: extractedTokenId,
        claimTxHash: claimHash,
        shareCardUrl: ogImageUrl,
        shareLinkUrl: victoryUrl,
      });
      setShareStatus("ready"); // For now, share is immediately ready post-claim
      setClaimPhase("success");
      setClaimError(null);

      // Write-through to Supabase (fire-and-forget)
      void fetch("/api/cache-victory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          tokenId: extractedTokenId ? String(extractedTokenId) : "0",
          difficulty: chainDifficulty,
          totalMoves: game.moveCount,
          timeMs: game.elapsedMs,
          txHash: claimHash,
        }),
      }).catch(() => {});

      // Optimistic entry for trophies page
      try {
        sessionStorage.setItem(
          "chesscito:optimistic-victory",
          JSON.stringify({
            tokenId: extractedTokenId ? String(extractedTokenId) : "0",
            player: address.toLowerCase(),
            difficulty: chainDifficulty,
            totalMoves: game.moveCount,
            timeMs: game.elapsedMs,
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
    } catch (err) {
      console.error("Claim failed:", err);
      const raw = err instanceof Error ? err.message : "Claim failed";
      const isUserCancel = /user (rejected|denied|cancelled)|ACTION_REJECTED/i.test(raw);
      if (isUserCancel) {
        setClaimPhase("ready");
        claimingRef.current = false;
        return;
      }
      // Sanitize error — map known patterns to user-friendly messages
      const friendly = /expired/i.test(raw) ? "Signature expired — tap to get a fresh one"
        : /insufficient/i.test(raw) ? "Insufficient balance"
        : /network/i.test(raw) ? "Network error — check your connection"
        : /timeout/i.test(raw) ? "Request timed out — try again"
        : /revert/i.test(raw) ? "Transaction reverted"
        : "Something went wrong — try again";
      setClaimError(friendly);
      setClaimPhase("error");
    } finally {
      claimingRef.current = false;
    }
  }

  // Reset all arena state (claim + coach + session storage)
  const resetArenaState = useCallback(() => {
    claimingRef.current = false;
    coachAbortRef.current?.abort();
    try { sessionStorage.removeItem("chesscito:claim"); } catch { /* ignore */ }
    setClaimPhase("ready");
    setClaimStep("signing");
    setClaimData({ tokenId: null, claimTxHash: null, shareCardUrl: null, shareLinkUrl: null });
    setShareStatus("locked");
    setClaimError(null);
    setCoachPhase("idle");
    setCoachJobId(null);
    setCoachResponse(null);
    setCoachFallbackResponse(null);
    setCoachCredits(0);
  }, []);

  const handlePlayAgain = () => {
    resetArenaState();
    game.reset();
  };

  const handleBack = () => {
    resetArenaState();
    game.reset();
  };

  // Cleanup preparing timer on unmount
  useEffect(() => {
    return () => {
      if (preparingTimer.current) clearTimeout(preparingTimer.current);
    };
  }, []);

  // Delay end overlay 800ms so user sees the final board position before results appear
  useEffect(() => {
    if (isEndState) {
      setShowEndOverlay(false);
      endOverlayTimer.current = setTimeout(() => {
        endOverlayTimer.current = null;
        setShowEndOverlay(true);
      }, 800);
    } else {
      if (endOverlayTimer.current) {
        clearTimeout(endOverlayTimer.current);
        endOverlayTimer.current = null;
      }
      setShowEndOverlay(false);
    }
    return () => {
      if (endOverlayTimer.current) {
        clearTimeout(endOverlayTimer.current);
        endOverlayTimer.current = null;
      }
    };
  }, [isEndState]);

  const handleStartWithLoading = useCallback(() => {
    setIsPreparing(true);
    // Brief delay so the user sees the preparing state before the board renders
    preparingTimer.current = setTimeout(() => {
      preparingTimer.current = null;
      game.startGame();
      setIsPreparing(false);
    }, 400);
  }, [game]);

  // Difficulty selection
  if (game.status === "selecting") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center arena-bg">
        {isPreparing ? (
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
            <p className="text-sm font-semibold text-amber-400/80">
              {ARENA_COPY.difficulty[game.difficulty as keyof typeof ARENA_COPY.difficulty]}
            </p>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
            <p className="text-sm font-medium text-cyan-100/70">{ARENA_COPY.preparingAi}</p>
          </div>
        ) : (
          <DifficultySelector
            selected={game.difficulty}
            onSelect={game.setDifficulty}
            onStart={handleStartWithLoading}
            onBack={handleBackToHub}
          />
        )}
        {game.errorMessage && (
          <div className="mx-6 mt-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-center text-sm text-rose-300">
            {game.errorMessage}
          </div>
        )}
      </main>
    );
  }

  // Playing + end states
  return (
    <main className="flex min-h-[100dvh] flex-col items-center arena-bg">
      <div className="flex w-full max-w-[var(--app-max-width,390px)] flex-col">
        <ArenaHud
          difficulty={game.difficulty}
          isThinking={game.isThinking}
          onBack={handleBack}
          onResign={game.resign}
          isEndState={isEndState}
        />

        <div className="relative w-full">
          <ArenaBoard
            pieces={game.pieces}
            selectedSquare={game.selectedSquare}
            legalMoves={game.legalMoves}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            isLocked={game.isThinking || isEndState || !!game.pendingPromotion}
            isThinking={game.isThinking}
            onSquareClick={game.selectSquare}
            isCheckmatePause={isEndState && !showEndOverlay}
          />
          {game.pendingPromotion && (
            <PromotionOverlay onSelect={game.promoteWith} onCancel={game.cancelPromotion} />
          )}
        </div>

        {/* Error banner */}
        {game.errorMessage && (
          <div className="mx-3 mt-2 flex items-center justify-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5">
            <span className="text-sm text-rose-300">{game.errorMessage}</span>
            <button
              type="button"
              onClick={game.reset}
              className="shrink-0 min-h-[44px] rounded-xl bg-rose-500/20 px-3 text-xs font-semibold text-rose-300 transition-all hover:bg-rose-500/30 active:scale-[0.97]"
            >
              {ARENA_COPY.restartMatch}
            </button>
          </div>
        )}

      </div>

      {isEndState && showEndOverlay && (
        <div
          className={`transition-opacity duration-300 ${
            coachPhase !== "idle"
              ? "opacity-0 pointer-events-none"
              : "opacity-100 pointer-events-auto"
          }`}
        >
          <ArenaEndState
            status={game.status}
            isPlayerWin={isPlayerWin}
            onPlayAgain={handlePlayAgain}
            onBackToHub={handleBackToHub}
            claimPhase={claimPhase}
            claimStep={claimStep}
            shareStatus={shareStatus}
            claimData={claimData}
            onClaimVictory={canClaim ? () => void handleClaimVictory() : undefined}
            claimPrice={claimPriceLabel}
            claimError={
              claimPhase === "error" && !isConnected
                ? "Wallet disconnected — reconnect to try again"
                : claimError
            }
            moves={game.moveCount}
            elapsedMs={game.elapsedMs}
            difficulty={game.difficulty}
            onAskCoach={coachPhase === "idle" ? handleAskCoach : undefined}
          />
        </div>
      )}

      {/* Coach phases */}
      {coachPhase === "welcome" && (
        <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)]">
          <div className="relative mx-4 w-full max-w-[340px] rounded-3xl border border-white/[0.08] bg-[var(--surface-frosted)] backdrop-blur-2xl shadow-[0_0_60px_rgba(16,185,129,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setCoachPhase("idle")}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-cyan-100/40 transition hover:bg-white/[0.06] hover:text-cyan-100/70"
            >
              &times;
            </button>
            <CoachWelcome onClaim={handleClaimWelcome} />
          </div>
        </div>
      )}
      {coachPhase === "loading" && coachJobId && (
        <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)]">
          <CoachLoading
            jobId={coachJobId}
            wallet={address?.toLowerCase()}
            onReady={(response) => { setCoachResponse(response); setCoachCredits((c) => Math.max(0, c - 1)); setCoachPhase("result"); }}
            onFailed={() => {
              const quick = generateQuickReview({ result: mapArenaResult(game.status, isPlayerWin), difficulty: game.difficulty, totalMoves: game.moveHistory.length, elapsedMs: game.elapsedMs });
              setCoachFallbackResponse(quick);
              setCoachPhase("fallback");
            }}
            onCancel={() => setCoachPhase("idle")}
          />
        </div>
      )}
      {coachPhase === "result" && coachResponse && (
        <div className="pointer-events-auto fixed inset-0 z-[60] overflow-y-auto bg-[var(--overlay-scrim)]">
          <div className="mx-auto max-w-[var(--app-max-width,390px)] pt-8">
            <CoachPanel
              response={coachResponse}
              difficulty={game.difficulty}
              totalMoves={game.moveCount}
              elapsedMs={game.elapsedMs}
              credits={coachCredits}
              onPlayAgain={handlePlayAgain}
              onBackToHub={handleBackToHub}
            />
          </div>
        </div>
      )}
      {coachPhase === "fallback" && coachFallbackResponse && (
        <div className="pointer-events-auto fixed inset-0 z-[60] overflow-y-auto bg-[var(--overlay-scrim)]">
          <div className="mx-auto max-w-[var(--app-max-width,390px)] pt-8">
            <CoachFallback
              response={coachFallbackResponse}
              difficulty={game.difficulty}
              totalMoves={game.moveCount}
              elapsedMs={game.elapsedMs}
              result={mapArenaResult(game.status, isPlayerWin)}
              onGetFullAnalysis={() => setCoachPhase(isConnected ? "paywall" : "idle")}
              onPlayAgain={handlePlayAgain}
              onBackToHub={handleBackToHub}
            />
          </div>
        </div>
      )}
      {coachPhase === "paywall" && (
        <CoachPaywall
          open
          onOpenChange={() => setCoachPhase("idle")}
          onBuy={() => { /* TODO: integrate shop purchase flow */ setCoachPhase("idle"); }}
          onQuickReview={() => {
            const quick = generateQuickReview({ result: mapArenaResult(game.status, isPlayerWin), difficulty: game.difficulty, totalMoves: game.moveHistory.length, elapsedMs: game.elapsedMs });
            setCoachFallbackResponse(quick);
            setCoachPhase("fallback");
          }}
        />
      )}
    </main>
  );
}
