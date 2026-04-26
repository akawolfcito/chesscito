"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { Board } from "@/components/board";
import { ExerciseDrawer } from "@/components/play-hub/exercise-drawer";
import { LeaderboardSheet } from "@/components/play-hub/leaderboard-sheet";
import { MissionBriefing } from "@/components/play-hub/mission-briefing";
import { MissionPanelCandy } from "@/components/play-hub/mission-panel-candy";
import { DailyTacticSlot } from "@/components/daily/daily-tactic-slot";
import { MiniArenaBridgeSlot } from "@/components/mini-arena/mini-arena-bridge-slot";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";
import { WelcomeOverlay } from "@/components/welcome/welcome-overlay";
import { ASSET_THEME, THEME_CONFIG } from "@/lib/theme";
import { ContextualActionSlot } from "@/components/play-hub/contextual-action-slot";
import { PersistentDock } from "@/components/play-hub/persistent-dock";
import { TrophiesSheet } from "@/components/play-hub/trophies-sheet";
import { PurchaseConfirmSheet } from "@/components/play-hub/purchase-confirm-sheet";
import { ShopSheet } from "@/components/play-hub/shop-sheet";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { useMiniPay } from "@/hooks/use-minipay";
import { useSplashLoader } from "@/hooks/use-splash-loader";
import { useAutoResetTimer } from "@/hooks/use-auto-reset-timer";
import { badgesAbi } from "@/lib/contracts/badges";
import {
  getBadgesAddress,
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getScoreboardAddress,
  getShopAddress,
} from "@/lib/contracts/chains";
import { getLevelId, scoreboardAbi } from "@/lib/contracts/scoreboard";
import { shopAbi } from "@/lib/contracts/shop";
import { ACCEPTED_TOKENS, erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { CAPTURE_COPY, CTA_LABELS, FOOTER_CTA_COPY, LABYRINTH_COPY, MISSION_BRIEFING_COPY, PIECE_IMAGES, PIECE_LABELS, SHOP_ITEM_COPY, SPLASH_COPY, TUTORIAL_COPY, UNLOCK_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { getPositionLabel, getValidTargets } from "@/lib/game/board";
import type { BoardPosition } from "@/lib/game/types";
import { BadgeEarnedPrompt, PieceCompletePrompt, ResultOverlay } from "@/components/play-hub/result-overlay";
import { BadgeSheet } from "@/components/play-hub/badge-sheet";
import { ArenaEntrySheet } from "@/components/play-hub/arena-entry-sheet";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/telemetry";
import { classifyTxError, isUserCancellation } from "@/lib/errors";
import { getContextAction } from "@/lib/game/context-action";
import { BADGE_THRESHOLD, EXERCISES, LABYRINTHS, labyrinthStars } from "@/lib/game/exercises";
import { getLabyrinthBest, recordLabyrinthBest } from "@/lib/game/labyrinth-progress";
import { LabyrinthCompleteOverlay } from "@/components/play-hub/labyrinth-complete-overlay";
import { computeStars } from "@/lib/game/scoring";
import { hapticReject, hapticSuccess } from "@/lib/haptics";

const SHOP_ITEMS = [
  {
    itemId: 1n,
    label: SHOP_ITEM_COPY.founderBadge.label,
    subtitle: SHOP_ITEM_COPY.founderBadge.subtitle,
  },
  // Shield disabled — no gameplay penalty justifies the cost yet
] as const;


type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

type PieceKey = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";
type CatalogItem = (typeof SHOP_ITEMS)[number] & {
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
};

async function requestSignature(endpoint: "/api/sign-badge" | "/api/sign-score", body: object) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as SignatureResponse;

  if (!response.ok || "error" in payload) {
    throw new Error(payload.error ?? "Could not fetch signature");
  }

  return payload;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function txLink(chainId: number | undefined, txHash: string) {
  const subdomain = chainId === 44787 ? "alfajores." : chainId === 11142220 ? "sepolia." : "";
  return `https://${subdomain}celoscan.io/tx/${txHash}`;
}

/**
 * PlayHubRoot — the entire play-hub experience as a self-contained
 * client component. Both `/` (legacy) and `/hub` (canonical going
 * forward) render this. Lifting it out of app/page.tsx lets the
 * public landing live at `/` while MiniPay players keep their
 * bookmarked play-hub flow at `/hub`.
 */
export function PlayHubRoot() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const { isMiniPay } = useMiniPay();
  const { writeContractAsync: writeScoreAsync, isPending: isScoreWriting } = useWriteContract();
  const { writeContractAsync: writeBadgeAsync, isPending: isBadgeWriting } = useWriteContract();
  const { writeContractAsync: writeShopAsync, isPending: isShopWriting } = useWriteContract();
  const [selectedPiece, setSelectedPiece] = useState<PieceKey>("rook");
  const [phase, setPhase] = useState<"ready" | "success" | "failure">("ready");
  const [boardKey, setBoardKey] = useState(0);
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  // One exclusive dock tab at a time. Persistent-dock game UX: tapping
  // a different tab auto-closes the current one rather than stacking.
  // Per-sheet `open` + `onOpenChange` are derived below so the sheet
  // components don't need to know about this refactor.
  const [activeDockTab, setActiveDockTab] = useState<"badge" | "shop" | "trophies" | "leaderboard" | "arena" | null>(null);
  const storeOpen = activeDockTab === "shop";
  const setStoreOpen = (v: boolean) => setActiveDockTab(v ? "shop" : null);
  const leaderboardOpen = activeDockTab === "leaderboard";
  const setLeaderboardOpen = (v: boolean) => setActiveDockTab(v ? "leaderboard" : null);
  const [selectedItemId, setSelectedItemId] = useState<bigint | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shopTxHash, setShopTxHash] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [submitTxHash, setSubmitTxHash] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [purchasePhase, setPurchasePhase] = useState<"idle" | "approving" | "buying">("idle");
  const [resultOverlay, setResultOverlay] = useState<{
    variant: "badge" | "score" | "shop" | "error";
    txHash?: string;
    errorMessage?: string;
    retryAction?: () => void;
  } | null>(null);

  // Pointer-events lock release: as soon as a result overlay appears,
  // any open dock sheet must be closed or its Radix modal portal
  // continues to intercept clicks on our overlay's scrim/X/CTAs.
  useEffect(() => {
    if (resultOverlay !== null) {
      setActiveDockTab(null);
    }
  }, [resultOverlay]);
  const [showBadgeEarned, setShowBadgeEarned] = useState(false);
  const [showPieceComplete, setShowPieceComplete] = useState(false);
  const badgeSheetOpen = activeDockTab === "badge";
  const setBadgeSheetOpen = (v: boolean) => setActiveDockTab(v ? "badge" : null);
  const arenaSheetOpen = activeDockTab === "arena";
  const setArenaSheetOpen = (v: boolean) => setActiveDockTab(v ? "arena" : null);
  const trophiesSheetOpen = activeDockTab === "trophies";
  const setTrophiesSheetOpen = (v: boolean) => setActiveDockTab(v ? "trophies" : null);
  const [shieldCount, setShieldCount] = useState(0);
  const [claimingPiece, setClaimingPiece] = useState<PieceKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const displayedToast = useRef<string>("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const toastFadeTimer = useRef<ReturnType<typeof setTimeout>>();

  function showToast(msg: string, durationMs = 2000) {
    clearTimeout(toastTimer.current);
    clearTimeout(toastFadeTimer.current);
    displayedToast.current = msg;
    setToast(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => {
      setToastVisible(false);
      toastFadeTimer.current = setTimeout(() => setToast(null), 200);
    }, durationMs);
  }
  const { showSplash, showBriefing, markOnboarded } = useSplashLoader();
  const [exerciseDrawerOpen, setExerciseDrawerOpen] = useState(false);
  const [justClaimed, setJustClaimed] = useState<Record<PieceKey, boolean>>({
    rook: false, bishop: false, knight: false, pawn: false, queen: false, king: false,
  });
  const [unlockedPiece, setUnlockedPiece] = useState<PieceKey | null>(null);

  /** L2 layer toggle. When true, the board renders the active piece's
   *  labyrinth instead of the L1 exercise. Resets to false on piece
   *  switch — labyrinth state does not survive across pieces. */
  const [labyrinthMode, setLabyrinthMode] = useState(false);

  /** Modal trap fix: when the global ResultOverlay opens (success OR
   *  error) while a Radix dock sheet is still mounted, Radix's modal
   *  mode sets pointer-events: none on its siblings, blocking every
   *  click on the result overlay's scrim, X, and CTAs. We close the
   *  active dock tab whenever a result overlay appears so the result
   *  modal becomes the sole foreground and stays dismissable. */
  useEffect(() => {
    setLabyrinthMode(false);
    setLabyrinthCompleted(null);
    setLabyrinthMoves(0);
  }, [selectedPiece]);

  /** Completion snapshot for the L2 overlay. Set when the player
   *  reaches the labyrinth target; cleared on retry or back. */
  const [labyrinthCompleted, setLabyrinthCompleted] = useState<{
    moves: number;
    optimal: number;
    stars: number;
    /** Previous best move count (if any) before this attempt — used
     *  by the overlay to render "New best!" or the historical record. */
    previousBest: number | null;
    /** True when this attempt set a new personal record. */
    isNewBest: boolean;
  } | null>(null);
  /** Bumps the labyrinth board key on retry so internal Board state
   *  (piece position, selection, internal move counter) resets. */
  const [labyrinthKey, setLabyrinthKey] = useState(0);
  /** Live move counter mirrored from the Board's onMove callback.
   *  Drives the labyrinth HUD chip ("X / Y moves") so the player
   *  can pace themselves against the optimal target in real time. */
  const [labyrinthMoves, setLabyrinthMoves] = useState(0);

  const {
    progress,
    currentExercise,
    isLastExercise,
    totalStars,
    badgeEarned,
    isReplay,
    completeExercise,
    advanceExercise,
    goToExercise,
  } = useExerciseProgress(selectedPiece);

  const timerStart = useRef<number>(0);
  /** Synchronous concurrency guard for handleSubmitScore. The async
   *  signature fetch opens a window where wagmi's isPending is still
   *  false; without this ref a rapid double-tap would fire two
   *  parallel sign requests and two writeContractAsync calls before
   *  React could flip the disabled state. Cleared in the finally
   *  branch so retries after failure/timeout still work. */
  const submittingScoreRef = useRef(false);
  // Single source of truth for the board's auto-reset timer. The hook
  // handles the pending-timer-replacement, generation-based stale
  // callback protection, and unmount cleanup that used to be spread
  // across ~8 sites with autoResetTimer.current + boardGeneration.
  const autoReset = useAutoResetTimer();

  const PIECE_ORDER: PieceKey[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];
  const currentPieceIndex = PIECE_ORDER.indexOf(selectedPiece);
  const nextPiece = currentPieceIndex < PIECE_ORDER.length - 1
    ? PIECE_ORDER[currentPieceIndex + 1]
    : null;

  // Dock handoff from /arena: if the arena dock wrote a sheet key before
  // navigating here, open that sheet so the user lands on the surface they
  // tapped. Whitelist-validated so a poisoned storage value can't set an
  // unexpected tab.
  useEffect(() => {
    try {
      const key = sessionStorage.getItem("chesscito:open-sheet");
      if (key === "badge" || key === "shop" || key === "leaderboard" || key === "trophies") {
        setActiveDockTab(key);
      }
      sessionStorage.removeItem("chesscito:open-sheet");
    } catch { /* storage unavailable */ }
  }, []);

  // (Timer cleanup now lives inside useAutoResetTimer.)

  const MAX_SHIELDS = 30; // reasonable cap: 10 purchases × 3 shields each
  useEffect(() => {
    try {
      const raw = localStorage.getItem("chesscito:shields");
      if (raw) {
        const parsed = Number.parseInt(raw, 10) || 0;
        setShieldCount(Math.min(parsed, MAX_SHIELDS));
      }
    } catch {
      // ignore
    }
  }, []);

  function updateShieldCount(next: number) {
    const clamped = Math.max(0, Math.min(next, MAX_SHIELDS));
    setShieldCount(clamped);
    localStorage.setItem("chesscito:shields", String(clamped));
  }


  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  const [paymentToken, setPaymentToken] = useState<typeof ACCEPTED_TOKENS[number] | null>(null);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const levelId = useMemo(() => getLevelId(selectedPiece), [selectedPiece]);
  const POINTS_PER_STAR = 100n;
  const score = useMemo(() => BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR, [totalStars]);

  // v1: tracks last-exercise time only. 1000n fallback after board reset
  // is safe — on-chain time is informational, not used for scoring.
  const timeMs = useMemo(() => {
    if (phase !== "success") {
      return 1000n;
    }

    return BigInt(Math.max(1, elapsedMs));
  }, [elapsedMs, phase]);

  const { data: onChainItems } = useReadContracts({
    contracts: SHOP_ITEMS.map((item) => ({
      address: shopAddress ?? undefined,
      abi: shopAbi,
      functionName: "getItem",
      args: [item.itemId] as const,
      chainId,
    })),
    allowFailure: true,
    query: {
      enabled: Boolean(shopAddress),
      staleTime: 5 * 60_000, // shop items rarely change
    },
  });

  const shopCatalog = useMemo<CatalogItem[]>(
    () =>
      SHOP_ITEMS.map((item, index) => {
        const onChain = onChainItems?.[index];
        if (onChain?.status === "success" && Array.isArray(onChain.result)) {
          const price = onChain.result[0] as bigint;
          const enabled = onChain.result[1] as boolean;
          return {
            ...item,
            configured: price > 0n,
            enabled: price > 0n && enabled,
            onChainPrice: price,
          };
        }

        return {
          ...item,
          configured: false,
          enabled: false,
          onChainPrice: 0n,
        };
      }),
    [onChainItems]
  );

  const selectedItem = useMemo(
    () => shopCatalog.find((item) => item.itemId === selectedItemId) ?? null,
    [selectedItemId, shopCatalog]
  );

  const { data: tokenBalances } = useReadContracts({
    contracts: ACCEPTED_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] as const : undefined,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: Boolean(address), staleTime: 15_000 },
  });

  const { data: paymentAllowance } = useReadContract({
    address: paymentToken?.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && shopAddress ? [address, shopAddress] : undefined,
    chainId,
    query: { enabled: Boolean(address && shopAddress && paymentToken) },
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

  // Read hasClaimedBadge for all 6 pieces (batched)
  const BADGE_LEVEL_IDS = [1n, 2n, 3n, 4n, 5n, 6n] as const;
  const { data: allBadgesData, refetch: refetchAllBadges } = useReadContracts({
    contracts: BADGE_LEVEL_IDS.map((lid) => ({
      address: badgesAddress ?? undefined,
      abi: badgesAbi,
      functionName: "hasClaimedBadge" as const,
      args: address ? [address, lid] as const : undefined,
      chainId,
    })),
    query: {
      enabled: Boolean(address && badgesAddress),
      staleTime: 2 * 60_000, // badges change only after mint
    },
  });

  const badgesClaimed: Record<PieceKey, boolean | undefined> = {
    rook: allBadgesData?.[0]?.result as boolean | undefined,
    bishop: allBadgesData?.[1]?.result as boolean | undefined,
    knight: allBadgesData?.[2]?.result as boolean | undefined,
    pawn: allBadgesData?.[3]?.result as boolean | undefined,
    queen: allBadgesData?.[4]?.result as boolean | undefined,
    king: allBadgesData?.[5]?.result as boolean | undefined,
  };
  const hasClaimedBadge = badgesClaimed[selectedPiece];

  const [pendingShieldCredit, setPendingShieldCredit] = useState(false);
  const { isLoading: isShopConfirming, isSuccess: isShopConfirmed } = useWaitForTransactionReceipt({
    chainId,
    hash: shopTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(shopTxHash),
    },
  });

  useEffect(() => {
    if (isShopConfirmed && pendingShieldCredit) {
      setShieldCount((prev) => {
        const next = Math.max(0, Math.min(prev + 3, MAX_SHIELDS));
        localStorage.setItem("chesscito:shields", String(next));
        return next;
      });
      setPendingShieldCredit(false);
    }
  }, [isShopConfirmed, pendingShieldCredit]);
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({
    chainId,
    hash: claimTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(claimTxHash),
    },
  });
  const { isLoading: isSubmitConfirming } = useWaitForTransactionReceipt({
    chainId,
    hash: submitTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(submitTxHash),
    },
  });

  const canSendOnChain =
    Boolean(address) &&
    isConnected &&
    isCorrectChain &&
    levelId > 0n &&
    badgeEarned;
  const isClaimBusy = isBadgeWriting || isClaimConfirming;
  const isSubmitBusy = isScoreWriting || isSubmitConfirming;
  const isShopBusy = isShopWriting || isShopConfirming;

  const allExercisesAttempted = progress.stars.every(s => s > 0);

  const contextAction = getContextAction({
    phase,
    shieldsAvailable: shieldCount,
    scorePending: canSendOnChain && allExercisesAttempted,
    badgeClaimable: badgeEarned && !hasClaimedBadge && !justClaimed[selectedPiece],
    isConnected,
    isCorrectChain,
  });

  async function writeWithOptionalFeeCurrency(
    writer: typeof writeScoreAsync,
    request: Parameters<typeof writeScoreAsync>[0],
  ) {
    try {
      const feeManagedRequest = feeCurrency
        ? ({
            ...request,
            feeCurrency,
          } as unknown as Parameters<typeof writeScoreAsync>[0])
        : request;
      return await writer(feeManagedRequest);
    } catch (error) {
      if (!feeCurrency) {
        throw error;
      }

      return writer(request);
    }
  }

  function resetBoard() {
    autoReset.clear();
    setBoardKey((previous) => previous + 1);
    setPhase("ready");
    setMoves(0);
    setElapsedMs(0);
    timerStart.current = 0;
  }

  function handleMove(position: BoardPosition, movesCount: number) {
    const isTarget =
      position.file === currentExercise.targetPos.file &&
      position.rank === currentExercise.targetPos.rank;

    setMoves(movesCount);
    if (movesCount === 1) timerStart.current = Date.now();

    if (isTarget) {
      hapticSuccess();
      setPhase("success");
      const elapsed = timerStart.current > 0 ? Date.now() - timerStart.current : 1000;
      setElapsedMs(elapsed);
      completeExercise(movesCount);
      track("exercise_complete", {
        piece: selectedPiece,
        exercise_id: currentExercise.id,
        moves: movesCount,
        optimal_moves: currentExercise.optimalMoves,
        elapsed_ms: elapsed,
        is_capture: Boolean(currentExercise.isCapture),
        is_replay: isReplay,
      });

      // On last exercise: check if badge is earned (including this completion)
      if (isLastExercise && !isReplay) {
        const exercise = EXERCISES[selectedPiece][progress.exerciseIndex];
        const newStars = computeStars(movesCount, exercise.optimalMoves);
        const prevStarValue = progress.stars[progress.exerciseIndex];
        const starDelta = Math.max(0, newStars - prevStarValue);
        const newTotal = totalStars + starDelta;

        if (newTotal >= BADGE_THRESHOLD && !hasClaimedBadge) {
          setShowBadgeEarned(true);
          // Safety-net: auto-dismiss badge prompt and reset board if user
          // doesn't interact within 15 seconds (prevents phase stuck forever)
          autoReset.schedule(() => {
            setShowBadgeEarned(false);
            setShowPieceComplete(true);
          }, 15_000);
          return;
        }
      }

      autoReset.schedule(() => {
        if (!isLastExercise) {
          advanceExercise();
          resetBoard();
        } else {
          // Last exercise — show completion guide instead of silent reset
          setShowPieceComplete(true);
        }
      }, 1500);
      return;
    }

    // Solo ejercicios de 1 movimiento: el primer click incorrecto = auto-reset
    // Ejercicios multi-movimiento: el jugador sigue navegando libremente
    if (currentExercise.optimalMoves === 1) {
      hapticReject();
      setPhase("failure");
      track("exercise_fail", {
        piece: selectedPiece,
        exercise_id: currentExercise.id,
        moves: movesCount,
        is_capture: Boolean(currentExercise.isCapture),
      });
      autoReset.schedule(() => resetBoard(), 1500);
    }
  }

  function handleUseShield() {
    if (phase !== "failure" || shieldCount <= 0) return;
    updateShieldCount(shieldCount - 1);
    resetBoard();
  }

  function handleExerciseNavigate(index: number) {
    autoReset.invalidate();
    // Mirror the piece-rail handler: dismiss end-of-piece overlays so a
    // mid-overlay exercise jump can't leave them stuck on stale data.
    // resultOverlay / tx hashes are intentionally left alone — those
    // belong to the player to dismiss explicitly.
    setShowBadgeEarned(false);
    setShowPieceComplete(false);
    goToExercise(index);
    resetBoard();
  }

  function handleBadgeEarnedDismiss() {
    autoReset.clear();
    setShowBadgeEarned(false);
    setShowPieceComplete(true);
  }

  async function handleClaimBadge(piece?: PieceKey) {
    const claimLevelId = piece ? getLevelId(piece) : levelId;
    if (!address || !badgesAddress || !isConnected || !isCorrectChain || claimLevelId <= 0n) {
      return;
    }
    // Prevent double-claim (stale cache or rapid taps)
    const targetPiece = piece ?? selectedPiece;
    if (badgesClaimed[targetPiece] || isClaimBusy) return;

    setLastError(null);
    setClaimingPiece(targetPiece);
    track("badge_claim_tx", { stage: "start", piece: targetPiece });

    try {
      const signed = await requestSignature("/api/sign-badge", {
        player: address,
        levelId: Number(claimLevelId),
      });

      const txHash = await writeWithOptionalFeeCurrency(writeBadgeAsync, {
        address: badgesAddress,
        abi: badgesAbi,
        functionName: "claimBadgeSigned" as const,
        args: [claimLevelId, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
        chainId,
        account: address,
      });

      hapticSuccess();
      setClaimTxHash(txHash);
      track("badge_claim_tx", { stage: "success", piece: targetPiece });
      setJustClaimed(prev => ({ ...prev, [targetPiece]: true }));
      void refetchAllBadges();
      // Queue unlock celebration for the next piece
      const claimedIndex = PIECE_ORDER.indexOf(targetPiece);
      const nextUnlock = claimedIndex < PIECE_ORDER.length - 1 ? PIECE_ORDER[claimedIndex + 1] : null;
      if (nextUnlock) {
        setUnlockedPiece(nextUnlock);
        track("modal_open", { id: "piece-unlocked", piece: nextUnlock });
      }
      setResultOverlay({
        variant: "badge",
        txHash,
      });
      console.info("[MiniPayTx] result", { label: "claim-badge", txHash, levelId: Number(claimLevelId) });
    } catch (error) {
      if (isUserCancellation(error)) {
        track("badge_claim_tx", { stage: "cancelled", piece: targetPiece });
        return;
      }
      const message = toErrorMessage(error);
      setLastError(message);
      track("badge_claim_tx", { stage: "error", piece: targetPiece, error_kind: classifyTxError(error) });
      setResultOverlay({
        variant: "error",
        errorMessage: classifyTxError(error),
        retryAction: () => void handleClaimBadge(piece),
      });
      console.warn("[MiniPayTx] error", { label: "claim-badge", levelId: Number(claimLevelId), error: message });
    } finally {
      setClaimingPiece(null);
    }
  }

  async function handleSubmitScore() {
    if (!canSendOnChain || !address || !scoreboardAddress || isSubmitBusy) {
      return;
    }
    // Sync guard closes the await-the-signature-fetch race window the
    // wagmi-derived isSubmitBusy flag can't cover.
    if (submittingScoreRef.current) {
      return;
    }
    submittingScoreRef.current = true;

    setLastError(null);
    track("score_submit_tx", { stage: "start", piece: selectedPiece });

    try {
      const signed = await requestSignature("/api/sign-score", {
        player: address,
        levelId: Number(levelId),
        score: Number(score),
        timeMs: Number(timeMs),
      });

      const txHash = await writeWithOptionalFeeCurrency(writeScoreAsync, {
        address: scoreboardAddress,
        abi: scoreboardAbi,
        functionName: "submitScoreSigned" as const,
        args: [levelId, score, timeMs, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
        chainId,
        account: address,
      });

      hapticSuccess();
      setSubmitTxHash(txHash);
      track("score_submit_tx", { stage: "success", piece: selectedPiece });
      setResultOverlay({
        variant: "score",
        txHash,
      });
      console.info("[MiniPayTx] result", { label: "submit-score", txHash, levelId: Number(levelId) });

      // Write-through to Supabase (fire-and-forget)
      void fetch("/api/cache-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          levelId: Number(levelId),
          score: Number(score),
          timeMs: Number(timeMs),
          txHash: txHash,
        }),
      }).catch(() => {});

      // Optimistic entry for leaderboard
      try {
        sessionStorage.setItem(
          "chesscito:optimistic-score",
          JSON.stringify({
            player: address.toLowerCase(),
            score: Number(score),
            levelId: Number(levelId),
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
    } catch (error) {
      if (isUserCancellation(error)) {
        track("score_submit_tx", { stage: "cancelled", piece: selectedPiece });
        showToast(FOOTER_CTA_COPY.submitCanceled, 2000);
        return;
      }
      const message = toErrorMessage(error);
      setLastError(message);
      track("score_submit_tx", { stage: "error", piece: selectedPiece, error_kind: classifyTxError(error) });
      setResultOverlay({
        variant: "error",
        errorMessage: classifyTxError(error),
        retryAction: () => void handleSubmitScore(),
      });
      showToast(FOOTER_CTA_COPY.submitFailed, 3000);
      console.warn("[MiniPayTx] error", { label: "submit-score", levelId: Number(levelId), error: message });
    } finally {
      submittingScoreRef.current = false;
    }
  }

  async function handleConfirmPurchase() {
    if (!selectedItem || !address || !shopAddress || !isCorrectChain) {
      return;
    }
    if (!selectedItem.configured) {
      setLastError("This item is not available yet");
      return;
    }
    if (!selectedItem.enabled) {
      setLastError("This item is currently unavailable");
      return;
    }
    if (!paymentToken) {
      setLastError("Not enough funds to complete this purchase");
      return;
    }

    const unitPrice = selectedItem.onChainPrice;
    const normalizedTotal = normalizePrice(unitPrice, paymentToken.decimals);

    setLastError(null);
    console.info("[MiniPayTx] request", {
      label: selectedItem.label,
      itemId: selectedItem.itemId.toString(),
      total: normalizedTotal.toString(),
      currency: paymentToken.symbol,
      chainId,
      shopAddress,
    });

    try {
      // Read allowance fresh (not from hook cache) to avoid duplicate approvals on retry
      const freshAllowance = publicClient
        ? ((await publicClient.readContract({
            address: paymentToken.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, shopAddress],
          })) as bigint)
        : 0n;
      if (freshAllowance < normalizedTotal) {
        setPurchasePhase("approving");
        const approveHash = await writeWithOptionalFeeCurrency(writeShopAsync, {
          address: paymentToken.address,
          abi: erc20Abi,
          functionName: "approve" as const,
          args: [shopAddress, normalizedTotal] as const,
          chainId,
          account: address,
        });
        console.info("[MiniPayTx] result", {
          label: `${selectedItem.label} approve (${paymentToken.symbol})`,
          txHash: approveHash,
        });

        if (!publicClient) {
          throw new Error("Missing public client for approval confirmation");
        }

        await waitForReceiptWithTimeout(publicClient, approveHash);
      }

      setPurchasePhase("buying");
      const buyHash = await writeWithOptionalFeeCurrency(writeShopAsync, {
        address: shopAddress,
        abi: shopAbi,
        functionName: "buyItem" as const,
        args: [selectedItem.itemId, 1n, paymentToken.address] as const,
        chainId,
        account: address,
      });

      setShopTxHash(buyHash);
      setConfirmOpen(false);
      setStoreOpen(false);
      setSelectedItemId(null);
      setResultOverlay({
        variant: "shop",
        txHash: buyHash,
      });
      console.info("[MiniPayTx] result", {
        label: selectedItem.label,
        txHash: buyHash,
      });
    } catch (error) {
      if (isUserCancellation(error)) return;
      setConfirmOpen(false);
      const message = toErrorMessage(error);
      setLastError(message);
      setResultOverlay({
        variant: "error",
        errorMessage: classifyTxError(error),
      });
      console.warn("[MiniPayTx] error", {
        label: selectedItem.label,
        error: message,
      });
    } finally {
      setPurchasePhase("idle");
    }
  }

  /** Active exercise — switches to the labyrinth when L2 layer is on
   *  and the piece has at least one labyrinth defined. Falls back to
   *  the L1 currentExercise otherwise. */
  const labyrinthList = LABYRINTHS[selectedPiece] ?? [];
  const labyrinthAvailable = labyrinthList.length > 0 && (badgeEarned || totalStars >= BADGE_THRESHOLD);
  const activeLabyrinth = labyrinthMode && labyrinthList.length > 0 ? labyrinthList[0] : null;
  const activeExercise = activeLabyrinth ?? currentExercise;

  /** Labyrinth move handler — fires the completion overlay when the
   *  player reaches the target. The Board's internal counter is the
   *  source of truth for move count. */
  const handleLabyrinthMove = useCallback(
    (position: BoardPosition, movesCount: number) => {
      if (!activeLabyrinth) return;
      // Mirror the Board's internal counter to drive the live HUD
      // chip. Fires on every move; the completion check below only
      // runs when the player lands on the target square.
      setLabyrinthMoves(movesCount);
      const reached =
        position.file === activeLabyrinth.targetPos.file &&
        position.rank === activeLabyrinth.targetPos.rank;
      if (!reached) return;
      const stars = labyrinthStars(movesCount, activeLabyrinth.optimalMoves);
      // Read previous best BEFORE recording so the overlay can
      // contextualize the new score against the player's history.
      const previousBest = getLabyrinthBest(selectedPiece, activeLabyrinth.id);
      const isNewBest = recordLabyrinthBest(
        selectedPiece,
        activeLabyrinth.id,
        movesCount,
      );
      setLabyrinthCompleted({
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        previousBest,
        isNewBest,
      });
      track("labyrinth_complete", {
        labyrinth_id: activeLabyrinth.id,
        piece: selectedPiece,
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        is_new_best: isNewBest,
        previous_best: previousBest ?? null,
      });
    },
    [activeLabyrinth, selectedPiece],
  );

  const targetLabel = activeLabyrinth
    ? // Labyrinth chip becomes a live counter: "0 / 4 · optimal" (no
      //  moves yet) → "3 / 4 · optimal" (live) → "5 / 4 · over" past
      //  optimal so the player can pace themselves in real time.
      `${labyrinthMoves} / ${activeLabyrinth.optimalMoves} moves`
    : activeExercise.isCapture
      ? CAPTURE_COPY.statsLabel
      : `${String.fromCharCode(97 + activeExercise.targetPos.file)}${activeExercise.targetPos.rank + 1}`;

  const pieceHint = activeLabyrinth
    ? `${LABYRINTH_COPY.missionTitle} · ${LABYRINTH_COPY.missionHint(activeLabyrinth.optimalMoves)}`
    : currentExercise.isCapture
      ? MISSION_BRIEFING_COPY.captureHintCompact
      : MISSION_BRIEFING_COPY.pieceHint[selectedPiece];

  // Show movement lane hints on the first exercise of each piece (until the player earns stars)
  const tutorialHints = useMemo(() => {
    if (progress.exerciseIndex !== 0 || progress.stars[0] > 0) return undefined;
    const targets = getValidTargets(selectedPiece, currentExercise.startPos);
    return new Set(targets.map(getPositionLabel));
  }, [selectedPiece, progress.exerciseIndex, progress.stars, currentExercise.startPos]);

  return (
    <div className="relative w-full overflow-x-hidden">
      <WelcomeOverlay />
      {showSplash && (
        <div className="playhub-intro-overlay is-active" role="status" aria-live="polite" aria-busy="true">
          {/* Splash art carries the visual; copy below provides status. */}
          <p className="text-sm font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] animate-pulse">{SPLASH_COPY.loading}</p>
          <p className="text-xs text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{SPLASH_COPY.subtitle}</p>
        </div>
      )}
      <main className="mission-shell mx-auto h-[100dvh] w-full max-w-[var(--app-max-width)] px-0 py-0 sm:px-0">
        <MissionPanelCandy
          selectedPiece={selectedPiece}
          onSelectPiece={(piece) => {
            autoReset.invalidate();
            setSelectedPiece(piece);
            setResultOverlay(null);
            setClaimTxHash(null);
            setSubmitTxHash(null);
            setShowBadgeEarned(false);
            setShowPieceComplete(false);
            resetBoard();
          }}
          pieces={[
            { key: "rook", label: PIECE_LABELS.rook, enabled: true },
            { key: "bishop", label: PIECE_LABELS.bishop, enabled: true },
            { key: "knight", label: PIECE_LABELS.knight, enabled: true },
            { key: "pawn", label: PIECE_LABELS.pawn, enabled: true },
            { key: "queen", label: PIECE_LABELS.queen, enabled: false },
            { key: "king", label: PIECE_LABELS.king, enabled: false },
          ]}
          phase={phase}
          targetLabel={targetLabel}
          pieceHint={pieceHint}
          isCapture={Boolean(currentExercise.isCapture)}
          isDockSheetOpen={activeDockTab !== null}
          labyrinthAvailable={labyrinthAvailable}
          labyrinthMode={labyrinthMode}
          onToggleLabyrinth={(next) => {
            setLabyrinthMode(next);
            setLabyrinthMoves(0);
          }}
          score={score.toString()}
          timeMs={timeMs.toString()}
          currentStars={totalStars}
          claimedBadges={badgesClaimed}
          actionRowLeft={<DailyTacticSlot compact />}
          actionRowRight={
            <MiniArenaBridgeSlot
              setup={MINI_ARENA_SETUPS[0]}
              unlocked={selectedPiece === "rook" && totalStars >= 12}
              compact
            />
          }
          contextualAction={
            <ContextualActionSlot
              action={contextAction}
              shieldsAvailable={shieldCount}
              isBusy={isScoreWriting || isBadgeWriting || isSubmitConfirming || isClaimConfirming}
              onSubmitScore={() => void handleSubmitScore()}
              onUseShield={handleUseShield}
              onClaimBadge={() => void handleClaimBadge()}
              onRetry={() => resetBoard()}
              onConnectWallet={() => openConnectModal?.()}
              onSwitchNetwork={() => configuredChainId != null && switchChain({ chainId: configuredChainId })}
              compact
            />
          }
          persistentDock={
            <PersistentDock
              activeDockTab={activeDockTab}
              badgeControl={
                <BadgeSheet
                  open={badgeSheetOpen}
                  onOpenChange={(v) => { if (!v && isClaimBusy) return; setBadgeSheetOpen(v); }}
                  badgesClaimed={badgesClaimed}
                  onClaim={(piece) => void handleClaimBadge(piece)}
                  isClaimBusy={isClaimBusy}
                  claimingPiece={claimingPiece}
                  showNotification={canSendOnChain && !Boolean(hasClaimedBadge)}
                  onNavigateToTrophies={() => setActiveDockTab("trophies")}
                />
              }
              shopControl={
                <ShopSheet
                  open={storeOpen}
                  onOpenChange={setStoreOpen}
                  items={shopCatalog}
                  onSelectItem={(itemId) => {
                    setSelectedItemId(itemId);
                    const item = shopCatalog.find((i) => i.itemId === itemId);
                    if (item) setPaymentToken(selectPaymentToken(item.onChainPrice));
                    setStoreOpen(false);
                    setConfirmOpen(true);
                  }}
                />
              }
              leaderboardControl={
                <LeaderboardSheet open={leaderboardOpen} onOpenChange={setLeaderboardOpen} />
              }
              arenaControl={
                <ArenaEntrySheet
                  open={arenaSheetOpen}
                  onOpenChange={setArenaSheetOpen}
                  trigger={
                    <button
                      type="button"
                      aria-label="Free Play"
                      className="flex h-full w-full items-center justify-center"
                    >
                      <CandyBanner name="btn-battle" className="h-9 w-9" />
                    </button>
                  }
                />
              }
              trophiesControl={
                <TrophiesSheet
                  open={trophiesSheetOpen}
                  onOpenChange={setTrophiesSheetOpen}
                />
              }
            />
          }
          board={
            <Board
              key={`${boardKey}-${labyrinthMode ? `lab-${labyrinthKey}` : "ex"}`}
              pieceType={selectedPiece}
              startPosition={activeExercise.startPos}
              mode={activeLabyrinth ? "labyrinth" : "practice"}
              targetPosition={activeExercise.targetPos}
              obstacles={activeLabyrinth?.obstacles}
              isLocked={!activeLabyrinth ? (phase === "failure" || phase === "success") : labyrinthCompleted !== null}
              onMove={activeLabyrinth ? handleLabyrinthMove : handleMove}
              isCapture={!activeLabyrinth && activeExercise.isCapture}
              tutorialHints={activeLabyrinth ? undefined : tutorialHints}
            />
          }
          exerciseDrawer={
            <ExerciseDrawer
              open={exerciseDrawerOpen}
              onOpenChange={setExerciseDrawerOpen}
              piece={selectedPiece}
              exercises={EXERCISES[selectedPiece]}
              stars={progress.stars}
              activeIndex={progress.exerciseIndex}
              totalStars={totalStars}
              onNavigate={handleExerciseNavigate}
            />
          }
          isReplay={isReplay}
        />

        <PurchaseConfirmSheet
          open={confirmOpen}
          onOpenChange={(open) => {
            if (!open && purchasePhase !== "idle") return;
            setConfirmOpen(open);
            if (!open) {
              setSelectedItemId(null);
            }
          }}
          selectedItem={selectedItem}
          chainId={chainId}
          shopAddress={shopAddress}
          paymentTokenSymbol={paymentToken?.symbol ?? null}
          isConnected={isConnected}
          isCorrectChain={isCorrectChain}
          isWriting={isShopWriting}
          purchasePhase={purchasePhase}
          onConfirm={() => void handleConfirmPurchase()}
        />

        {showBriefing ? (
          <MissionBriefing
            pieceType={selectedPiece}
            targetLabel={targetLabel}
            isCapture={Boolean(currentExercise.isCapture)}
            onPlay={() => markOnboarded()}
          />
        ) : null}

        {showPieceComplete && !showBadgeEarned ? (
          <PieceCompletePrompt
            pieceType={selectedPiece}
            nextPiece={nextPiece ?? null}
            hasClaimedBadge={!!hasClaimedBadge}
            totalStars={totalStars}
            onNextPiece={() => {
              setShowPieceComplete(false);
              if (nextPiece) setSelectedPiece(nextPiece);
              resetBoard();
            }}
            onArena={() => {
              setShowPieceComplete(false);
              window.location.href = "/arena";
            }}
            onPracticeAgain={() => {
              setShowPieceComplete(false);
              resetBoard();
            }}
            onTryLabyrinth={
              labyrinthList.length > 0
                ? () => {
                    setShowPieceComplete(false);
                    setLabyrinthMode(true);
                    resetBoard();
                  }
                : undefined
            }
            onSubmitScore={
              canSendOnChain
                ? () => {
                    setShowPieceComplete(false);
                    void handleSubmitScore();
                  }
                : undefined
            }
          />
        ) : null}

        {labyrinthCompleted ? (
          <LabyrinthCompleteOverlay
            moves={labyrinthCompleted.moves}
            optimalMoves={labyrinthCompleted.optimal}
            stars={labyrinthCompleted.stars}
            previousBest={labyrinthCompleted.previousBest}
            isNewBest={labyrinthCompleted.isNewBest}
            onRetry={() => {
              setLabyrinthCompleted(null);
              setLabyrinthKey((k) => k + 1);
              setLabyrinthMoves(0);
            }}
            onBack={() => {
              setLabyrinthCompleted(null);
              setLabyrinthMode(false);
              setLabyrinthMoves(0);
            }}
          />
        ) : null}

        {showBadgeEarned ? (
          <BadgeEarnedPrompt
            pieceType={selectedPiece}
            totalStars={totalStars}
            onSubmitScore={() => {
              autoReset.clear();
              setShowBadgeEarned(false);
              void handleSubmitScore();
            }}
            onLater={handleBadgeEarnedDismiss}
          />
        ) : null}

        {resultOverlay ? (
          <ResultOverlay
            variant={resultOverlay.variant}
            pieceType={selectedPiece}
            itemLabel={selectedItem?.label}
            txHash={resultOverlay.txHash}
            celoscanHref={resultOverlay.txHash ? txLink(chainId, resultOverlay.txHash) : undefined}
            errorMessage={resultOverlay.errorMessage}
            totalStars={totalStars}
            onDismiss={() => setResultOverlay(null)}
            onRetry={resultOverlay.retryAction}
          />
        ) : null}

        {unlockedPiece && !resultOverlay && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim animate-in fade-in duration-250"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative z-10 mx-4 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
              <CandyGlassShell
                title={UNLOCK_COPY.title(PIECE_LABELS[unlockedPiece])}
                onClose={() => setUnlockedPiece(null)}
                closeLabel="Close"
                cta={
                  <Button
                    type="button"
                    variant="game-primary"
                    size="game"
                    autoFocus
                    onClick={() => {
                      setUnlockedPiece(null);
                      setSelectedPiece(unlockedPiece);
                      resetBoard();
                    }}
                    className="w-full"
                  >
                    {UNLOCK_COPY.cta(PIECE_LABELS[unlockedPiece])}
                  </Button>
                }
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="pointer-events-none absolute h-36 w-36">
                      <LottieAnimation src="/animations/sparkle-burst.lottie" loop={false} className="h-full w-full" />
                    </div>
                    <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_50%,transparent_75%)]" />
                    <picture className="relative z-10 h-20 w-20">
                      {THEME_CONFIG.hasOptimizedFormats && (
                        <>
                          <source srcSet={`${PIECE_IMAGES[unlockedPiece]}.avif`} type="image/avif" />
                          <source srcSet={`${PIECE_IMAGES[unlockedPiece]}.webp`} type="image/webp" />
                        </>
                      )}
                      <img src={`${PIECE_IMAGES[unlockedPiece]}.png`} alt={PIECE_LABELS[unlockedPiece]} className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(120,65,5,0.35)]" />
                    </picture>
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: "rgba(110, 65, 15, 0.85)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                    }}
                  >
                    {TUTORIAL_COPY[unlockedPiece]}
                  </p>
                </div>
              </CandyGlassShell>
            </div>
          </div>
        )}

        <div
          className={`fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            toastVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.45)",
            color: "rgba(110, 65, 15, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 4px 14px rgba(120, 65, 5, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
          }}
        >
          {toast ?? displayedToast.current}
        </div>
      </main>
    </div>
  );
}
