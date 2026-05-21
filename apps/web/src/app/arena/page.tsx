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
import { useChessGame } from "@/lib/game/use-chess-game";
import { ArenaBoard } from "@/components/arena/arena-board";
import { ArenaEntryPanel } from "@/components/arena/arena-entry-panel";
import { ArenaSelectScaffold } from "@/components/arena/arena-select-scaffold";
import { CoachPreviewCard } from "@/components/arena/coach-preview-card";
import { PersistentDock } from "@/components/exercises/persistent-dock";
import { BadgeSheet } from "@/components/exercises/badge-sheet";
import { LeaderboardSheet } from "@/components/exercises/leaderboard-sheet";
import { PurchaseConfirmSheet } from "@/components/exercises/purchase-confirm-sheet";
import { ShopSheet } from "@/components/exercises/shop-sheet";
import { TrophiesSheet } from "@/components/exercises/trophies-sheet";
import { ArenaHud } from "@/components/arena/arena-hud";
import { ArenaActionBar } from "@/components/arena/arena-action-bar";
import { PromotionOverlay } from "@/components/arena/promotion-overlay";
import { ArenaEndState, type ClaimPhase, type ShareStatus, type ClaimData, type PersistState } from "@/components/arena/arena-end-state";
import { ARENA_COPY, COACH_COPY, COACH_ENTRY_COPY } from "@/lib/content/editorial";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { GemButton } from "@/components/scene-rooted/gem";
import { hasAnyPieceProgress } from "@/lib/game/has-progress";
import { usePrizePoolBalance } from "@/lib/contracts/use-prize-pool";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/game/arena-utils";
import { mapArenaResult } from "@/lib/coach/game-result";
import { generateQuickReview } from "@/lib/coach/fallback-engine";
import { shouldShowPaywall } from "@/lib/coach/paywall-gate";
import { useProStatus } from "@/lib/pro/use-pro-status";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { ProSheet } from "@/components/pro/pro-sheet";
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
import { useBadgeSheetState } from "@/lib/badges/use-badge-sheet-state";
import { useShopSheetState } from "@/lib/shop/use-shop-sheet-state";
import {
  registerDockSheetCloser,
  registerDockSheetOpener,
  setDockSheet,
} from "@/lib/ui/dock-sheet-store";
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
import { selectMaxBalanceToken } from "@/lib/contracts/select-payment-token";

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
  // Legacy state — kept alive for the sheets (badge/shop/trophies/
  // leaderboard) that still mount as siblings to the dock. SPEC 1 D7
  // removes those entries from the dock itself (no user-facing trigger
  // remains on /arena), but the state setters are referenced by hooks
  // below until those sheets are torn out in a follow-up.
  const [activeDockTab, setActiveDockTab] = useState<
    "badge" | "shop" | "trophies" | "leaderboard" | null
  >(null);
  const openTrophiesFromBadgeSheet = useCallback(
    () => setActiveDockTab("trophies"),
    [],
  );
  const badgeSheet = useBadgeSheetState({
    onNavigateToTrophies: openTrophiesFromBadgeSheet,
  });
  const shopSheet = useShopSheetState();
  const handleOpenBadgeSheet = useCallback(() => {
    setActiveDockTab("badge");
    badgeSheet.openSheet();
  }, [badgeSheet]);
  const handleBadgeSheetOpenChange = useCallback(
    (open: boolean) => {
      badgeSheet.sheetProps.onOpenChange(open);
      // Guarded — Radix fires onOpenChange(false) when the user taps
      // outside (e.g. on the dock to swap to a sibling sheet). Without
      // this guard, that "false" would clobber the new sheet's slug
      // set milliseconds earlier by the dock's deep-link push.
      if (open) setActiveDockTab("badge");
      else setActiveDockTab((prev) => (prev === "badge" ? null : prev));
    },
    [badgeSheet],
  );
  const handleBadgeNavigateToTrophies = useCallback(() => {
    badgeSheet.closeSheet();
    setActiveDockTab("trophies");
  }, [badgeSheet]);
  const handleOpenShopSheet = useCallback(() => {
    setActiveDockTab("shop");
    shopSheet.openSheet();
  }, [shopSheet]);
  const handleShopSheetOpenChange = useCallback(
    (open: boolean) => {
      shopSheet.sheetProps.onOpenChange(open);
      if (open) setActiveDockTab("shop");
      else setActiveDockTab((prev) => (prev === "shop" ? null : prev));
    },
    [shopSheet],
  );
  // Arena scaffold is the new default (2026-05-07): the hub-anchored
  // selector ships without the prize-pool placeholder card and matches
  // what users see when they navigate from /hub → Play. Direct visits
  // to /arena previously rendered the legacy ArenaEntryPanel which
  // surfaced "Community prize pool · Loading pool…" copy that confused
  // single-user dev smoke. Opt-out remains via `?arena=legacy`.
  const arenaScaffoldEnabled = searchParams?.get("arena") !== "legacy";
  const game = useChessGame();
  const { address, isConnected } = useAccount();
  // Same hook the /hub PRO chip uses — single source of truth across
  // the app so the chip and the Coach gate never disagree.
  const { status: proStatusFromHook } = useProStatus(address?.toLowerCase());
  const proActiveCached = proStatusFromHook?.active === true;
  const proSheet = useProSheetState();
  const arenaCoachSignalViewedRef = useRef(false);
  const coachPreviewViewedRef = useRef<string | null>(null);

  // Scaffold view event — fires once per (selecting + scaffold + not
  // preparing) transition. Mount of the picker, not of the page; legacy
  // panel views are excluded so the conversion ratio is comparable
  // against /hub's hub_view baseline.
  useEffect(() => {
    if (!arenaScaffoldEnabled) return;
    if (game.status !== "selecting") return;
    track("arena_select_view");
  }, [arenaScaffoldEnabled, game.status]);

  // Publish the dock-driven sheet state to the shared store so the
  // <PersistentDock>'s center button can detect "overlay is open".
  useEffect(() => {
    setDockSheet(activeDockTab);
    return () => setDockSheet(null);
  }, [activeDockTab]);

  // Register dock store handlers — opener for same-route dock taps,
  // closer for the center button. badgeSheet/shopSheet own internal
  // open state, so the opener must close the previous sibling before
  // opening the new one (activeDockTab alone doesn't drive them).
  useEffect(() => {
    const unregisterOpener = registerDockSheetOpener((slug) => {
      // Close any sibling sheet first so two Radix Dialogs never stack.
      badgeSheet.closeSheet();
      shopSheet.closeSheet();
      if (slug === "shop") {
        setActiveDockTab("shop");
        shopSheet.openSheet();
      } else if (slug === "badge") {
        setActiveDockTab("badge");
        badgeSheet.openSheet();
      } else if (slug === "trophies" || slug === "leaderboard") {
        setActiveDockTab(slug);
      }
    });
    const unregisterCloser = registerDockSheetCloser(() => {
      if (activeDockTab === "shop") handleShopSheetOpenChange(false);
      else if (activeDockTab === "badge") handleBadgeSheetOpenChange(false);
      else setActiveDockTab(null);
    });
    return () => {
      unregisterOpener();
      unregisterCloser();
    };
  }, [activeDockTab, badgeSheet, shopSheet, handleShopSheetOpenChange, handleBadgeSheetOpenChange]);

  // One-shot deep-link consumption: applies the URL `?sheet=` param
  // exactly once on mount, then history.replaceState's it away so the
  // URL reflects the visible state. Subsequent dock taps go through
  // the store action and never touch the URL — no race with Radix's
  // onPointerDownOutside, no router.replace fighting router.push.
  const arenaSheetDeepLinkRef = useRef(false);
  useEffect(() => {
    if (arenaSheetDeepLinkRef.current) return;
    arenaSheetDeepLinkRef.current = true;
    const sheet = searchParams?.get("sheet");
    if (!sheet) return;
    if (sheet === "shop") {
      setActiveDockTab("shop");
      shopSheet.openSheet();
    } else if (sheet === "pro") {
      proSheet.openSheet();
    } else if (sheet === "badges") {
      setActiveDockTab("badge");
      badgeSheet.openSheet();
    } else if (sheet === "trophies") {
      setActiveDockTab("trophies");
    } else if (sheet === "leaderboard") {
      setActiveDockTab("leaderboard");
    }
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      sp.delete("sheet");
      const qs = sp.toString();
      const path = window.location.pathname;
      window.history.replaceState(window.history.state, "", qs ? `${path}?${qs}` : path);
    }
  }, [searchParams, shopSheet, proSheet, badgeSheet]);

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

  // Cluster E — unconditional GameRecord persistence (§0.1).
  // Foreground-await /api/games POST on every terminal transition,
  // independent of Coach intent. CTA gating + retry toast live in
  // <ArenaEndState> via the persistState prop.
  const [persistState, setPersistState] = useState<PersistState>("idle");
  const [persistedGameId, setPersistedGameId] = useState<string | null>(null);
  const persistAttemptedRef = useRef<string | null>(null);
  const pendingGameIdRef = useRef<string | null>(null);
  const persistTelemetryRef = useRef<Record<string, unknown>>({});
  const gameRecordPersisted = persistState === "persisted" && persistedGameId !== null;
  // Source dim for coach_analyze_request (§2.4.10). Set just before
  // each call site fires; defaults to "immediate" for the end-state CTA.
  type AnalyzeSource = "immediate" | "history" | "victory-mint";
  const analyzeSourceRef = useRef<AnalyzeSource>("immediate");

  // Coach state
  type CoachPhase = "idle" | "welcome" | "loading" | "result" | "fallback" | "paywall" | "history";
  const [coachPhase, setCoachPhase] = useState<CoachPhase>("idle");
  const [coachJobId, setCoachJobId] = useState<string | null>(null);
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);
  const [coachFallbackResponse, setCoachFallbackResponse] = useState<BasicCoachResponse | null>(null);
  const [coachCredits, setCoachCredits] = useState(0);
  const [coachProActive, setCoachProActive] = useState<boolean>(false);
  const [coachHistoryMeta, setCoachHistoryMeta] = useState<{ gamesPlayed: number } | undefined>(undefined);
  // Diagnostic: when client-side PRO is true but server still rejects
  // analyze with 402, surface the mismatch so the user can report it
  // (rather than silently falling to the free quick-review fallback).
  const [coachServerError, setCoachServerError] = useState<string | null>(null);
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

  const moveCountBucket = useCallback((moves: number) => {
    if (moves <= 10) return "0-10";
    if (moves <= 20) return "11-20";
    if (moves <= 40) return "21-40";
    return "41+";
  }, []);

  const currentArenaResult = useCallback(
    () => mapArenaResult(game.status, isPlayerWin),
    [game.status, isPlayerWin],
  );

  const arenaCoachTelemetry = useCallback(
    (cta?: "open_pro_sheet" | "training_journal" | "review_match" | "use_credit") => ({
      surface: game.status === "selecting" ? "arena_setup" : "arena_endgame",
      pro_active: proActiveCached,
      wallet_connected: isConnected,
      difficulty: game.difficulty,
      result: game.status === "selecting" ? undefined : currentArenaResult(),
      move_count: game.status === "selecting" ? undefined : moveCountBucket(game.moveHistory.length),
      cta,
    }),
    [
      currentArenaResult,
      game.difficulty,
      game.moveHistory.length,
      game.status,
      isConnected,
      moveCountBucket,
      proActiveCached,
    ],
  );

  useEffect(() => {
    if (!arenaScaffoldEnabled || game.status !== "selecting") {
      arenaCoachSignalViewedRef.current = false;
      return;
    }
    if (arenaCoachSignalViewedRef.current) return;
    arenaCoachSignalViewedRef.current = true;
    track("arena_coach_signal_viewed", arenaCoachTelemetry());
  }, [arenaCoachTelemetry, arenaScaffoldEnabled, game.status]);

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
    (priceUsd6: bigint) =>
      selectMaxBalanceToken(ACCEPTED_TOKENS, tokenBalances, priceUsd6),
    [tokenBalances]
  );

  const startCoachAnalysis = useCallback(async () => {
    if (!address) return;
    if (game.moveHistory.length === 0) return;
    const gameResult = mapArenaResult(game.status, isPlayerWin);

    // Abort any previous in-flight analysis, show loading immediately
    coachAbortRef.current?.abort();
    setCoachJobId(null);
    setCoachPhase("loading");

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

      // Cluster E §0.1 — persistence is the sole writer. The persistence
      // effect MUST have populated `persistedGameId` before this code
      // path runs; CTA gating in <ArenaEndState> guarantees it. If
      // we somehow arrive without an id, surface a soft error and bail
      // rather than racing in a second POST with a fresh UUID (which
      // would create a duplicate /api/games row).
      const analyzeGameId = persistedGameId;
      if (!analyzeGameId) {
        setCoachServerError("not_persisted");
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

      // Offline guard — spec I/O Matrix "Offline analyze attempt".
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setCoachServerError(COACH_ENTRY_COPY.offlineToAnalyze);
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

      const analyzeSource = analyzeSourceRef.current;
      const analyzeRes = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: analyzeGameId, walletAddress: address }),
        signal,
      });
      const analyzeData = analyzeRes.ok ? await analyzeRes.json() : {};
      // Spec §2.4.7: idempotent re-tap fires the hit event INSTEAD of
      // `coach_analyze_request`. Branching keeps the "no credit consumed"
      // signal honest in the analytics stream.
      if (analyzeData?.idempotent === true) {
        track("coach_analyze_idempotent_hit", { source: analyzeSource });
      } else {
        track("coach_analyze_request", {
          source: analyzeSource,
          difficulty: game.difficulty,
          moves: game.moveHistory.length,
          result: gameResult,
        });
      }

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
        // Server didn't return ready/jobId — log the error for diagnostics
        // and flag a user-safe error banner.
        if (proActive) {
          const detail = analyzeData?.error
            ?? analyzeData?.internal
            ?? analyzeData?.reason
            ?? "no detail";
          console.error(
            "[coach] PRO mismatch — server returned non-ready for PRO user:",
            detail,
            `HTTP ${analyzeRes.status}`,
          );
          setCoachServerError("error");
        }
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
  }, [game.status, game.difficulty, game.moveHistory, game.elapsedMs, isPlayerWin, address, persistedGameId, proActiveCached]);

  const handleAskCoach = useCallback((source: AnalyzeSource = "immediate") => {
    if (game.moveHistory.length === 0) return;
    const gameResult = mapArenaResult(game.status, isPlayerWin);
    analyzeSourceRef.current = source;

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

    // PRO subscribers skip the "Meet Your Coach / claim 3 free analyses"
    // welcome modal entirely — they already paid for unlimited analyses
    // and showing them a free-tier upsell is at best confusing and at
    // worst feels like a downgrade. Mark welcomed and go straight to
    // analysis.
    if (proActiveCached) {
      try { localStorage.setItem("chesscito:coach-welcomed", "1"); } catch { /* ignore */ }
      void startCoachAnalysis();
      return;
    }

    // First time (free user) → show welcome
    try {
      const welcomed = localStorage.getItem("chesscito:coach-welcomed");
      if (!welcomed) {
        setCoachPhase("welcome");
        return;
      }
    } catch { /* localStorage unavailable */ }

    // Returning user → go straight to analysis
    void startCoachAnalysis();
  }, [game.status, game.difficulty, game.moveHistory, game.elapsedMs, isPlayerWin, isConnected, address, startCoachAnalysis, proActiveCached]);

  const handleArenaCoachSignalCta = useCallback(() => {
    track("arena_coach_signal_cta_tap", arenaCoachTelemetry("open_pro_sheet"));
    proSheet.openSheet();
  }, [arenaCoachTelemetry, proSheet]);

  const handleCoachPreviewCta = useCallback(() => {
    const cta = proActiveCached ? "review_match" : "open_pro_sheet";
    track("coach_preview_cta_tap", arenaCoachTelemetry(cta));
    if (proActiveCached) {
      track("coach_review_opened", arenaCoachTelemetry("review_match"));
      handleAskCoach();
    } else {
      proSheet.openSheet();
    }
  }, [arenaCoachTelemetry, handleAskCoach, proActiveCached, proSheet]);

  useEffect(() => {
    if (!isEndState || !showEndOverlay || coachPhase !== "idle") {
      coachPreviewViewedRef.current = null;
      return;
    }
    const key = `${game.status}:${game.moveHistory.length}:${game.elapsedMs}:${proActiveCached}`;
    if (coachPreviewViewedRef.current === key) return;
    coachPreviewViewedRef.current = key;
    track("coach_preview_viewed", arenaCoachTelemetry());
  }, [
    arenaCoachTelemetry,
    coachPhase,
    game.elapsedMs,
    game.moveHistory.length,
    game.status,
    isEndState,
    proActiveCached,
    showEndOverlay,
  ]);

  const coachPreview = ENABLE_COACH ? (
    game.moveHistory.length === 0 ? (
      <section
        className="coach-preview-card is-compact"
        aria-label={ARENA_COPY.coachPreview.emptyTitle}
      >
        <div className="coach-preview-card-copy">
          <span className="coach-preview-card-kicker">Coach Review</span>
          <h3 className="coach-preview-card-title">{ARENA_COPY.coachPreview.emptyTitle}</h3>
          <p className="coach-preview-card-body">{ARENA_COPY.coachPreview.emptyBody}</p>
        </div>
      </section>
    ) : (
      <CoachPreviewCard
        proActive={proActiveCached}
        difficultyLabel={ARENA_COPY.difficulty[game.difficulty]}
        resultLabel={currentArenaResult()}
        moveCount={game.moveHistory.length}
        onPrimaryCta={handleCoachPreviewCta}
        isCompact
      />
    )
  ) : null;

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
      }).catch(() => { });

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
    setCoachServerError(null);
  }, []);

  const handlePlayAgain = () => {
    resetArenaState();
    game.reset();
  };

  const handleBack = () => {
    resetArenaState();
    game.reset();
    handleBackToHub();
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

  // Cluster E — runPersist owns the foreground await against /api/games.
  // The toast (rendered inside <ArenaEndState>) masks the wait so the
  // delay reads as an intentional "Saving match…" step instead of a hang.
  // AbortController guards against unmount / status-reset races so a
  // stale resolve cannot overwrite the state of a fresh session.
  const persistAbortRef = useRef<AbortController | null>(null);
  const runPersist = useCallback(
    async (gameId: string) => {
      if (!address) return;
      const gameResult = mapArenaResult(game.status, isPlayerWin);
      const telemetryProps = {
        game_id: gameId,
        result: gameResult,
        difficulty: game.difficulty,
        moves: game.moveCount,
        elapsed_ms: game.elapsedMs,
      };
      persistTelemetryRef.current = telemetryProps;
      persistAbortRef.current?.abort();
      const controller = new AbortController();
      persistAbortRef.current = controller;
      setPersistState("persisting");
      track("game_persist_attempt", telemetryProps);
      try {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            walletAddress: address,
            game: {
              gameId,
              moves: game.moveHistory,
              result: gameResult,
              difficulty: game.difficulty,
              totalMoves: game.moveHistory.length,
              elapsedMs: game.elapsedMs,
              timestamp: Date.now(),
            } satisfies GameRecord,
          }),
        });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error(`persist_status_${res.status}`);
        setPersistedGameId(gameId);
        setPersistState("persisted");
        track("game_persist_outcome", { ...telemetryProps, result: "success" });
      } catch (err) {
        if (controller.signal.aborted) return;
        setPersistState("failed");
        track("game_persist_outcome", {
          ...telemetryProps,
          result: "failed",
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    },
    [
      address,
      game.difficulty,
      game.elapsedMs,
      game.moveCount,
      game.moveHistory,
      game.status,
      isPlayerWin,
    ],
  );

  // Unconditional persistence — fires once per terminal transition,
  // independent of Coach intent. Spec I/O Matrix line 64: 0-move games
  // STILL post (only the CTA tooltip changes). Non-wallet players skip
  // the persist; their CTA pathway is the existing guest free-quick-
  // review branch in handleAskCoach.
  //
  // The wasTerminalRef gate stops the reset branch from churning every
  // non-terminal render — it only fires when we leave a terminal state
  // we had previously entered.
  const wasTerminalRef = useRef(false);
  useEffect(() => {
    const terminal = ["checkmate", "stalemate", "draw", "resigned"];
    const isTerminal = terminal.includes(game.status);
    if (!isTerminal) {
      if (wasTerminalRef.current) {
        persistAbortRef.current?.abort();
        persistAttemptedRef.current = null;
        pendingGameIdRef.current = null;
        setPersistState("idle");
        setPersistedGameId(null);
        wasTerminalRef.current = false;
      }
      return;
    }
    wasTerminalRef.current = true;
    const key = `${game.status}:${game.moveCount}:${game.elapsedMs}`;
    if (persistAttemptedRef.current === key) return;
    persistAttemptedRef.current = key;
    if (!address) return;
    const gameId = crypto.randomUUID();
    pendingGameIdRef.current = gameId;
    void runPersist(gameId);
  }, [
    address,
    game.status,
    game.moveCount,
    game.elapsedMs,
    runPersist,
  ]);

  const handleRetryPersist = useCallback(() => {
    const gameId = pendingGameIdRef.current;
    if (!gameId) return;
    void runPersist(gameId);
  }, [runPersist]);

  const handleDismissPersistError = useCallback(() => {
    setPersistState("dismissed");
    track("game_persist_outcome", {
      ...persistTelemetryRef.current,
      result: "user-dismissed",
    });
  }, []);

  // Cluster E — history Analyze chip. Source dim is "history"; the
  // gameId is already persisted (it came from /api/games), so we skip
  // the inline POST and go straight to /api/coach/analyze. Idempotent
  // hits short-circuit on the server (existingAnalysis path).
  const handleAnalyzeFromHistory = useCallback(
    async (gameId: string) => {
      if (!address) return;
      analyzeSourceRef.current = "history";
      setCoachPhase("loading");
      try {
        const res = await fetch("/api/coach/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gameId, walletAddress: address }),
        });
        const data = res.ok ? await res.json() : {};
        if (data?.idempotent === true) {
          track("coach_analyze_idempotent_hit", { source: "history" });
        } else {
          track("coach_analyze_request", { source: "history", game_id: gameId });
        }
        if (data.status === "ready") {
          setCoachResponse(data.response);
          setCoachProActive(data.proActive === true);
          setCoachHistoryMeta(data.historyMeta);
          setCoachPhase("result");
        } else if (data.jobId) {
          setCoachJobId(data.jobId);
          setCoachPhase("loading");
        } else {
          // Error or paywall — surface paywall when payment is the blocker,
          // otherwise return the user to the history view.
          if (res.status === 402) {
            setCoachPhase("paywall");
          } else {
            setCoachPhase("history");
          }
        }
      } catch {
        setCoachPhase("history");
      }
    },
    [address],
  );

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

  // Fresh-entry override — when the dock or hub Play pushes
  // `/arena?fresh=1` the user's intent is "show me the selector".
  // useChessGame may rehydrate a saved FEN on the same mount, leaving
  // game.status === "active" and the selector unreachable. Reset the
  // game here so the selector renders. Single-shot via ref.
  const freshResetRef = useRef(false);
  useEffect(() => {
    if (freshResetRef.current) return;
    if (searchParams?.get("fresh") !== "1") return;
    freshResetRef.current = true;
    if (game.status !== "selecting") {
      game.reset();
    }
  }, [searchParams, game]);

  // Auto-launch on mount. Priority order:
  //   0. `?fresh=1` query param — caller (hub Play) explicitly wants
  //      the selector; skip the shortcut and render it.
  //   1. localStorage LAST_DIFFICULTY_KEY — returning user, reuse
  //      their last tier (Option B, reduces friction).
  //   2. No auto-start — show inline ArenaEntryPanel.
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

    // Priority 0: fresh-entry intent from hub Play CTA. Render the
    // selector even if a last-difficulty is cached.
    if (searchParams?.get("fresh") === "1") {
      return;
    }

    // Priority 1: returning user's last-used difficulty.
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_DIFFICULTY_KEY);
    } catch { /* ignore */ }

    if (last === "easy" || last === "medium" || last === "hard") {
      game.setDifficulty(last);
      handleStartWithLoading();
    }
  }, [game, handleStartWithLoading, searchParams]);

  // "Change difficulty" pill — returns to the Difficulty Selector without
  // touching LS (the new pick overwrites it on next Enter Arena).
  const handleChangeDifficulty = useCallback(() => {
    game.reset();
  }, [game]);

  const leaderboardOpen = activeDockTab === "leaderboard";
  const setLeaderboardOpen = useCallback(
    (open: boolean) => {
      // Guarded — see note on handleBadgeSheetOpenChange.
      if (open) setActiveDockTab("leaderboard");
      else setActiveDockTab((prev) => (prev === "leaderboard" ? null : prev));
    },
    [],
  );
  const trophiesOpen = activeDockTab === "trophies";
  const setTrophiesOpen = useCallback(
    (open: boolean) => {
      if (open) setActiveDockTab("trophies");
      else setActiveDockTab((prev) => (prev === "trophies" ? null : prev));
    },
    [],
  );

  // Difficulty selection
  if (game.status === "selecting") {
    const navIcon = (
      src: string,
      label: string,
      onClick: () => void,
    ) => (
      <button
        type="button"
        aria-label={label}
        className="relative flex shrink-0 items-center justify-center"
        onClick={onClick}
      >
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      </button>
    );

    // Scaffold variant — `?arena=new`. Mirrors the kingdom-anchored
    // pattern shipped on /hub. Legacy block (ArenaEntryPanel) stays
    // intact below as the default until the flag flips.
    if (arenaScaffoldEnabled) {
      return (
        <main className="arena-select-route flex h-[100dvh] min-h-0 flex-col items-center overflow-hidden arena-bg">
          {isPreparing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 animate-in fade-in duration-300 arena-scaffold">
              <p className="text-sm font-semibold text-amber-400/80">
                {ARENA_COPY.difficulty[game.difficulty as keyof typeof ARENA_COPY.difficulty]}
              </p>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
              <p className="text-sm font-medium text-amber-100/80">{ARENA_COPY.preparingAi}</p>
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
                    onLearn: () => router.push("/exercises"),
                    onDismiss: () => setSoftGateOpen(false),
                  }
                  : undefined
              }
              prizePool={{
                formatted: prizePool.formatted,
                isLoading: prizePool.isLoading,
              }}
              coachSignal={{
                proActive: proActiveCached,
                onCta: proActiveCached ? undefined : handleArenaCoachSignalCta,
              }}
              errorMessage={game.errorMessage}
            />
          )}
          <div
            className="arena-select-dock-shell shrink-0 relative z-[60] pointer-events-auto"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <PersistentDock />
            <BadgeSheet
              {...badgeSheet.sheetProps}
              onOpenChange={handleBadgeSheetOpenChange}
              onNavigateToTrophies={handleBadgeNavigateToTrophies}
              showTrigger={false}
            />
            <ShopSheet
              {...shopSheet.sheetProps}
              onOpenChange={handleShopSheetOpenChange}
              showTrigger={false}
            />
            <TrophiesSheet
              open={activeDockTab === "trophies"}
              onOpenChange={setTrophiesOpen}
              showTrigger={false}
            />
            <LeaderboardSheet
              open={activeDockTab === "leaderboard"}
              onOpenChange={setLeaderboardOpen}
              showTrigger={false}
            />
            <PurchaseConfirmSheet {...shopSheet.confirmProps} />
            <ProSheet {...proSheet.sheetProps} />
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
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
              <p className="text-sm font-medium text-amber-100/80">{ARENA_COPY.preparingAi}</p>
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
                    onLearn: () => router.push("/exercises"),
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
          <PersistentDock />
          <BadgeSheet
            {...badgeSheet.sheetProps}
            onOpenChange={handleBadgeSheetOpenChange}
            onNavigateToTrophies={handleBadgeNavigateToTrophies}
            showTrigger={false}
          />
          <ShopSheet
            {...shopSheet.sheetProps}
            onOpenChange={handleShopSheetOpenChange}
            showTrigger={false}
          />
          <TrophiesSheet
            open={activeDockTab === "trophies"}
            onOpenChange={(v) => setActiveDockTab(v ? "trophies" : null)}
            showTrigger={false}
          />
          <LeaderboardSheet
            open={activeDockTab === "leaderboard"}
            onOpenChange={(v) => setActiveDockTab(v ? "leaderboard" : null)}
            showTrigger={false}
          />
          <PurchaseConfirmSheet {...shopSheet.confirmProps} />
          <ProSheet {...proSheet.sheetProps} />
        </div>
      </main>
    );
  }

  if (ENABLE_COACH && coachPhase === "result" && coachResponse) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto min-h-full w-full max-w-[var(--app-max-width,390px)]">
          <CandyGlassShell
            title={COACH_COPY.coachAnalysisTitle}
            onClose={handleBackToHub}
            closeLabel={ARENA_COPY.backToHubAria}
            presentation="screen"
            className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
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
      </main>
    );
  }

  if (ENABLE_COACH && coachPhase === "fallback" && coachFallbackResponse) {
    return (
      <main className="arena-bg min-h-[100dvh] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="mx-auto w-full max-w-[var(--app-max-width,390px)]">
          <CandyGlassShell
            title={coachServerError ? COACH_COPY.reviewRetryTitle : COACH_COPY.quickReviewTitle}
            onClose={handleBackToHub}
            closeLabel={ARENA_COPY.backToHubAria}
            presentation="screen"
            className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
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
              onRetry={address ? () => { setCoachServerError(null); void startCoachAnalysis(); } : undefined}
              retryLabel={coachProActive ? COACH_COPY.retryReview : COACH_COPY.retry}
              errorTitle={coachServerError ? COACH_COPY.analysisIncomplete : undefined}
              errorBody={coachServerError ? COACH_COPY.analysisIncompleteBody : undefined}
            />
          </CandyGlassShell>
        </div>
      </main>
    );
  }

  if (ENABLE_COACH && coachPhase === "history" && address) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto min-h-full w-full max-w-[var(--app-max-width,390px)]">
          <CandyGlassShell
            title={COACH_COPY.yourSessions}
            onClose={() => setCoachPhase(coachResponse ? "result" : "idle")}
            closeLabel={ARENA_COPY.backToHubAria}
            presentation="screen"
            className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
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
              onAnalyzeUnanalyzed={(gameId) => void handleAnalyzeFromHistory(gameId)}
            />
          </CandyGlassShell>
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

        {!isEndState && (
          <div className="flex w-full justify-center px-4 mt-2">
            <button
              type="button"
              onClick={handleChangeDifficulty}
              className="arena-difficulty-pill group scale-95"
              aria-label={`Difficulty: ${ARENA_COPY.difficulty[game.difficulty]}. Tap to change.`}
            >
              <span className="arena-difficulty-pill-icon">
                <CandyIcon name="shield" className="h-full w-full" />
              </span>
              <span className="arena-difficulty-pill-label">
                {ARENA_COPY.difficulty[game.difficulty]}
              </span>
              <span className="arena-difficulty-pill-icon opacity-80 group-active:opacity-100 transition-opacity">
                <CandyIcon name="check" className="h-2.5 w-2.5" />
              </span>
            </button>
          </div>
        )}

        <div className="relative w-full flex-1 min-h-0 flex flex-col justify-center">
          <div className="w-full px-2">
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
          </div>
          {game.pendingPromotion && (
            <PromotionOverlay onSelect={game.promoteWith} onCancel={game.cancelPromotion} />
          )}
        </div>

        <ArenaActionBar
          onResign={game.resign}
          onUndo={undefined}
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
          className={`transition-opacity duration-300 ${coachPhase !== "idle"
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
            coachPreview={coachPhase === "idle" ? coachPreview : null}
            onAskCoach={ENABLE_COACH ? () => handleAskCoach("immediate") : undefined}
            onAskCoachFromVictory={
              ENABLE_COACH ? () => handleAskCoach("victory-mint") : undefined
            }
            persistState={persistState}
            // Guests (no wallet) skip persistence entirely; their Coach
            // CTA pathway is the free quick-review branch in
            // `handleAskCoach`. Treat them as "ready" so the CTA mounts
            // tappable rather than permanently aria-busy.
            gameRecordPersisted={isConnected ? gameRecordPersisted : true}
            onRetryPersist={handleRetryPersist}
            onDismissPersistError={handleDismissPersistError}
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
          {coachPhase === "loading" && (
            <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300 px-4">
              <div className="relative z-10 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <CandyGlassShell
                  title="Coach"
                  >
                    <CoachLoading
                      jobId={coachJobId ?? undefined}
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
          <ProSheet {...proSheet.sheetProps} />
        </>
      )}
    </main>
  );
}
