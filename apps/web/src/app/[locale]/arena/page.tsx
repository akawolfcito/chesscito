"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  useAccount,
  useChainId,
} from "wagmi";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { ConnectPromptToast } from "@/components/connect-prompt/connect-prompt-toast";
import { useConnectPrompt } from "@/lib/connect-prompt/use-connect-prompt";
import { useChessGame } from "@/lib/game/use-chess-game";
import { rivalFor, randomEloForDifficulty } from "@/lib/game/rivals";
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
import { ArenaEndState, type PersistState } from "@/components/arena/arena-end-state";
import { useTranslations } from "next-intl";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { GemButton } from "@/components/scene-rooted/gem";
import { hasAnyPieceProgress } from "@/lib/game/has-progress";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/game/arena-utils";
import { mapArenaResult } from "@/lib/coach/game-result";
import { useProStatus } from "@/lib/pro/use-pro-status";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { ProSheet } from "@/components/pro/pro-sheet";
import { CoachLoading } from "@/components/coach/coach-loading";
import { CoachPanel } from "@/components/coach/coach-panel";
import { CoachFallback } from "@/components/coach/coach-fallback";
import { LuzOnboardingPanel } from "@/components/coach/luz-onboarding-panel";
import { gameStatusToOnboardingOutcome } from "@/lib/coach/onboarding-outcome";
import { routeCoachPreviewCta } from "@/lib/coach/coach-preview-route";
import { shouldRedirectToCoachViewer } from "@/lib/coach/coach-redirect";
import { CoachHistory } from "@/components/coach/coach-history";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { track } from "@/lib/telemetry";
import type { GameRecord } from "@/lib/coach/types";
import { getConfiguredChainId, getVictoryNFTAddress } from "@/lib/contracts/chains";
import { hapticImpact } from "@/lib/haptics";
import { useBadgeSheetState } from "@/lib/badges/use-badge-sheet-state";
import { useShopSheetState } from "@/lib/shop/use-shop-sheet-state";
import {
  registerDockSheetCloser,
  registerDockSheetOpener,
  setDockSheet,
} from "@/lib/ui/dock-sheet-store";
import {
  DIFFICULTY_TO_CHAIN,
  VICTORY_PRICES,
  formatUsd,
} from "@/lib/contracts/tokens";
import { useCoachAnalysis } from "@/lib/coach/use-coach-analysis";
import { useMintVictory } from "@/lib/coach/use-mint-victory";
import { postMintReceipt } from "@/lib/coach/post-mint-receipt";

const ENABLE_COACH = process.env.NEXT_PUBLIC_ENABLE_COACH !== "false";

