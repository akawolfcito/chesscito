"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { decodeEventLog } from "viem";
import Link from "next/link";
import { useChessGame } from "@/lib/game/use-chess-game";
import { ArenaBoard } from "@/components/arena/arena-board";
import { ArenaEntryPanel } from "@/components/arena/arena-entry-panel";
import { ArenaSelectScaffold } from "@/components/arena/arena-select-scaffold";
import { PersistentDock } from "@/components/play-hub/persistent-dock";
import { ArenaHud } from "@/components/arena/arena-hud";
import { ArenaActionBar } from "@/components/arena/arena-action-bar";
import { PromotionOverlay } from "@/components/arena/promotion-overlay";
import { ArenaEndState, type ClaimPhase, type ShareStatus, type ClaimData } from "@/components/arena/arena-end-state";
import { ARENA_COPY, COACH_COPY, DOCK_LABELS } from "@/lib/content/editorial";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { hasAnyPieceProgress } from "@/lib/game/has-progress";
import { usePrizePoolBalance } from "@/lib/contracts/use-prize-pool";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/game/arena-utils";
import { mapArenaResult } from "@/lib/coach/game-result";
import { generateQuickReview } from "@/lib/coach/fallback-engine";
import { shouldShowPaywall } from "@/lib/coach/paywall-gate";
import { useProStatus } from "@/lib/pro/use-pro-status";
import { CoachLoading } from "@/components/coach/coach-loading";
import { CoachPanel } from "@/components/coach/coach-panel";
import { CoachFallback } from "@/components/coach/coach-fallback";
import { CoachPaywall } from "@/components/coach/coach-paywall";
import { CoachWelcome } from "@/components/coach/coach-welcome";
import { CoachHistory } from "@/components/coach/coach-history";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { track } from "@/lib/telemetry";
import type { CoachResponse, BasicCoachResponse, GameRecord } from "@/lib/coach/types";
import { getConfiguredChainId, getVictoryNFTAddress, getShopAddress } from "@/lib/contracts/chains";
import { hapticImpact, hapticSuccess } from "@/lib/haptics";
import { victoryAbi } from "@/lib/contracts/victory";
import { shopAbi } from "@/lib/contracts/shop";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { COACH_PACK_ITEMS, type CoachPackSize } from "@/lib/contracts/shop-catalog";
import { classifyTxError, isTransactionTimeout, isUserCancellation } from "@/lib/errors";
import {
  ACCEPTED_TOKENS,
  DIFFICULTY_TO_CHAIN,
  VICTORY_PRICES,
  erc20Abi,
  formatUsd,
  normalizePrice,
} from "@/lib/contracts/tokens";

const ENABLE_COACH = process.env.NEXT_PUBLIC_ENABLE_COACH !== "false";

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

export default function ArenaPage() {
  // useSearchParams() requires a Suspense boundary for static prerender
  // (Next 14 App Router). Wrap the entire client tree so the read inside
  // ArenaPageInner is safe under both SSR and hydration.
  return (
    <Suspense fallback={null}>
      <ArenaPageInner />
    </Suspense>
  );
}

function ArenaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const arenaScaffoldEnabled = searchParams?.get("arena") === "new";
  const game = useChessGame();
  const { address, isConnected } = useAccount();
  // Same hook the /hub PRO chip uses — single source of truth across
  // the app so the chip and the Coach gate never disagree.
  const { status: proStatusFromHook } = useProStatus(address?.toLowerCase());
  const proActiveCached = proStatusFromHook?.active === true;

  // Scaffold view event — fires once per (selecting + scaffold + not
  // preparing) transition. Mount of the picker, not of the page; legacy
  // panel views are excluded so the conversion ratio is comparable
  // against /hub's hub_view baseline.
  useEffect(() => {
    if (!arenaScaffoldEnabled) return;
    if (game.status !== "selecting") return;
    track("arena_select_view");
  }, [arenaScaffoldEnabled, game.status]);
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

  /** Soft-gate visibility — rendered above the difficulty picker only
   *  when the player has no recorded piece-path progress. Starts false
   *  to avoid SSR/hydration flashing; the effect flips it client-side
   *  after reading localStorage. */
  const [softGateOpen, setSoftGateOpen] = useState(false);
  useEffect(() => {
    setSoftGateOpen(!hasAnyPieceProgress());
  }, []);

  const prizePool = usePrizePoolBalance(chainId);

  // Preparing state (loading between difficulty selection and game start)
  const [isPreparing, setIsPreparing] = useState(false);
  // Auto-launch on mount using the last difficulty the player used.
  // Skips the Difficulty Selector for returning users — a pill near the
  // HUD lets them change it without leaving the match.
  const LAST_DIFFICULTY_KEY = "chesscito:arena-last-difficulty";
  const autoStartAttemptedRef = useRef(false);

  // Delayed end overlay: gives the user 800ms to see the final board state
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const endOverlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coach state
  type CoachPhase = "idle" | "welcome" | "loading" | "result" | "fallback" | "paywall" | "history";
  const [coachPhase, setCoachPhase] = useState<CoachPhase>("idle");
  const [coachJobId, setCoachJobId] = useState<string | null>(null);
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);
  const [coachFallbackResponse, setCoachFallbackResponse] = useState<BasicCoachResponse | null>(null);
  const [coachCredits, setCoachCredits] = useState(0);
  const [coachProActive, setCoachProActive] = useState<boolean>(false);
  const [coachHistoryMeta, setCoachHistoryMeta] = useState<{ gamesPlayed: number } | undefined>(undefined);
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
  // Player wins on checkmate when it's the OPPONENT's turn to move
  // (i.e. the opponent is the one who got mated).
  const opponentColor = game.playerColor === "w" ? "b" : "w";
  const isPlayerWin = game.status === "checkmate" && game.fen.includes(` ${opponentColor} `);

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const victoryNFTAddress = useMemo(() => getVictoryNFTAddress(chainId), [chainId]);
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);

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
    query: { enabled: Boolean(address && isConnected), staleTime: 15_000 },
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
      // PRO status: trust the cached `useProStatus()` hook value first
      // (already populated when the user landed on /arena from /hub).
      // Fall back to a fresh fetch if the hook hasn't resolved yet —
      // covers the corner case of a player who lands on /arena directly
      // and finishes a game faster than the hook can settle.
      let proActive = proActiveCached;
      if (!proActive) {
        try {
          const proRes = await fetch(`/api/pro/status?wallet=${address}`, { signal });
          if (proRes.ok) {
            const proData = await proRes.json();
            proActive = proData?.active === true;
          }
        } catch { /* keep proActive false */ }
      }

      const creditsRes = await fetch(`/api/coach/credits?wallet=${address}`, { signal });
      const creditsData = await creditsRes.json();
      const credits = creditsData.credits ?? 0;
      setCoachCredits(credits);
      setCoachProActive(proActive);

      if (shouldShowPaywall({ proActive, credits })) {
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
        setCoachProActive(analyzeData.proActive === true);
        setCoachHistoryMeta(analyzeData.historyMeta);
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
  }, [game.status, game.difficulty, game.moveHistory, game.elapsedMs, isPlayerWin, address, proActiveCached]);

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

  // Coach credit purchase: pack → itemId mapping lives in
  // lib/contracts/shop-catalog.ts so it stays next to SHIELD_ITEM_ID
  // and the founder badge id, and so it's testable in isolation.
  async function handleBuyCredits(pack: CoachPackSize) {
    if (!address || !shopAddress || !publicClient || !isCorrectChain) return;

    const { itemId, priceUsd6 } = COACH_PACK_ITEMS[pack];
    const token = selectPaymentToken(priceUsd6);
    if (!token) {
      setCoachPhase("idle");
      return;
    }

    const normalizedTotal = normalizePrice(priceUsd6, token.decimals);
    const txSource = pack === 5 ? "coach_5" : "coach_20";
    const itemIdNum = Number(itemId);
    track("coach_buy_tx", { stage: "start", source: txSource, pack, item_id: itemIdNum });

    try {
      // 1. Check allowance and approve if needed
      const allowance = await publicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, shopAddress],
      });

      if ((allowance as bigint) < normalizedTotal) {
        const approveHash = await writeContractAsync({
          address: token.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [shopAddress, normalizedTotal],
          chainId,
          account: address,
        });
        await waitForReceiptWithTimeout(publicClient, approveHash);
      }

      // 2. Buy item from shop
      const buyHash = await writeContractAsync({
        address: shopAddress,
        abi: shopAbi,
        functionName: "buyItem",
        args: [itemId, 1n, token.address],
        chainId,
        account: address,
      });
      track("coach_buy_tx", { stage: "success", source: txSource, pack, item_id: itemIdNum });
      await waitForReceiptWithTimeout(publicClient, buyHash);

      // 3. Verify purchase and credit wallet
      const verifyRes = await fetch("/api/coach/verify-purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: buyHash, walletAddress: address }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.ok) {
        setCoachCredits(verifyData.credits);
        hapticSuccess();
        // Credits acquired — start analysis automatically
        setCoachPhase("idle");
        void startCoachAnalysis();
      } else {
        setCoachPhase("idle");
      }
    } catch (err) {
      // Three discrete kinds for telemetry parity with shop_buy_tx and
      // victory_claim_tx. The CoachPaywall surface stays in place so a
      // visible kind-specific overlay would compete with the existing
      // CoachFallback / Try Again CTAs — UI normalization for F5 lives
      // in a follow-up commit when the new surface is designed.
      if (isUserCancellation(err)) {
        track("coach_buy_tx", { stage: "cancelled", source: txSource, pack, item_id: itemIdNum });
      } else if (isTransactionTimeout(err)) {
        track("coach_buy_tx", {
          stage: "error",
          source: txSource,
          pack,
          item_id: itemIdNum,
          error_kind: "timeout",
        });
        console.warn("[CoachPurchase] timeout", err instanceof Error ? err.message : "");
      } else {
        console.warn("[CoachPurchase] error", err instanceof Error ? err.message : "");
        track("coach_buy_tx", {
          stage: "error",
          source: txSource,
          pack,
          item_id: itemIdNum,
          error_kind: classifyTxError(err),
        });
      }
      // Stay on paywall so user can retry or use quick review
    }
  }

  const handleBackToHub = () => router.push("/hub");

  async function handleClaimVictory() {
    if (!canClaim || !address || !victoryNFTAddress || !publicClient) return;
    if (claimingRef.current) return; // Prevent double-click
    claimingRef.current = true;

    setClaimPhase("claiming");
    setClaimStep("signing");
    setClaimError(null);
    track("victory_claim_tx", {
      stage: "start",
      difficulty: game.difficulty,
      moves: game.moveCount,
      elapsed_ms: game.elapsedMs,
    });
    // Server derives totalMoves from moveHistory.length; the on-chain
    // mintSigned call must use the SAME value or the EIP-712 signature
    // won't verify. Snapshot it once here so both stay aligned.
    const verifiedMoves = game.moveHistory.length;

    try {
      // 1. Get server signature — server replays the SAN transcript with
      //    chess.js, asserts checkmate by playerColor, and signs only the
      //    derived totalMoves. Client-supplied totalMoves is ignored on
      //    the server side, so we no longer send it.
      const res = await fetch("/api/sign-victory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          difficulty: chainDifficulty,
          moveHistory: game.moveHistory,
          playerColor: game.playerColor,
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
        await waitForReceiptWithTimeout(publicClient, approveHash);
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
          verifiedMoves,
          game.elapsedMs,
          token.address,
          BigInt(payload.nonce),
          BigInt(payload.deadline),
          payload.signature,
        ],
        chainId,
        account: address,
      });
      const receipt = await waitForReceiptWithTimeout(publicClient, claimHash);

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
      hapticSuccess();
      setClaimPhase("success");
      setClaimError(null);
      track("victory_claim_tx", {
        stage: "success",
        difficulty: game.difficulty,
        has_token_id: Boolean(extractedTokenId),
      });

      // Write-through to Supabase (fire-and-forget)
      void fetch("/api/cache-victory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          tokenId: extractedTokenId ? String(extractedTokenId) : "0",
          difficulty: chainDifficulty,
          totalMoves: verifiedMoves,
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
            totalMoves: verifiedMoves,
            timeMs: game.elapsedMs,
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
    } catch (err) {
      console.error("Claim failed:", err);
      // Stale "claiming" sessionStorage would otherwise re-strand the
      // player on next mount; clear it on every non-success exit.
      try { sessionStorage.removeItem("chesscito:claim"); } catch { /* ignore */ }

      if (isUserCancellation(err)) {
        track("victory_claim_tx", { stage: "cancelled" });
        setClaimError(null);
        setClaimPhase("cancelled");
        return;
      }
      if (isTransactionTimeout(err)) {
        track("victory_claim_tx", { stage: "error", error_kind: "timeout" });
        setClaimError(null);
        setClaimPhase("timeout");
        return;
      }
      // Telemetry kind (separate from user copy so we keep granular insight).
      const raw = err instanceof Error ? err.message : "Claim failed";
      const errorKind = /expired/i.test(raw) ? "expired"
        : /insufficient/i.test(raw) ? "insufficient_balance"
        : /network/i.test(raw) ? "network"
        : /revert/i.test(raw) ? "revert"
        : "unknown";
      // Signature expiry has its own actionable copy; everything else
      // routes through the shared classifier so we stop leaking raw
      // contract/viem strings to the player.
      const friendly = errorKind === "expired"
        ? "Signature expired — tap to get a fresh one"
        : classifyTxError(err);
      setClaimError(friendly);
      setClaimPhase("error");
      track("victory_claim_tx", { stage: "error", error_kind: errorKind });
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

  // Preparing timer — scheduled inside a useEffect tied to isPreparing so
  // React Strict Mode's mount→cleanup→remount cycle re-establishes the
  // timer after cleanup clears it. Previously the timer lived inside
  // handleStartWithLoading and a separate unmount cleanup; under Strict
  // Mode the cleanup ran on the simulated-unmount and the auto-launch
  // ref-guard blocked re-scheduling, so the user got stuck on "Preparing
  // AI..." forever.
  useEffect(() => {
    if (!isPreparing) return;
    const timer = setTimeout(() => {
      game.startGame();
      setIsPreparing(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [isPreparing, game]);

  // Delay end overlay 800ms so user sees the final board position before results appear
  useEffect(() => {
    if (isEndState) {
      hapticImpact();
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
    // Remember for next visit — so returning users skip the selector.
    try {
      localStorage.setItem(LAST_DIFFICULTY_KEY, game.difficulty);
    } catch { /* storage full / disabled — harmless */ }

    track("arena_game_start", {
      difficulty: game.difficulty,
      player_color: game.playerColor,
    });

    // The actual delay + startGame transition lives in the isPreparing
    // useEffect above — keeps the timer lifecycle compatible with
    // Strict Mode's mount→unmount→remount cycle.
    setIsPreparing(true);
  }, [game]);

  // arena_game_end — fires once per transition into a terminal state.
  const endTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    const terminal = ["checkmate", "stalemate", "draw", "resigned"];
    if (!terminal.includes(game.status)) {
      endTrackedRef.current = null;
      return;
    }
    const key = `${game.status}:${game.moveCount}:${game.elapsedMs}`;
    if (endTrackedRef.current === key) return;
    endTrackedRef.current = key;
    track("arena_game_end", {
      status: game.status,
      is_player_win: isPlayerWin,
      difficulty: game.difficulty,
      player_color: game.playerColor,
      moves: game.moveCount,
      elapsed_ms: game.elapsedMs,
    });
  }, [game.status, game.moveCount, game.elapsedMs, game.difficulty, game.playerColor, isPlayerWin]);

  // Auto-launch on mount. Priority order:
  //   1. sessionStorage "chesscito:arena-intent" — just landed from
  //      the dock ArenaEntrySheet; honor its difficulty+color picks.
  //   2. localStorage LAST_DIFFICULTY_KEY — returning user, reuse
  //      their last tier (Option B, reduces friction).
  //   3. No auto-start — show inline ArenaEntryPanel.
  // Guarded by a ref so it runs exactly once per mount.
  useEffect(() => {
    if (autoStartAttemptedRef.current) return;
    if (game.status !== "selecting") return;

    // Honor any in-flight FEN restore (useChessGame rehydrates from
    // localStorage on the same mount). If a saved game exists we must
    // not start a fresh match — it would overwrite the restored FEN via
    // startGame() (R2 from the red-team review).
    let hasSavedGame = false;
    try {
      hasSavedGame = Boolean(localStorage.getItem("chesscito:arena-game"));
    } catch { /* ignore */ }
    if (hasSavedGame) return;

    autoStartAttemptedRef.current = true;

    // Priority 1: dock sheet handed us an explicit pick via sessionStorage.
    try {
      const raw = sessionStorage.getItem("chesscito:arena-intent");
      if (raw) {
        sessionStorage.removeItem("chesscito:arena-intent");
        const intent = JSON.parse(raw) as { difficulty?: string; color?: string };
        if (intent.difficulty === "easy" || intent.difficulty === "medium" || intent.difficulty === "hard") {
          game.setDifficulty(intent.difficulty);
          if (intent.color === "w" || intent.color === "b") {
            game.setPlayerColor(intent.color);
          }
          handleStartWithLoading();
          return;
        }
      }
    } catch { /* fall through to LS fallback */ }

    // Priority 2: returning user's last-used difficulty.
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_DIFFICULTY_KEY);
    } catch { /* ignore */ }

    if (last === "easy" || last === "medium" || last === "hard") {
      game.setDifficulty(last);
      handleStartWithLoading();
    }
  }, [game, handleStartWithLoading]);

  // "Change difficulty" pill — returns to the Difficulty Selector without
  // touching LS (the new pick overwrites it on next Enter Arena).
  const handleChangeDifficulty = useCallback(() => {
    game.reset();
  }, [game]);

  // Difficulty selection
  if (game.status === "selecting") {
    const navIcon = (
      src: string,
      label: string,
      sheetKey?: "badge" | "shop" | "leaderboard" | "trophies",
    ) => (
      <Link
        href="/hub"
        role="button"
        aria-label={label}
        className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
        onClick={() => {
          if (!sheetKey) return;
          try {
            sessionStorage.setItem("chesscito:open-sheet", sheetKey);
          } catch { /* storage unavailable */ }
        }}
      >
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      </Link>
    );

    // Scaffold variant — `?arena=new`. Mirrors the kingdom-anchored
    // pattern shipped on /hub. Legacy block (ArenaEntryPanel) stays
    // intact below as the default until the flag flips.
    if (arenaScaffoldEnabled) {
      return (
        <main className="flex min-h-[100dvh] flex-col">
          {isPreparing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 animate-in fade-in duration-300 arena-scaffold">
              <p className="text-sm font-semibold text-amber-400/80">
                {ARENA_COPY.difficulty[game.difficulty as keyof typeof ARENA_COPY.difficulty]}
              </p>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
              <p className="text-sm font-medium text-cyan-100/70">{ARENA_COPY.preparingAi}</p>
            </div>
          ) : (
            <ArenaSelectScaffold
              difficulty={game.difficulty}
              playerColor={game.playerColor}
              onSelectDifficulty={(level) => {
                track("arena_difficulty_tap", { level });
                game.setDifficulty(level);
              }}
              onSelectColor={(color) => {
                track("arena_color_tap", { color });
                game.setPlayerColor(color);
              }}
              onStart={() => {
                track("arena_start_tap", {
                  surface: "scaffold",
                  level: game.difficulty,
                  color: game.playerColor,
                  wallet_connected: isConnected,
                });
                handleStartWithLoading();
              }}
              onBack={() => {
                track("arena_back_tap");
                handleBackToHub();
              }}
              softGate={
                softGateOpen
                  ? {
                      onLearn: () => router.push("/hub"),
                      onDismiss: () => setSoftGateOpen(false),
                    }
                  : undefined
              }
              prizePool={{
                formatted: prizePool.formatted,
                isLoading: prizePool.isLoading,
              }}
              errorMessage={game.errorMessage}
            />
          )}
          <div
            className="shrink-0 relative z-[60] pointer-events-auto"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <PersistentDock
              activeDockTab={null}
              badgeControl={navIcon("/art/badge-menu.png", "Badges", "badge")}
              shopControl={navIcon("/art/shop-menu.png", "Shop", "shop")}
              trophiesControl={
                <Link
                  href="/hub"
                  role="button"
                  aria-label={DOCK_LABELS.trophies}
                  className="relative flex h-full w-full shrink-0 items-center justify-center text-amber-200/80"
                  onClick={() => {
                    try {
                      sessionStorage.setItem("chesscito:open-sheet", "trophies");
                    } catch { /* storage unavailable */ }
                  }}
                >
                  <CandyIcon name="trophy" className="h-full w-full" />
                </Link>
              }
              leaderboardControl={navIcon("/art/leaderboard-menu.png", "Leaderboard", "leaderboard")}
            />
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-[100dvh] flex-col arena-bg">
        <div className="flex flex-1 flex-col items-center justify-center">
          {isPreparing ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
              <p className="text-sm font-semibold text-amber-400/80">
                {ARENA_COPY.difficulty[game.difficulty as keyof typeof ARENA_COPY.difficulty]}
              </p>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
              <p className="text-sm font-medium text-cyan-100/70">{ARENA_COPY.preparingAi}</p>
            </div>
          ) : (
            <ArenaEntryPanel
              difficulty={game.difficulty}
              playerColor={game.playerColor}
              onSelectDifficulty={game.setDifficulty}
              onSelectColor={game.setPlayerColor}
              onStart={handleStartWithLoading}
              onBack={handleBackToHub}
              softGate={
                softGateOpen
                  ? {
                      onLearn: () => router.push("/hub"),
                      onDismiss: () => setSoftGateOpen(false),
                    }
                  : undefined
              }
              prizePool={{
                formatted: prizePool.formatted,
                isLoading: prizePool.isLoading,
              }}
            />
          )}
          {game.errorMessage && (
            <div
              className="mx-6 mt-2 rounded-2xl px-4 py-2.5 text-center text-sm font-semibold"
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                border: "1px solid rgba(190, 18, 60, 0.35)",
                color: "rgba(159, 18, 57, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                backdropFilter: "blur(6px)",
              }}
            >
              {game.errorMessage}
            </div>
          )}
        </div>
        <div
          className="shrink-0 relative z-[60] pointer-events-auto"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <PersistentDock
            activeDockTab={null}
            badgeControl={navIcon("/art/badge-menu.png", "Badges", "badge")}
            shopControl={navIcon("/art/shop-menu.png", "Shop", "shop")}
            trophiesControl={
              <Link
                href="/hub"
                role="button"
                aria-label={DOCK_LABELS.trophies}
                className="relative flex h-full w-full shrink-0 items-center justify-center text-amber-200/80"
                onClick={() => {
                  try {
                    sessionStorage.setItem("chesscito:open-sheet", "trophies");
                  } catch { /* storage unavailable */ }
                }}
              >
                <CandyIcon name="trophy" className="h-full w-full" />
              </Link>
            }
            leaderboardControl={navIcon("/art/leaderboard-menu.png", "Leaderboard", "leaderboard")}
          />
        </div>
      </main>
    );
  }

  // Playing + end states
  return (
    <main className="flex h-[100dvh] flex-col items-center arena-bg">
      <div className="flex w-full max-w-[var(--app-max-width,390px)] flex-1 flex-col min-h-0">
        <ArenaHud
          isThinking={game.isThinking}
          onBack={handleBack}
          isEndState={isEndState}
          elapsedMs={game.elapsedMs}
          showCoachHint={ENABLE_COACH}
        />

        {/* Difficulty pill — returning users auto-launch with last pick;
            this is their non-intrusive escape hatch to change tier without
            losing any match since reset is safe while the game is fresh. */}
        {!isEndState && (
          <div className="mx-3 mt-1 flex justify-center">
            <button
              type="button"
              onClick={handleChangeDifficulty}
              className="flex items-center gap-1.5 rounded-full border border-amber-300/45 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider shadow-[0_1px_0_rgba(251,191,36,0.20)] transition-all hover:bg-amber-400/25 active:scale-[0.97]"
              aria-label={`Difficulty: ${ARENA_COPY.difficulty[game.difficulty]}. Tap to change.`}
            >
              <span className="text-amber-200">
                {ARENA_COPY.difficulty[game.difficulty]}
              </span>
              <span aria-hidden="true" className="text-amber-100/50">·</span>
              <span className="text-amber-100/75">tap to change</span>
            </button>
          </div>
        )}

        <div className="relative w-full flex-1 min-h-0">
          <ArenaBoard
            pieces={game.pieces}
            selectedSquare={game.selectedSquare}
            legalMoves={game.legalMoves}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            rejectingSquare={game.rejectingSquare}
            isLocked={game.isThinking || isEndState || !!game.pendingPromotion}
            isThinking={game.isThinking}
            onSquareClick={game.selectSquare}
            isCheckmatePause={isEndState && !showEndOverlay}
            playerColor={game.playerColor}
          />
          {game.pendingPromotion && (
            <PromotionOverlay onSelect={game.promoteWith} onCancel={game.cancelPromotion} />
          )}
        </div>

        <ArenaActionBar
          onResign={game.resign}
          canUndo={false}
          isEndState={isEndState}
        />

        {/* Error banner */}
        {game.errorMessage && (
          <div
            className="mx-3 mt-2 flex items-center justify-center gap-3 rounded-2xl px-4 py-2.5"
            style={{
              background: "rgba(255, 255, 255, 0.18)",
              border: "1px solid rgba(190, 18, 60, 0.35)",
              backdropFilter: "blur(6px)",
              boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{
                color: "rgba(159, 18, 57, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {game.errorMessage}
            </span>
            <button
              type="button"
              onClick={game.reset}
              className="shrink-0 min-h-[44px] rounded-xl px-3 text-xs font-semibold transition-all active:scale-[0.97]"
              style={{
                background: "rgba(190, 18, 60, 0.15)",
                color: "rgba(159, 18, 57, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
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
            fen={game.fen}
            playerColor={game.playerColor}
            onAskCoach={ENABLE_COACH && coachPhase === "idle" ? handleAskCoach : undefined}
          />
        </div>
      )}

      {/* Coach phases (behind NEXT_PUBLIC_ENABLE_COACH flag) */}
      {ENABLE_COACH && (
        <>
          {coachPhase === "welcome" && (
            <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300 px-4">
              <div className="relative z-10 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <CandyGlassShell
                  title={COACH_COPY.welcomeTitle}
                  onClose={() => setCoachPhase("idle")}
                  closeLabel="Close"
                  cta={
                    <Button
                      type="button"
                      variant="game-primary"
                      size="game"
                      onClick={handleClaimWelcome}
                      className="w-full"
                    >
                      {COACH_COPY.claimFree}
                    </Button>
                  }
                  meta={COACH_COPY.welcomeNote}
                >
                  <CoachWelcome />
                </CandyGlassShell>
              </div>
            </div>
          )}
          {coachPhase === "loading" && coachJobId && (
            <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300 px-4">
              <div className="relative z-10 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <CandyGlassShell
                  title="Coach"
                  onClose={() => setCoachPhase("idle")}
                  closeLabel="Cancel"
                >
                  <CoachLoading
                    jobId={coachJobId}
                    wallet={address?.toLowerCase()}
                    onReady={(response) => { setCoachResponse(response); setCoachCredits((c) => Math.max(0, c - 1)); setCoachPhase("result"); }}
                    onFailed={() => {
                      const quick = generateQuickReview({ result: mapArenaResult(game.status, isPlayerWin), difficulty: game.difficulty, totalMoves: game.moveHistory.length, elapsedMs: game.elapsedMs });
                      setCoachFallbackResponse(quick);
                      setCoachPhase("fallback");
                    }}
                  />
                </CandyGlassShell>
              </div>
            </div>
          )}
          {coachPhase === "result" && coachResponse && (
            <div className="pointer-events-auto fixed inset-0 z-[60] overflow-y-auto candy-modal-scrim animate-in fade-in duration-300 px-4 py-8">
              <div className="mx-auto w-full max-w-[var(--app-max-width,390px)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <CandyGlassShell
                  title={COACH_COPY.coachAnalysisTitle}
                  onClose={handleBackToHub}
                  closeLabel={ARENA_COPY.backToHub}
                >
                  <CoachPanel
                    response={coachResponse}
                    difficulty={game.difficulty}
                    totalMoves={game.moveCount}
                    elapsedMs={game.elapsedMs}
                    credits={coachCredits}
                    onPlayAgain={handlePlayAgain}
                    onBackToHub={handleBackToHub}
                    onViewHistory={address ? () => setCoachPhase("history") : undefined}
                    proActive={coachProActive}
                    historyMeta={coachHistoryMeta}
                  />
                </CandyGlassShell>
              </div>
            </div>
          )}
          {coachPhase === "fallback" && coachFallbackResponse && (
            <div className="pointer-events-auto fixed inset-0 z-[60] overflow-y-auto candy-modal-scrim animate-in fade-in duration-300 px-4 py-8">
              <div className="mx-auto w-full max-w-[var(--app-max-width,390px)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <CandyGlassShell
                  title={COACH_COPY.quickReviewTitle}
                  onClose={handleBackToHub}
                  closeLabel={ARENA_COPY.backToHub}
                >
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
                </CandyGlassShell>
              </div>
            </div>
          )}
          {coachPhase === "paywall" && (
            <CoachPaywall
              open
              onOpenChange={() => setCoachPhase("idle")}
              onBuy={(pack) => void handleBuyCredits(pack)}
              onQuickReview={() => {
                const quick = generateQuickReview({ result: mapArenaResult(game.status, isPlayerWin), difficulty: game.difficulty, totalMoves: game.moveHistory.length, elapsedMs: game.elapsedMs });
                setCoachFallbackResponse(quick);
                setCoachPhase("fallback");
              }}
            />
          )}
          {coachPhase === "history" && address && (
            <div className="pointer-events-auto fixed inset-0 z-[60] overflow-y-auto candy-modal-scrim animate-in fade-in duration-300 px-4 py-8">
              <div className="mx-auto w-full max-w-[var(--app-max-width,390px)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <CandyGlassShell
                  title={COACH_COPY.yourSessions}
                  onClose={() => setCoachPhase(coachResponse ? "result" : "idle")}
                  closeLabel="Go back"
                >
                  <CoachHistory
                    walletAddress={address.toLowerCase()}
                    credits={coachCredits}
                    onSelectEntry={(entry) => {
                      if (entry.response.kind === "full") {
                        setCoachResponse(entry.response);
                        setCoachPhase("result");
                      }
                    }}
                  />
                </CandyGlassShell>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
