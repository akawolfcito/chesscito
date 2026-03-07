"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi } from "viem";
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
import { LeaderboardSheet } from "@/components/play-hub/leaderboard-sheet";
import { MissionPanel } from "@/components/play-hub/mission-panel";
import { OnChainActionsPanel } from "@/components/play-hub/onchain-actions-panel";
import { PurchaseConfirmSheet } from "@/components/play-hub/purchase-confirm-sheet";
import { ShopSheet } from "@/components/play-hub/shop-sheet";
import { StatusStrip } from "@/components/play-hub/status-strip";
import { useMiniPay } from "@/hooks/use-minipay";
import { badgesAbi } from "@/lib/contracts/badges";
import {
  getBadgesAddress,
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getScoreboardAddress,
  getShopAddress,
  getUsdcAddress,
} from "@/lib/contracts/chains";
import { getLevelId, scoreboardAbi } from "@/lib/contracts/scoreboard";
import { shopAbi } from "@/lib/contracts/shop";
import type { BoardPosition } from "@/lib/game/types";

const SHOP_ITEMS = [
  { itemId: 1n, label: "Vidas x5", subtitle: "Pack base", price: 10_000n },
  { itemId: 2n, label: "Hechizo Lvl 3", subtitle: "Boost tactico", price: 20_000n },
  { itemId: 3n, label: "Pocion de vida", subtitle: "Recuperacion instantanea", price: 50_000n },
] as const;

