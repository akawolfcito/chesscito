"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { erc20Abi, formatUnits } from "viem";
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
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  const usdcAddress = useMemo(() => getUsdcAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const levelId = useMemo(() => getLevelId(selectedPiece), [selectedPiece]);
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

  useWaitForTransactionReceipt({
    chainId,
    hash: shopTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(shopTxHash),
    },
  });

  const challengeTarget: BoardPosition = { file: 7, rank: 0 };

  const canSendOnChain =
    Boolean(address) &&
    isConnected &&
    isCorrectChain &&
    phase === "success" &&
    levelId > 0n;

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
    setMoves(0);
    setElapsedMs(0);
  }

  function handleMove(position: BoardPosition) {
    const isTarget = position.file === challengeTarget.file && position.rank === challengeTarget.rank;
    setMoves((previous) => previous + 1);

    if (isTarget) {
      setPhase("success");
      setElapsedMs(1000);
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

  return (
    <main className="mx-auto w-full max-w-screen-sm px-4 pb-52 pt-6 sm:px-6">
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(8,15,31,0.08)]">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Play Hub</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Juega, compra y guarda on-chain</h1>
          <p className="text-sm text-slate-600">
            MVP de una pantalla: challenge + claim/submit + store USDC. MiniPay puede mostrar Unknown transaction.
          </p>
        </div>

        <div className="flex gap-2">
          {([
            { key: "rook", label: "Torre", enabled: true },
            { key: "bishop", label: "Alfil", enabled: false },
            { key: "knight", label: "Caballo", enabled: false },
          ] as const).map((piece) => (
            <button
              key={piece.key}
              type="button"
              disabled={!piece.enabled}
              onClick={() => {
                setSelectedPiece(piece.key);
                resetBoard();
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                selectedPiece === piece.key
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700 disabled:opacity-50"
              }`}
            >
              {piece.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
          Objetivo: capturar <span className="font-semibold">h1</span> en un movimiento.
        </div>

        <Board
          key={boardKey}
          mode="practice"
          targetPosition={challengeTarget}
          isLocked={phase === "failure" || phase === "success"}
          onMove={handleMove}
        />

        {phase === "failure" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Jugada incorrecta. Reinicia para intentar de nuevo.
          </div>
        ) : null}
        {phase === "success" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Objetivo completado. Ya puedes claim badge y submit score.
          </div>
        ) : null}
      </section>

      <section className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-screen-sm space-y-3">
          <div className="grid grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="rounded-xl bg-slate-100 px-3 py-2">
              <p>Score</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{score.toString()}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2">
              <p>Time</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{timeMs.toString()} ms</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2">
              <p>Moves</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{moves}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!canSendOnChain || Boolean(hasClaimedBadge) || isWriting} onClick={() => void handleClaimBadge()}>
              Claim badge
            </Button>
            <Button variant="outline" disabled={!canSendOnChain || isWriting} onClick={() => void handleSubmitScore()}>
              Guardar score
            </Button>
            <Sheet open={storeOpen} onOpenChange={setStoreOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">Store</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Store (USDC)</SheetTitle>
                  <SheetDescription>Compras simples con precio fijo en stablecoin.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  {shopCatalog.map((item) => (
                    <div key={item.itemId.toString()} className="rounded-2xl border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.subtitle}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {item.configured ? `${formatUnits(item.onChainPrice, 6)} USDC` : "No configurado"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.configured ? (item.enabled ? "Disponible" : "Deshabilitado") : "No disponible"}
                      </p>
                      <Button
                        className="mt-3 w-full"
                        variant="outline"
                        disabled={!item.configured || !item.enabled}
                        onClick={() => {
                          setSelectedItemId(item.itemId);
                          setConfirmOpen(true);
                        }}
                      >
                        Comprar
                      </Button>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
            <Sheet open={leaderboardOpen} onOpenChange={setLeaderboardOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">Leaderboard</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Leaderboard</SheetTitle>
                  <SheetDescription>Vista rapida sin salir del Play Hub.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {leaderboardRows.map((row) => (
                    <div key={row.rank} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">#{row.rank}</p>
                      <p className="text-sm text-slate-700">{row.player}</p>
                      <p className="text-sm font-semibold text-slate-900">{row.score}</p>
                    </div>
                  ))}
                  <Link className="mt-2 inline-flex text-xs font-semibold text-primary" href="/leaderboard">
                    Ver leaderboard completo
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Button variant="outline" onClick={resetBoard}>Reset board</Button>

          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
            <p>Chain: {chainId ?? "n/a"}</p>
            <p>Badge: {hasClaimedBadge ? "Claimed" : "Pending"}</p>
            <p>Shop tx: {shopTxHash ?? "n/a"}</p>
            <p>Claim tx: {claimTxHash ?? "n/a"}</p>
            <p>Submit tx: {submitTxHash ?? "n/a"}</p>
            {lastError ? <p className="text-rose-700">Error: {lastError}</p> : null}
          </div>

          {shopTxHash ? (
            <Link className="inline-flex text-xs font-semibold text-primary" href={txLink(chainId, shopTxHash)} target="_blank" rel="noopener noreferrer">
              Ver compra en Celoscan
            </Link>
          ) : null}
        </div>
      </section>

      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Confirmar compra</SheetTitle>
            <SheetDescription>
              Revisa detalle antes de enviar la transaccion.
            </SheetDescription>
          </SheetHeader>
          {selectedItem ? (
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Label: <span className="font-semibold">{selectedItem.label}</span></p>
              <p>Precio: <span className="font-semibold">{formatUnits(selectedItem.onChainPrice, 6)} USDC</span></p>
              <p>Estado: <span className="font-semibold">{selectedItem.configured ? (selectedItem.enabled ? "Disponible" : "Deshabilitado") : "No configurado"}</span></p>
              <p>Red: <span className="font-semibold">{chainId ?? "n/a"}</span></p>
              <p>Shop: <span className="break-all font-mono text-xs">{shopAddress ?? "missing"}</span></p>
              <p>USDC: <span className="break-all font-mono text-xs">{usdcAddress ?? "missing"}</span></p>
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                MiniPay puede mostrar &quot;Unknown transaction&quot;. Este modal describe la accion esperada antes de firmar.
              </p>
              <Button
                className="mt-2 w-full"
                disabled={
                  isWriting ||
                  purchasePhase !== "idle" ||
                  !shopAddress ||
                  !usdcAddress ||
                  !isConnected ||
                  !isCorrectChain ||
                  !selectedItem.configured ||
                  !selectedItem.enabled
                }
                onClick={() => void handleConfirmPurchase()}
              >
                {purchasePhase === "approving"
                  ? "Aprobando USDC..."
                  : purchasePhase === "buying"
                    ? "Comprando..."
                    : "Confirmar compra"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {isMiniPay ? null : (
        <p className="mt-4 text-xs text-slate-500">En navegador normal puedes probar submit/claim. En MiniPay valida el flujo real de firma.</p>
      )}
    </main>
  );
}
