"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { Board } from "@/components/board";
import { ExerciseDrawer } from "@/components/play-hub/exercise-drawer";
import { LeaderboardSheet } from "@/components/play-hub/leaderboard-sheet";
import { MissionBriefing } from "@/components/play-hub/mission-briefing";
import { MissionPanel } from "@/components/play-hub/mission-panel";
import { ContextualActionSlot } from "@/components/play-hub/contextual-action-slot";
import { InviteButton } from "@/components/play-hub/invite-button";
import { PersistentDock } from "@/components/play-hub/persistent-dock";
import { PurchaseConfirmSheet } from "@/components/play-hub/purchase-confirm-sheet";
import { ShopSheet } from "@/components/play-hub/shop-sheet";
import { StatusStrip } from "@/components/play-hub/status-strip";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { useMiniPay } from "@/hooks/use-minipay";
import { useSplashLoader } from "@/hooks/use-splash-loader";
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
import { CAPTURE_COPY, CTA_LABELS, MISSION_BRIEFING_COPY, PIECE_LABELS, SHIELD_COPY } from "@/lib/content/editorial";
import { getPositionLabel, getValidTargets } from "@/lib/game/board";
import type { BoardPosition } from "@/lib/game/types";
import { BadgeEarnedPrompt, ResultOverlay } from "@/components/play-hub/result-overlay";
import { BadgeSheet } from "@/components/play-hub/badge-sheet";
import { classifyTxError, isUserCancellation } from "@/lib/errors";
import { getContextAction } from "@/lib/game/context-action";
import { BADGE_THRESHOLD, EXERCISES } from "@/lib/game/exercises";
import { computeStars } from "@/lib/game/scoring";

const SHOP_ITEMS = [
  {
    itemId: 1n,
    label: "Founder Badge",
    subtitle: "Support Chesscito with an exclusive founder badge minted to your wallet.",
  },
  {
    itemId: 2n,
    label: "Retry Shield",
    subtitle: `${SHIELD_COPY.subtitle} (3 uses)`,
  },
] as const;


type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

type PieceKey = "rook" | "bishop" | "knight";
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