// Import the pure X-close state machine. Logic lives in end-state-close-policy.ts
// so tests can import it directly without pulling in the full page tree, and
// without violating Next.js App Router's page-export constraints (only the
// default export + reserved Next.js names are allowed in page files).
import { evaluateXClose } from "./end-state-close-policy";

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
  const tArena = useTranslations("ARENA_COPY");
  const tCoach = useTranslations("COACH_COPY");
  const difficultyLabel = (key: string): string => {
    const k = key as "easy" | "medium" | "hard";
    return ["easy", "medium", "hard"].includes(k) ? tArena(`difficulty.${k}`) : key;
  };
  // Legacy state — kept alive for the sheets (badge/shop/trophies/
  // leaderboard) that still mount as siblings to the dock. SPEC 1 D7
  // removes those entries from the dock itself (no user-facing trigger
  // remains on /arena), but the state setters are referenced by hooks
  // below until those sheets are torn out in a follow-up.
  const [activeDockTab, setActiveDockTab] = useState<
    "badge" | "shop" | "trophies" | "leaderboard" | null
  >(null);
  const badgeSheet = useBadgeSheetState();
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
  // selector matches what users see when they navigate from /hub → Play.
  // The prize-pool surface (legacy ArenaEntryPanel teaser + new scaffold
  // pill) was removed in M1 funnel work (2026-06-01) — the on-chain
  // 20% fee split keeps accumulating, but UI no longer communicates it
  // as a promise to users until distribution is implemented. Opt-out
  // for the legacy panel remains via `?arena=legacy`.
  const arenaScaffoldEnabled = searchParams?.get("arena") !== "legacy";
  const game = useChessGame();

  const { address, isConnected } = useAccount();
  const { connectWallet } = useConnectWallet();
  const victoryConnectPrompt = useConnectPrompt("victory");
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
  // <PersistentDock>'s center button can detect "overlay is open" —
  // dock-driven (badge/shop/trophies/leaderboard) OR non-dock
  // (ProSheet). The `"overlay"` sentinel keeps the dock in close mode
  // without lighting any side-item glow.
  useEffect(() => {
    if (activeDockTab) {
      setDockSheet(activeDockTab);
    } else if (proSheet.open) {
      setDockSheet("overlay");
    } else {
      setDockSheet(null);
    }
    return () => setDockSheet(null);
  }, [activeDockTab, proSheet.open]);

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
      // "arena" / "overlay" slugs aren't openable side-items here.
    });
    const unregisterCloser = registerDockSheetCloser(() => {
      // Close the dock-driven tab first, then non-dock overlays. Each
      // close is a no-op if the matching sheet isn't open, so order
      // is safe even if state desyncs across renders.
      if (activeDockTab === "shop") handleShopSheetOpenChange(false);
      else if (activeDockTab === "badge") handleBadgeSheetOpenChange(false);
      else setActiveDockTab(null);
      if (proSheet.open) proSheet.closeSheet();
    });
    return () => {
      unregisterOpener();
      unregisterCloser();
    };
  }, [activeDockTab, badgeSheet, shopSheet, handleShopSheetOpenChange, handleBadgeSheetOpenChange, proSheet]);

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

  /** Soft-gate visibility — rendered above the difficulty picker only
   *  when the player has no recorded piece-path progress. Starts false
   *  to avoid SSR/hydration flashing; the effect flips it client-side
   *  after reading localStorage. */
  const [softGateOpen, setSoftGateOpen] = useState(false);
  useEffect(() => {
    setSoftGateOpen(!hasAnyPieceProgress());
  }, []);

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

  const isEndState = ["checkmate", "stalemate", "draw", "resigned"].includes(game.status);
  // Player wins on checkmate when it's the OPPONENT's turn to move
  // (i.e. the opponent is the one who got mated).
  const opponentColor = game.playerColor === "w" ? "b" : "w";
  const isPlayerWin = game.status === "checkmate" && game.fen.includes(` ${opponentColor} `);

  // Rival identity for the gameplay HUD (2026-06-15). The ELO is picked
  // once per match — keyed on gameStartedAt so it stays stable for the
  // whole game and refreshes when a new match begins.
  const rival = rivalFor(game.difficulty);
  const rivalElo = useMemo(
    () => randomEloForDifficulty(game.difficulty),
    [game.difficulty, game.gameStartedAt],
  );
  const youColorLabel =
    game.playerColor === "w"
      ? tArena("playAsWhiteName")
      : tArena("playAsBlackName");
  const rivalColorLabel =
    game.playerColor === "w"
      ? tArena("playAsBlackName")
      : tArena("playAsWhiteName");

  // T13: extracted hooks — now the sole source of truth.
  // Hooks read all live values from liveRef internally; pass current game
  // context so it's always up-to-date when the user fires an action.
  const coach = useCoachAnalysis({
    surface: "arena_endgame",
    gameId: persistedGameId ?? undefined,
    result: mapArenaResult(game.status, isPlayerWin),
    difficulty: game.difficulty,
    moves: game.moveHistory,
    elapsedMs: game.elapsedMs,
    isConnected,
  });

  const mint = useMintVictory({
    gameId: persistedGameId ?? undefined,
    difficulty: game.difficulty,
    // F8 phase (b): any terminal outcome is saveable, so feed the real
    // mapped result (win/lose/draw/resigned), not the win-only literal.
    // `undefined` while still selecting/playing — mint never starts there.
    result: isEndState ? mapArenaResult(game.status, isPlayerWin) : undefined,
    totalMoves: game.moveHistory.length,
    elapsedMs: game.elapsedMs,
    moveHistory: game.moveHistory,
    playerColor: game.playerColor,
    isConnected,
    onClaimTelemetry: (event) => {
      track("victory_claim_tx", {
        stage: event.stage,
        difficulty: game.difficulty,
        moves: game.moveCount,
        elapsed_ms: game.elapsedMs,
        has_token_id: event.has_token_id,
        error_kind: event.error_kind,
      });
    },
  });

  // Persist mint outcome to gameRecord for cold-load viewers (fire-and-forget).
  // mint.data.tokenId is bigint | null — convert to string before posting.
  useEffect(() => {
    if (mint.phase !== "success") return;
    const { tokenId, claimTxHash, shareCardUrl, shareLinkUrl } = mint.data;
    if (!tokenId || !claimTxHash || !shareCardUrl || !shareLinkUrl) return;
    if (!persistedGameId || !address) return;
    void postMintReceipt({
      gameId: persistedGameId,
      walletAddress: address as `0x${string}`,
      tokenId: String(tokenId),
      claimTxHash: claimTxHash as `0x${string}`,
      shareCardUrl,
      shareLinkUrl,
      surface: "arena_endgame",
    });
  }, [mint.phase, mint.data, persistedGameId, address]);

  // Phase 2 nudge: first arena victory while disconnected triggers the
  // one-shot "Connect to save / mint" prompt. The hook is idempotent, so
  // re-renders at terminal state are safe — show() no-ops after the flag
  // is set. Depend on `.show` (memoized) rather than the whole hook
  // object, otherwise the dep array would change every render and
  // re-running this effect each commit thrashed the neighbouring
  // isPreparing-timer effect (regression: PLAY never reached the board).
  const showVictoryPrompt = victoryConnectPrompt.show;
  useEffect(() => {
    if (isPlayerWin && !isConnected) {
      showVictoryPrompt();
    }
  }, [isPlayerWin, isConnected, showVictoryPrompt]);

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

  const chainDifficulty = DIFFICULTY_TO_CHAIN[game.difficulty];
  const mintPriceUsd6 = VICTORY_PRICES[chainDifficulty] ?? 0n;
  const claimPriceLabel = formatUsd(mintPriceUsd6);

  // F8 phase (b): Save is no longer win-only. Any terminal match with at
  // least one move can mint (the contract reverts on totalMoves==0, and the
  // UI also hides Save then). Dropped the `isPlayerWin` requirement; added
  // the 0-move guard so an instant resign never offers a revert-bound Save.
  const canClaim =
    isConnected && isCorrectChain && victoryNFTAddress != null && game.moveCount > 0;

  // Reset all arena state — delegates to extracted hooks (T13).
  // coach.abort() cancels any in-flight analysis but does NOT reset the
  // phase machine — without coach.setPhase("idle") the result-phase
  // early return at line ~1095 keeps rendering CoachPanel after the
  // user taps "Play Again", trapping them in a visual loop that only
  // the X (handleBackToHub) escapes. mint.reset() clears sessionStorage
  // + resets all claim state atomically.
  const resetArenaState = useCallback(() => {
    coach.abort();
    coach.setPhase("idle");
    mint.reset();
  }, [coach, mint]);

  // UX audit #94 — the standalone coach-credits paywall is retired. The
  // SHOP already sells the same coach packs (catalog itemId 3/4), so any
  // path that reaches the "paywall" phase (the explicit "Get full
  // analysis" tap on the quick review, or a 402 from the coach API when
  // credits run out mid-analysis) funnels to the SHOP instead. We reset
  // the coach phase first so the end-state renders cleanly behind the
  // shop sheet. Guarded on `coach.phase` so the prepare-timer render gap
  // is never touched (see arena-play-timer-fragility memory).
  useEffect(() => {
    if (coach.phase !== "paywall") return;
    coach.setPhase("idle");
    handleOpenShopSheet();
  }, [coach.phase, coach, handleOpenShopSheet]);

  const handlePlayAgain = () => {
    resetArenaState();
    game.reset();
  };


  const handleBackToHub = () => router.push("/hub");

  // handleBack — direct router.push to /hub. The unmount cleanup of
  // /arena recovers refs (persistAbortRef) and resets game state
  // implicitly. Calling game.reset() BEFORE router.push() caused the
  // status to flip to "selecting" for one render frame, producing a
  // visible selector flash (2026-05-27 fix).
  const handleBack = () => {
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

  // T10 — visibilitychange guard: if the WebView is backgrounded during the
  // 800ms endOverlayTimer gap the timeout may stall; re-show the popup when
  // the tab becomes visible again so the user never sees a blank end-state.
  useEffect(() => {
    if (!isEndState || showEndOverlay) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") setShowEndOverlay(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isEndState, showEndOverlay]);

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
              playerColor: game.playerColor,
              ...(game.startingFen !== undefined && { startingFen: game.startingFen }),
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
      game.playerColor,
      game.startingFen,
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
    // Dedupe key intentionally OMITS game.elapsedMs — the live tick keeps
    // incrementing after the terminal transition, so including it in the
    // key produced one extra persist per tick (two POSTs with different
    // UUIDs, observed in telemetry 2026-05-28). gameStartedAt is the
    // per-game nonce that disambiguates back-to-back games with identical
    // terminal stats (e.g., two 4-move Fool's Mates) so the second one
    // still persists (Edge case hunter #1).
    const key = `${game.gameStartedAt}:${game.status}:${game.moveCount}`;
    if (persistAttemptedRef.current === key) return;
    persistAttemptedRef.current = key;
    if (!address) return;
    const gameId = crypto.randomUUID();
    pendingGameIdRef.current = gameId;
    void runPersist(gameId);
  }, [
    address,
    game.gameStartedAt,
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

  // T10 — X-close state machine (pendingNavRef + handleEndStateClose).
  // When the user taps X during an in-flight persist we set the ref and
  // let the terminal-transition consumer below fire the navigation once
  // the persist settles, rather than navigating mid-request.
  const pendingNavRef = useRef(false);

  const handleEndStateClose = useCallback(() => {
    const eff = evaluateXClose({
      persistState,
      claimPhase: mint.phase,
      walletAddress: address,
      gameId: persistedGameId ?? undefined,
      tooShort: game.moveHistory.length === 0,
    });
    // Bug 2 telemetry — surface every X-close decision so a stray push to
    // /coach/[id] during a fresh-entry flow is traceable in Vercel logs.
    track("arena_x_close_fired", {
      effect_type: eff.type,
      effect_href: eff.type === "push" ? eff.href : undefined,
      persist_state: persistState,
      claim_phase: mint.phase,
      has_persisted_game_id: !!persistedGameId,
    });
    if (eff.type === "push") {
      router.push(eff.href);
    } else if (eff.type === "set-pending") {
      pendingNavRef.current = true;
    }
    setShowEndOverlay(false);
  }, [persistState, mint.phase, address, persistedGameId, router, game.moveHistory.length]);

  // T10 — pendingNavRef consumer: fires deferred navigation once persist
  // reaches a terminal state (persisted / failed / dismissed).
  useEffect(() => {
    if (!pendingNavRef.current) return;
    if (persistState === "persisted" && persistedGameId && address) {
      pendingNavRef.current = false;
      // Review F6: a 0-move game routes to the Journal (with PLAY shortcut),
      // never to an empty /coach/[gameId] board.
      const tooShort = game.moveHistory.length === 0;
      track("arena_pending_nav_consumed", {
        resolved: "persisted",
        target: tooShort ? "journal" : "coach",
      });
      router.push(
        tooShort
          ? `/coach/history?wallet=${address}`
          : `/coach/${persistedGameId}?wallet=${address}`,
      );
    } else if (persistState === "failed") {
      pendingNavRef.current = false;
      track("arena_pending_nav_consumed", {
        resolved: "failed",
        target: "arena_fresh",
      });
      router.push("/arena?fresh=1");
      // failure toast already rendered by PersistOverlay component
    } else if (persistState === "dismissed") {
      pendingNavRef.current = false;
      track("arena_pending_nav_consumed", {
        resolved: "dismissed",
        target: "stay",
      });
    }
  }, [persistState, persistedGameId, address, router, game.moveHistory.length]);

  // #116 prefetch REMOVED 2026-06-13 (review F4). Prefetching
  // /coach/[gameId] while the popup is visible warmed the Router Cache with
  // a PRE-analysis RSC snapshot (gameRecord.analysis === null). The
  // analysis-redirect path (Ask Coach → result → push) then reused that
  // stale entry, so the viewer cold-loaded with no analysis until the user
  // exited and re-entered. Dropping the prefetch makes every push fetch the
  // route fresh (Redis read), so the just-persisted analysis renders on the
  // first land. The X-close transition loses its warm cache but stays
  // correct (a fast wallet-scoped Redis read).

  /* Phase 2 — single coach surface (2026-06-05).
   *
   * The /arena inline analysis ("REVIEW" with CandyGlassShell title)
   * was a duplicate of the persisted /coach/[gameId] page ("MATCH
   * REVIEW") that this very arena flow ends up at when the user enters
   * via /coach/history. Two surfaces, same data, different vocabulary
   * — and the inline path was unreachable by URL, so refreshing or
   * sharing the analysis lost it entirely.
   *
   * Plan 2 (Render-A, 2026-06-13): redirect ONLY on a persisted `full`
   * result (phase "result"). `/api/coach/analyze` persists the analysis
   * key before returning `status:"ready"`, so the destination viewer cold-
   * loads the same content via `getGameRecord()`. The client-only quick
   * review (phase "fallback") is NEVER persisted — redirecting on it landed
   * the user on an empty Match Review (founder bug). Fallback now renders
   * inline in the arena popup below; only `result` navigates. The inline
   * blocks also cover persistence failure and guest play (no wallet). */
  const arenaCoachRedirectFiredRef = useRef(false);
  useEffect(() => {
    if (!ENABLE_COACH) return;
    if (arenaCoachRedirectFiredRef.current) return;
    if (!address || !persistedGameId) return;
    if (!shouldRedirectToCoachViewer(coach.phase, coach.response)) return;
    arenaCoachRedirectFiredRef.current = true;
    track("arena_coach_redirect", { phase: coach.phase, gameId: persistedGameId });
    router.push(`/coach/${persistedGameId}?wallet=${address}`);
  }, [
    coach.phase,
    coach.response,
    address,
    persistedGameId,
    router,
  ]);


  // arena_game_end — fires once per transition into a terminal state.
  // Dedupe key OMITS game.elapsedMs for the same reason the persist
  // effect above does: the live tick keeps incrementing after the
  // terminal transition and would otherwise produce duplicate fires
  // (two arena_game_end events with different elapsed_ms, observed in
  // telemetry 2026-05-28). The track call still reads the closure
  // value, so the captured elapsed_ms reflects the moment the terminal
  // transition was first observed — exactly what we want.
  const endTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    const terminal = ["checkmate", "stalemate", "draw", "resigned"];
    if (!terminal.includes(game.status)) {
      endTrackedRef.current = null;
      return;
    }
    const key = `${game.status}:${game.moveCount}`;
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
  // Bug 2 telemetry — single mount snapshot so a "fresh-entry that
  // landed back in /coach" report can be aligned against the hook's
  // post-hydrate state (status, saved game, persistedGameId). Empty
  // deps guard against re-fires on render churn.
  const arenaMountTrackedRef = useRef(false);
  useEffect(() => {
    if (arenaMountTrackedRef.current) return;
    arenaMountTrackedRef.current = true;
    let hadSavedGame = false;
    try {
      hadSavedGame = !!localStorage.getItem("chesscito:arena-game");
    } catch { /* ignore */ }
    track("arena_mount", {
      fresh_param: searchParams?.get("fresh") === "1",
      had_saved_game: hadSavedGame,
      game_status_at_mount: game.status,
      has_persisted_game_id: !!persistedGameId,
      persist_state: persistState,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const freshResetRef = useRef(false);
  useEffect(() => {
    if (freshResetRef.current) return;
    if (searchParams?.get("fresh") !== "1") return;
    freshResetRef.current = true;
    let hadSavedGame = false;
    try {
      hadSavedGame = !!localStorage.getItem("chesscito:arena-game");
    } catch { /* ignore */ }
    // Bug 2 telemetry — surface every fresh-reset entry with the pre-reset
    // hook state. If a stale terminal-state survives this point we want to
    // see it in the logs (status, save presence) and correlate with any
    // unexpected `arena_x_close_fired` that follows.
    track("arena_fresh_reset_fired", {
      pre_reset_status: game.status,
      had_saved_game: hadSavedGame,
      will_call_reset: game.status !== "selecting",
    });
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

  const handleCoachPreviewCta = useCallback(() => {
    const action = routeCoachPreviewCta({
      proActive: proActiveCached,
      credits: coach.credits,
    });
    if (action === "ask") {
      const ctaTag = proActiveCached ? "review_match" : "use_credit";
      track("coach_preview_cta_tap", arenaCoachTelemetry(ctaTag));
      if (proActiveCached) {
        track("coach_review_opened", arenaCoachTelemetry("review_match"));
      }
      coach.askCoach("immediate");
      return;
    }
    // action === "paywall" — free user, no credits left.
    track("coach_preview_cta_tap", arenaCoachTelemetry("open_pro_sheet"));
    proSheet.openSheet();
  }, [arenaCoachTelemetry, coach, proActiveCached, proSheet]);

  useEffect(() => {
    if (!isEndState || !showEndOverlay || coach.phase !== "idle") {
      coachPreviewViewedRef.current = null;
      return;
    }
    const key = `${game.status}:${game.moveHistory.length}:${game.elapsedMs}:${proActiveCached}`;
    if (coachPreviewViewedRef.current === key) return;
    coachPreviewViewedRef.current = key;
    track("coach_preview_viewed", arenaCoachTelemetry());
  }, [
    arenaCoachTelemetry,
    coach.phase,
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
        aria-label={tArena("coachPreview.emptyTitle")}
      >
        <div className="coach-preview-card-copy">
          <span className="coach-preview-card-kicker">Coach Review</span>
          <h3 className="coach-preview-card-title">{tArena("coachPreview.emptyTitle")}</h3>
          <p className="coach-preview-card-body">{tArena("coachPreview.emptyBody")}</p>
        </div>
      </section>
    ) : (
      <CoachPreviewCard
        proActive={proActiveCached}
        credits={coach.credits}
        onPrimaryCta={handleCoachPreviewCta}
        isCompact
      />
    )
  ) : null;

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
        <main
          className="arena-select-route flex h-[100dvh] min-h-0 flex-col items-center overflow-hidden arena-bg"
          data-testid="arena-difficulty-selector"
        >
          {isPreparing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 animate-in fade-in duration-300 arena-scaffold">
              <p className="text-sm font-semibold text-amber-400/80">
                {difficultyLabel(game.difficulty)}
              </p>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
              <p className="text-sm font-medium text-amber-100/80">{tArena("preparingAi")}</p>
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
      <main className="flex min-h-[100dvh] flex-col arena-bg" data-testid="arena-difficulty-selector">
        <div className="flex flex-1 flex-col items-center justify-center">
          {isPreparing ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
              <p className="text-sm font-semibold text-amber-400/80">
                {difficultyLabel(game.difficulty)}
              </p>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
              <p className="text-sm font-medium text-amber-100/80">{tArena("preparingAi")}</p>
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

  /* When persistedGameId + address are present, the Phase 2 redirect
   * useEffect above pushes the user to /coach/[gameId] instead. The
   * inline block stays as a degraded fallback for sessions without a
   * persisted record (persistence failed) or without a connected wallet
   * (guest play), where the route push has nowhere to land. */
  const willRedirectToCoachRoute = ENABLE_COACH && !!address && !!persistedGameId;
  if (
    ENABLE_COACH &&
    coach.phase === "result" &&
    coach.response &&
    coach.response.kind === "full" &&
    !willRedirectToCoachRoute
  ) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto min-h-full w-full max-w-[var(--app-max-width,390px)]">
          <CandyGlassShell
            title={tCoach("coachAnalysisTitle")}
            onClose={handleBackToHub}
            closeLabel={tArena("backToHubAria")}
            presentation="screen"
            className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
          >
            <CoachPanel
              response={coach.response}
              difficulty={game.difficulty}
              totalMoves={game.moveCount}
              elapsedMs={game.elapsedMs}
              credits={coach.credits}
              onPlayAgain={handlePlayAgain}
              onBackToHub={handleBackToHub}
              onViewHistory={address ? () => coach.setPhase("history") : undefined}
              proActive={proActiveCached}
              analysisLocale={coach.analysisLocale}
              historyMeta={coach.historyMeta}
              onReanalyze={
                address && coach.reanalyzeGameId ? coach.reanalyze : undefined
              }
              isReanalyzing={coach.isReanalyzing}
              moves={game.moveHistory}
            />
          </CandyGlassShell>
        </div>
      </main>
    );
  }

  if (
    ENABLE_COACH &&
    coach.phase === "fallback" &&
    coach.fallbackResponse &&
    !willRedirectToCoachRoute
  ) {
    return (
      <main className="arena-bg min-h-[100dvh] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="mx-auto w-full max-w-[var(--app-max-width,390px)]">
          <CandyGlassShell
            title={coach.serverError ? tCoach("reviewRetryTitle") : tCoach("quickReviewTitle")}
            onClose={handleBackToHub}
            closeLabel={tArena("backToHubAria")}
            presentation="screen"
            className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
          >
            <CoachFallback
              response={coach.fallbackResponse}
              difficulty={game.difficulty}
              totalMoves={game.moveCount}
              elapsedMs={game.elapsedMs}
              result={mapArenaResult(game.status, isPlayerWin)}
              onGetFullAnalysis={() => coach.setPhase("paywall")}
              onPlayAgain={handlePlayAgain}
              onBackToHub={handleBackToHub}
              onRetry={address ? () => { coach.askCoach("immediate"); } : undefined}
              retryLabel={proActiveCached ? tCoach("retryReview") : tCoach("retry")}
              errorTitle={coach.serverError ? tCoach("analysisIncomplete") : undefined}
              errorBody={coach.serverError ? tCoach("analysisIncompleteBody") : undefined}
            />
          </CandyGlassShell>
        </div>
      </main>
    );
  }

  if (ENABLE_COACH && coach.phase === "history" && address) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto min-h-full w-full max-w-[var(--app-max-width,390px)]">
          <CandyGlassShell
            title={tCoach("yourSessions")}
            onClose={() => coach.setPhase(coach.response ? "result" : "idle")}
            closeLabel={tArena("backToHubAria")}
            presentation="screen"
            className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
          >
            <CoachHistory
              walletAddress={address.toLowerCase()}
              credits={coach.credits}
              onSelectEntry={(entry) => {
                if (entry.response.kind === "full") {
                  coach.setPhase("result");
                }
              }}
              onAnalyzeUnanalyzed={(gameId) => void coach.analyzeFromHistory(gameId)}
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
          youName={tArena("youLabel")}
          youColorLabel={youColorLabel}
          rivalName={rival.name}
          rivalColorLabel={rivalColorLabel}
          vsBelowSlot={
            !isEndState ? (
              <button
                type="button"
                onClick={handleChangeDifficulty}
                className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left arena-difficulty-pill arena-rival-chip"
                aria-label={`${rival.name}, ${difficultyLabel(game.difficulty)}, ${rivalElo} ELO. Tap to change.`}
              >
                <CandyIcon
                  name="shield"
                  className="candy-tray-pill-icon candy-tray-pill-icon--floating"
                />
                <span className="arena-rival-chip-label">
                  {rival.name}
                  <span className="arena-rival-chip-meta">
                    {difficultyLabel(game.difficulty)} · {rivalElo} ELO
                  </span>
                </span>
              </button>
            ) : null
          }
        />

        <div className="relative w-full flex-1 min-h-0 flex flex-col justify-center">
          <div className="w-full px-2">
            <ArenaBoard
              pieces={game.pieces}
              selectedSquare={game.selectedSquare}
              legalMoves={game.legalMoves}
              lastMove={game.lastMove}
              checkSquare={game.checkSquare}
              rejectingSquare={game.rejectingSquare}
              captureFlashSquare={game.captureFlashSquare}
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
              {tArena("restartMatch")}
            </button>
          </div>
        )}

      </div>

      {isEndState && showEndOverlay && (
        <div
          className={`transition-opacity duration-300 ${coach.phase !== "idle"
              ? "opacity-0 pointer-events-none"
              : "opacity-100 pointer-events-auto"
            }`}
        >
          <ArenaEndState
            status={game.status}
            isPlayerWin={isPlayerWin}
            onPlayAgain={handlePlayAgain}
            onBackToHub={handleBackToHub}
            onClose={handleEndStateClose}
            claimPhase={mint.phase}
            claimStep={mint.step}
            shareStatus={mint.shareStatus}
            claimData={mint.data}
            onClaimVictory={canClaim ? () => void mint.start() : undefined}
            claimPrice={claimPriceLabel}
            claimError={
              mint.phase === "error" && !isConnected
                ? "Wallet disconnected — reconnect to try again"
                : mint.error
            }
            claimErrorKind={mint.errorKind}
            moves={game.moveCount}
            elapsedMs={game.elapsedMs}
            difficulty={game.difficulty}
            fen={game.fen}
            playerColor={game.playerColor}
            coachPreview={coach.phase === "idle" ? coachPreview : null}
            onAskCoach={ENABLE_COACH ? () => coach.askCoach("immediate") : undefined}
            onAskCoachFromVictory={
              ENABLE_COACH ? () => coach.askCoach("victory-mint") : undefined
            }
            persistState={persistState}
            // Guests (no wallet) skip persistence entirely; their Coach
            // CTA pathway is the free quick-review branch in
            // coach.askCoach. Treat them as "ready" so the CTA mounts
            // tappable rather than permanently aria-busy.
            gameRecordPersisted={isConnected ? gameRecordPersisted : true}
            onRetryPersist={handleRetryPersist}
            onDismissPersistError={handleDismissPersistError}
            proActive={proActiveCached}
          />
          {victoryConnectPrompt.isVisible && (
            <div className="pointer-events-auto fixed inset-x-0 bottom-24 z-[55] mx-auto w-full max-w-[var(--app-max-width,390px)] px-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <ConnectPromptToast
                milestone="victory"
                onConnect={() => {
                  victoryConnectPrompt.dismiss();
                  connectWallet();
                }}
                onDismiss={victoryConnectPrompt.dismiss}
              />
            </div>
          )}
        </div>
      )}

      {/* Coach phases (behind NEXT_PUBLIC_ENABLE_COACH flag) */}
      {ENABLE_COACH && (
        <>
          {coach.phase === "welcome" && (
            <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300 px-4">
              <div className="relative z-10 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <CandyGlassShell
                  title="Luz"
                  onClose={() => coach.setPhase("idle")}
                  closeLabel="Close"
                >
                  <LuzOnboardingPanel
                    outcome={gameStatusToOnboardingOutcome(game.status, isPlayerWin)}
                    onAccept={() => void coach.claimWelcome()}
                    onDecline={() => coach.setPhase("idle")}
                  />
                </CandyGlassShell>
              </div>
            </div>
          )}
          {coach.phase === "loading" && (
            // Founder feedback 2026-06-13: the loading state now wears the
            // same forest-cream panel-bg1 shell (green border) as the rest of
            // the arena end-state popups — drops the odd cream CandyGlassShell
            // frame. Content (the sky CoachLoading card) is unchanged. No X /
            // backdrop close: the state is transient and resolves itself.
            <VictoryPopupShell ariaLabel="Coach" role="dialog" ariaLive="polite">
              <CoachLoading
                jobId={coach.jobId ?? undefined}
                wallet={address?.toLowerCase()}
                onReady={(response) => {
                  // Polling completes mid-job — the hook sets response
                  // and transitions phase to "result" internally once
                  // we call setPhase. Pass the polled response back.
                  coach.setPhase("result");
                  void response; // hook-internal; kept for API compat
                }}
                onFailed={() => {
                  coach.setPhase("fallback");
                }}
              />
            </VictoryPopupShell>
          )}
          {/* UX audit #94 — the coach-credits paywall is retired; the
              "paywall" phase funnels to the SHOP via the effect above.
              The shop sheet (+ its purchase-confirm step) mounts here so
              the end-state render branch can surface it, same as the
              active-game branches. */}
          <ShopSheet
            {...shopSheet.sheetProps}
            onOpenChange={handleShopSheetOpenChange}
            showTrigger={false}
          />
          <PurchaseConfirmSheet {...shopSheet.confirmProps} />
          <ProSheet {...proSheet.sheetProps} />
        </>
      )}
    </main>
  );
}