const leaderboardRows = [
  { rank: 1, player: "0x71...2d4c", score: 980, time: "18.4s" },
  { rank: 2, player: "0x8a...96bb", score: 910, time: "20.1s" },
  { rank: 3, player: "0x0f...cc31", score: 860, time: "22.7s" },
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
  const [qaLevelInput, setQaLevelInput] = useState("2");
  const [showRewardMoment, setShowRewardMoment] = useState(false);

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  const usdcAddress = useMemo(() => getUsdcAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const defaultLevelId = useMemo(() => getLevelId(selectedPiece), [selectedPiece]);
  const qaEnabled = useMemo(() => process.env.NEXT_PUBLIC_QA_MODE === "1", []);
  const qaLevel = useMemo(() => Number.parseInt(qaLevelInput, 10), [qaLevelInput]);
  const isQaLevelValid = Number.isInteger(qaLevel) && qaLevel >= 1 && qaLevel <= 9999;
  const levelId = useMemo(
    () => (qaEnabled ? (isQaLevelValid ? BigInt(qaLevel) : 0n) : defaultLevelId),
    [defaultLevelId, isQaLevelValid, qaEnabled, qaLevel]
  );
  const score = 100n;
  const timeMs = useMemo(() => {
    if (phase !== "success") {
      return 1000n;
    }

    const seconds = Math.max(1, Math.floor(elapsedMs / 1000));
    return BigInt(seconds * 1000);
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

  const { data: usdcAllowance } = useReadContract({
    address: usdcAddress ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && shopAddress ? [address, shopAddress] : undefined,
    chainId,
    query: {
      enabled: Boolean(address && shopAddress && usdcAddress),
    },
  });

  const { data: hasClaimedBadge, refetch: refetchClaimedBadge } = useReadContract({
    address: badgesAddress ?? undefined,
    abi: badgesAbi,
    functionName: "hasClaimedBadge",
    args: address && levelId > 0n ? [address, levelId] : undefined,
    chainId,
    query: {
      enabled: Boolean(address && badgesAddress && levelId > 0n),
    },
  });

  const { isLoading: isShopConfirming } = useWaitForTransactionReceipt({
    chainId,
    hash: shopTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(shopTxHash),
    },
  });
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

  const challengeTarget: BoardPosition = { file: 7, rank: 0 };

  const canSendOnChain =
    Boolean(address) &&
    isConnected &&
    isCorrectChain &&
    phase === "success" &&
    levelId > 0n;
  const isClaimBusy = isWriting || isClaimConfirming;
  const isSubmitBusy = isWriting || isSubmitConfirming;

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
    setBoardKey((previous) => previous + 1);
    setPhase("ready");
    setShowRewardMoment(false);
    setMoves(0);
    setElapsedMs(0);
  }

  function handleMove(position: BoardPosition) {
    const isTarget = position.file === challengeTarget.file && position.rank === challengeTarget.rank;
    setMoves((previous) => previous + 1);

    if (isTarget) {
      setPhase("success");
      setElapsedMs(1000);
      setShowRewardMoment(true);
      return;
    }

    setPhase("failure");
  }

  async function handleClaimBadge() {
    if (!canSendOnChain || !address || !badgesAddress) {
      return;
    }

    setLastError(null);

    try {
      const signed = await requestSignature("/api/sign-badge", {
        player: address,
        levelId: Number(levelId),
      });

      const txHash = await writeWithOptionalFeeCurrency({
        address: badgesAddress,
        abi: badgesAbi,
        functionName: "claimBadgeSigned" as const,
        args: [levelId, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
        chainId,
        account: address,
      });

      setClaimTxHash(txHash);
      void refetchClaimedBadge();
      console.info("[MiniPayTx] result", { label: "claim-badge", txHash, levelId: Number(levelId) });
    } catch (error) {
      const message = toErrorMessage(error);
      setLastError(message);
      console.warn("[MiniPayTx] error", { label: "claim-badge", levelId: Number(levelId), error: message });
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
      console.info("[MiniPayTx] result", { label: "submit-score", txHash, levelId: Number(levelId) });
    } catch (error) {
      const message = toErrorMessage(error);
      setLastError(message);
      console.warn("[MiniPayTx] error", { label: "submit-score", levelId: Number(levelId), error: message });
    }
  }

  async function handleConfirmPurchase() {
    if (!selectedItem || !address || !shopAddress || !usdcAddress || !isCorrectChain) {
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

    const unitPrice = selectedItem.onChainPrice;
    const total = unitPrice;

    setLastError(null);
    console.info("[MiniPayTx] request", {
      label: selectedItem.label,
      itemId: selectedItem.itemId.toString(),
      total: total.toString(),
      currency: "USDC",
      chainId,
      shopAddress,
      usdcAddress,
    });

    try {
      if (!usdcAllowance || usdcAllowance < total) {
        setPurchasePhase("approving");
        const approveHash = await writeWithOptionalFeeCurrency({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "approve" as const,
          args: [shopAddress, total] as const,
          chainId,
          account: address,
        });
        console.info("[MiniPayTx] result", {
          label: `${selectedItem.label} approve`,
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
        args: [selectedItem.itemId, 1n] as const,
        chainId,
        account: address,
      });

      setShopTxHash(buyHash);
      setConfirmOpen(false);
      console.info("[MiniPayTx] result", {
        label: selectedItem.label,
        txHash: buyHash,
      });
    } catch (error) {
      const message = toErrorMessage(error);
      setLastError(message);
      console.warn("[MiniPayTx] error", {
        label: selectedItem.label,
        error: message,
      });
    } finally {
      setPurchasePhase("idle");
    }
  }

  useEffect(() => {
    if (!showRewardMoment) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowRewardMoment(false);
    }, 6000);

    return () => window.clearTimeout(timeout);
  }, [showRewardMoment]);

  return (
    <main className="mission-shell mx-auto min-h-screen w-full max-w-screen-sm px-4 pb-72 pt-6 sm:px-6">
      <MissionPanel
        selectedPiece={selectedPiece}
        onSelectPiece={(piece) => {
          setSelectedPiece(piece);
          resetBoard();
        }}
        pieces={[
          { key: "rook", label: "Torre", enabled: true },
          { key: "bishop", label: "Alfil", enabled: false },
          { key: "knight", label: "Caballo", enabled: false },
        ]}
        phase={phase}
        showRewardMoment={showRewardMoment}
        levelIdLabel={levelId.toString()}
        claimState={claimTxHash ? (isClaimConfirming ? "pending" : "done") : "idle"}
        submitState={submitTxHash ? (isSubmitConfirming ? "pending" : "done") : "idle"}
        onDismissReward={() => setShowRewardMoment(false)}
        board={
          <Board
            key={boardKey}
            mode="practice"
            targetPosition={challengeTarget}
            isLocked={phase === "failure" || phase === "success"}
            onMove={handleMove}
          />
        }
      />

      <section className="fixed bottom-0 left-0 right-0 z-40 border-t border-cyan-800/45 bg-slate-950/94 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-h-[56vh] w-full max-w-screen-sm space-y-3 overflow-y-auto pr-1">
          <OnChainActionsPanel
            score={score.toString()}
            timeMs={timeMs.toString()}
            moves={moves}
            effectiveLevelId={levelId.toString()}
            canClaim={qaEnabled ? canSendOnChain && isQaLevelValid : canSendOnChain && !Boolean(hasClaimedBadge)}
            canSubmit={canSendOnChain}
            isClaimBusy={isClaimBusy}
            isSubmitBusy={isSubmitBusy}
            isGlobalBusy={isWriting}
            qaEnabled={qaEnabled}
            qaLevelInput={qaLevelInput}
            isQaLevelValid={isQaLevelValid}
            onQaLevelInputChange={setQaLevelInput}
            onClaim={() => void handleClaimBadge()}
            onSubmit={() => void handleSubmitScore()}
            onReset={resetBoard}
            shopControl={
              <ShopSheet
                open={storeOpen}
                onOpenChange={setStoreOpen}
                items={shopCatalog}
                onSelectItem={(itemId) => {
                  setSelectedItemId(itemId);
                  setConfirmOpen(true);
                }}
              />
            }
            leaderboardControl={
              <LeaderboardSheet open={leaderboardOpen} onOpenChange={setLeaderboardOpen} rows={leaderboardRows} />
            }
          />

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
      </section>

      <PurchaseConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        selectedItem={selectedItem}
        chainId={chainId}
        shopAddress={shopAddress}
        usdcAddress={usdcAddress}
        isConnected={isConnected}
        isCorrectChain={isCorrectChain}
        isWriting={isWriting}
        purchasePhase={purchasePhase}
        onConfirm={() => void handleConfirmPurchase()}
      />

      {isMiniPay ? null : (
        <p className="mt-4 text-xs text-cyan-100/65">En navegador normal puedes probar submit/claim. En MiniPay valida el flujo real de firma.</p>
      )}
    </main>
  );
}