export default function PlayHubPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { isMiniPay } = useMiniPay();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [selectedPiece, setSelectedPiece] = useState<PieceKey>("rook");
  const [phase, setPhase] = useState<"ready" | "success" | "failure">("ready");
  const [boardKey, setBoardKey] = useState(0);
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [storeOpen, setStoreOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
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
  const [showBadgeEarned, setShowBadgeEarned] = useState(false);
  const [badgeSheetOpen, setBadgeSheetOpen] = useState(false);
  const [shieldCount, setShieldCount] = useState(0);
  const [qaLevelInput, setQaLevelInput] = useState("2");
  const [isLocalhost, setIsLocalhost] = useState(false);
  const { showSplash, showBriefing, markOnboarded } = useSplashLoader();
  const [exerciseDrawerOpen, setExerciseDrawerOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const {
    progress,
    currentExercise,
    isLastExercise,
    totalStars,
    badgeEarned,
    pieceCompleted,
    isReplay,
    completeExercise,
    advanceExercise,
    goToExercise,
    markCompleted,
  } = useExerciseProgress(selectedPiece);

  const autoResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerStart = useRef<number>(0);
  const boardGeneration = useRef(0);

  const PIECE_ORDER: PieceKey[] = ["rook", "bishop", "knight"];
  const currentPieceIndex = PIECE_ORDER.indexOf(selectedPiece);
  const nextPiece = currentPieceIndex < PIECE_ORDER.length - 1
    ? PIECE_ORDER[currentPieceIndex + 1]
    : null;

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocalhost(host === "localhost" || host === "127.0.0.1" || host === "::1");
  }, []);

  // Cleanup autoResetTimer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
    };
  }, []);

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
  const defaultLevelId = useMemo(() => getLevelId(selectedPiece), [selectedPiece]);
  const qaEnabled = useMemo(
    () => process.env.NEXT_PUBLIC_QA_MODE === "1" && isLocalhost,
    [isLocalhost]
  );
  const qaLevel = useMemo(() => Number.parseInt(qaLevelInput, 10), [qaLevelInput]);
  const isQaLevelValid = Number.isInteger(qaLevel) && qaLevel >= 1 && qaLevel <= 9999;
  const levelId = useMemo(
    () => (qaEnabled ? (isQaLevelValid ? BigInt(qaLevel) : 0n) : defaultLevelId),
    [defaultLevelId, isQaLevelValid, qaEnabled, qaLevel]
  );
  const POINTS_PER_STAR = 100n;
  const score = useMemo(() => BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR, [totalStars]);
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

  // Read hasClaimedBadge for all 3 pieces (batched)
  const { data: allBadgesData, refetch: refetchAllBadges } = useReadContracts({
    contracts: ([1n, 2n, 3n] as const).map((lid) => ({
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
    badgeEarned &&
    !pieceCompleted;
  const isClaimBusy = isWriting || isClaimConfirming;
  const isSubmitBusy = isWriting || isSubmitConfirming;

  const contextAction = getContextAction({
    phase,
    shieldsAvailable: shieldCount,
    scorePending: canSendOnChain,
    badgeClaimable: badgeEarned && !hasClaimedBadge,
    isConnected,
    isCorrectChain,
  });

  async function writeWithOptionalFeeCurrency(request: Parameters<typeof writeContractAsync>[0]) {
    try {
      const feeManagedRequest = feeCurrency
        ? ({
            ...request,
            feeCurrency,
          } as unknown as Parameters<typeof writeContractAsync>[0])
        : request;
      return await writeContractAsync(feeManagedRequest);
    } catch (error) {
      if (!feeCurrency) {
        throw error;
      }

      return writeContractAsync(request);
    }
  }

  function resetBoard() {
    if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
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
      setPhase("success");
      setElapsedMs(timerStart.current > 0 ? Date.now() - timerStart.current : 1000);
      completeExercise(movesCount);

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
          const gen = boardGeneration.current;
          autoResetTimer.current = setTimeout(() => {
            if (gen !== boardGeneration.current) return;
            setShowBadgeEarned(false);
            resetBoard();
          }, 15_000);
          return;
        }
      }

      const gen = boardGeneration.current;
      autoResetTimer.current = setTimeout(() => {
        if (gen !== boardGeneration.current) return; // stale — user navigated
        if (!isLastExercise) {
          advanceExercise();
          resetBoard();
        } else if (nextPiece && pieceCompleted) {
          setSelectedPiece(nextPiece);
          resetBoard();
        } else {
          resetBoard();
        }
      }, 1500);
      return;
    }

    // Solo ejercicios de 1 movimiento: el primer click incorrecto = auto-reset
    // Ejercicios multi-movimiento: el jugador sigue navegando libremente
    if (currentExercise.optimalMoves === 1) {
      setPhase("failure");
      autoResetTimer.current = setTimeout(() => {
        resetBoard();
      }, 1500);
    }
  }

  function handleUseShield() {
    if (phase !== "failure" || shieldCount <= 0) return;
    updateShieldCount(shieldCount - 1);
    resetBoard();
  }

  function handleExerciseNavigate(index: number) {
    if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
    boardGeneration.current++;
    goToExercise(index);
    resetBoard();
  }

  function handleBadgeEarnedDismiss() {
    if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
    setShowBadgeEarned(false);
    const gen = boardGeneration.current;
    autoResetTimer.current = setTimeout(() => {
      if (gen !== boardGeneration.current) return; // stale — user navigated
      if (nextPiece && pieceCompleted) {
        setSelectedPiece(nextPiece);
        resetBoard();
      } else {
        resetBoard();
      }
    }, 500);
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

    try {
      const signed = await requestSignature("/api/sign-badge", {
        player: address,
        levelId: Number(claimLevelId),
      });

      const txHash = await writeWithOptionalFeeCurrency({
        address: badgesAddress,
        abi: badgesAbi,
        functionName: "claimBadgeSigned" as const,
        args: [claimLevelId, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
        chainId,
        account: address,
      });

      setClaimTxHash(txHash);
      void refetchAllBadges();
      setResultOverlay({
        variant: "badge",
        txHash,
      });
      console.info("[MiniPayTx] result", { label: "claim-badge", txHash, levelId: Number(claimLevelId) });
    } catch (error) {
      if (isUserCancellation(error)) return;
      const message = toErrorMessage(error);
      setLastError(message);
      setResultOverlay({
        variant: "error",
        errorMessage: classifyTxError(error),
        retryAction: () => void handleClaimBadge(piece),
      });
      console.warn("[MiniPayTx] error", { label: "claim-badge", levelId: Number(claimLevelId), error: message });
    }
  }

  async function handleSubmitScore() {
    if (!canSendOnChain || !address || !scoreboardAddress) {
      return;
    }

    setLastError(null);

    try {
      const signed = await requestSignature("/api/sign-score", {
        player: address,
        levelId: Number(levelId),
        score: Number(score),
        timeMs: Number(timeMs),
      });

      const txHash = await writeWithOptionalFeeCurrency({
        address: scoreboardAddress,
        abi: scoreboardAbi,
        functionName: "submitScoreSigned" as const,
        args: [levelId, score, timeMs, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
        chainId,
        account: address,
      });

      setSubmitTxHash(txHash);
      markCompleted();
      setResultOverlay({
        variant: "score",
        txHash,
      });
      console.info("[MiniPayTx] result", { label: "submit-score", txHash, levelId: Number(levelId) });
    } catch (error) {
      if (isUserCancellation(error)) return;
      const message = toErrorMessage(error);
      setLastError(message);
      setResultOverlay({
        variant: "error",
        errorMessage: classifyTxError(error),
        retryAction: () => void handleSubmitScore(),
      });
      console.warn("[MiniPayTx] error", { label: "submit-score", levelId: Number(levelId), error: message });
    }
  }

  async function handleConfirmPurchase() {
    if (!selectedItem || !address || !shopAddress || !isCorrectChain) {
      return;
    }
    if (!selectedItem.configured) {
      setLastError(`Item ${selectedItem.itemId.toString()} is not configured on-chain`);
      return;
    }
    if (!selectedItem.enabled) {
      setLastError(`Item ${selectedItem.itemId.toString()} is disabled`);
      return;
    }
    if (!paymentToken) {
      setLastError("No accepted token with sufficient balance");
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
        const approveHash = await writeWithOptionalFeeCurrency({
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

        await publicClient.waitForTransactionReceipt({
          hash: approveHash,
        });
      }

      setPurchasePhase("buying");
      const buyHash = await writeWithOptionalFeeCurrency({
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
      if (selectedItem.itemId === 2n) {
        setPendingShieldCredit(true);
      }
      console.info("[MiniPayTx] result", {
        label: selectedItem.label,
        txHash: buyHash,
      });
    } catch (error) {
      if (isUserCancellation(error)) return;
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

  const targetLabel = currentExercise.isCapture
    ? CAPTURE_COPY.statsLabel
    : `${String.fromCharCode(97 + currentExercise.targetPos.file)}${currentExercise.targetPos.rank + 1}`;

  const pieceHint = currentExercise.isCapture
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
      {showSplash && (
        <div className="playhub-intro-overlay is-active" aria-hidden="true">
          <p className="absolute bottom-16 left-1/2 -translate-x-1/2 text-xs font-medium text-cyan-100/50 animate-pulse">
            Loading...
          </p>
        </div>
      )}
      <main className="mission-shell min-h-screen w-full max-w-none px-0 pb-8 pt-0 sm:px-0">
        <MissionPanel
          selectedPiece={selectedPiece}
          onSelectPiece={(piece) => {
            if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
            boardGeneration.current++;
            setSelectedPiece(piece);
            setResultOverlay(null);
            setClaimTxHash(null);
            setSubmitTxHash(null);
            setShowBadgeEarned(false);
            resetBoard();
          }}
          pieces={[
            { key: "rook", label: PIECE_LABELS.rook, enabled: true },
            { key: "bishop", label: PIECE_LABELS.bishop, enabled: true },
            { key: "knight", label: PIECE_LABELS.knight, enabled: true },
          ]}
          phase={phase}
          targetLabel={targetLabel}
          pieceHint={pieceHint}
          score={score.toString()}
          timeMs={timeMs.toString()}
          level={levelId.toString()}
          contextualAction={
            <ContextualActionSlot
              action={contextAction}
              shieldsAvailable={shieldCount}
              isBusy={isWriting || isSubmitConfirming || isClaimConfirming}
              onSubmitScore={() => void handleSubmitScore()}
              onUseShield={handleUseShield}
              onClaimBadge={() => void handleClaimBadge()}
              onRetry={() => resetBoard()}
            />
          }
          persistentDock={
            <PersistentDock
              badgeControl={
                <BadgeSheet
                  open={badgeSheetOpen}
                  onOpenChange={(v) => { if (!v && isClaimBusy) return; setBadgeSheetOpen(v); }}
                  badgesClaimed={badgesClaimed}
                  onClaim={(piece) => void handleClaimBadge(piece)}
                  isClaimBusy={isClaimBusy}
                  showNotification={canSendOnChain && !Boolean(hasClaimedBadge)}
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
                    setConfirmOpen(true);
                  }}
                />
              }
              leaderboardControl={
                <LeaderboardSheet open={leaderboardOpen} onOpenChange={setLeaderboardOpen} />
              }
              inviteControl={<InviteButton />}
            />
          }
          board={
            <Board
              key={boardKey}
              pieceType={selectedPiece}
              startPosition={currentExercise.startPos}
              mode="practice"
              targetPosition={currentExercise.targetPos}
              isLocked={phase === "failure" || phase === "success"}
              onMove={handleMove}
              isCapture={currentExercise.isCapture}
              tutorialHints={tutorialHints}
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
          moreAction={
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cyan-200/70 transition hover:bg-white/10 hover:text-cyan-50"
              aria-label="Help"
            >
              <HelpCircle size={18} strokeWidth={2} />
            </button>
          }
        />

        <PurchaseConfirmSheet
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) {
              setPurchasePhase("idle");
              setSelectedItemId(null);
            }
          }}
          selectedItem={selectedItem}
          chainId={chainId}
          shopAddress={shopAddress}
          paymentTokenSymbol={paymentToken?.symbol ?? null}
          isConnected={isConnected}
          isCorrectChain={isCorrectChain}
          isWriting={isWriting}
          purchasePhase={purchasePhase}
          onConfirm={() => void handleConfirmPurchase()}
        />

        {(showBriefing || showHelp) ? (
          <MissionBriefing
            pieceType={selectedPiece}
            targetLabel={targetLabel}
            isCapture={Boolean(currentExercise.isCapture)}
            onPlay={() => {
              if (showBriefing) markOnboarded();
              setShowHelp(false);
            }}
          />
        ) : null}

        {showBadgeEarned ? (
          <BadgeEarnedPrompt
            pieceType={selectedPiece}
            totalStars={totalStars}
            onClaimBadge={() => {
              boardGeneration.current++;
              if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
              setShowBadgeEarned(false);
              void handleClaimBadge();
            }}
            onSubmitScore={() => {
              if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
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

        {qaEnabled && !isMiniPay ? (
          <details className="fixed bottom-2 left-2 right-2 z-30 rounded-xl bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur">
            <summary className="cursor-pointer list-none font-semibold uppercase tracking-[0.2em] text-cyan-300">
              QA mode
            </summary>
            <div className="mt-2 space-y-2">
              <label className="block">
                Level ID override
                <input
                  type="number"
                  min={1}
                  max={9999}
                  step={1}
                  value={qaLevelInput}
                  onChange={(event) => setQaLevelInput(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-cyan-600/45 bg-slate-900/90 px-3 py-2 text-sm text-cyan-50"
                />
              </label>
              {!isQaLevelValid ? (
                <p className="text-rose-300">Use a whole number between 1 and 9999.</p>
              ) : (
                <p className="text-emerald-300">{CTA_LABELS.claimBadge} and {CTA_LABELS.submitScore} will use levelId {levelId.toString()}.</p>
              )}
              <StatusStrip
                chainId={chainId}
                isConnected={isConnected}
                isCorrectChain={isCorrectChain}
                missionCompleted={phase === "success"}
                hasClaimedBadge={hasClaimedBadge}
                shopTxHash={shopTxHash}
                claimTxHash={claimTxHash}
                submitTxHash={submitTxHash}
                isShopConfirming={isShopConfirming}
                isClaimConfirming={isClaimConfirming}
                isSubmitConfirming={isSubmitConfirming}
                lastError={lastError}
                txLink={(txHash) => txLink(chainId, txHash)}
              />
            </div>
          </details>
        ) : null}
      </main>
    </div>
  );
}
