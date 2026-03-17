"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { useChessGame } from "@/lib/game/use-chess-game";
import { ArenaBoard } from "@/components/arena/arena-board";
import { DifficultySelector } from "@/components/arena/difficulty-selector";
import { ArenaHud } from "@/components/arena/arena-hud";
import { PromotionOverlay } from "@/components/arena/promotion-overlay";
import { ArenaEndState } from "@/components/arena/arena-end-state";
import { ARENA_COPY } from "@/lib/content/editorial";
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

  const [hasMinted, setHasMinted] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const isEndState = ["checkmate", "stalemate", "draw", "resigned"].includes(game.status);
  const isPlayerWin = game.status === "checkmate" && game.fen.includes(" b ");

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const victoryNFTAddress = useMemo(() => getVictoryNFTAddress(chainId), [chainId]);

  const chainDifficulty = DIFFICULTY_TO_CHAIN[game.difficulty];
  const mintPriceUsd6 = VICTORY_PRICES[chainDifficulty] ?? 0n;
  const mintPriceLabel = formatUsd(mintPriceUsd6);

  const canMint = isConnected && isCorrectChain && isPlayerWin && victoryNFTAddress != null;

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
    query: { enabled: Boolean(address && canMint) },
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

  const handleBackToHub = () => router.push("/play-hub");

  async function handleMintVictory() {
    if (!canMint || !address || !victoryNFTAddress || !publicClient) return;

    setIsMinting(true);
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

      // 4. Mint and wait for confirmation
      const mintHash = await writeContractAsync({
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
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      setHasMinted(true);
      setMintError(null);
    } catch (err) {
      console.error("Mint failed:", err);
      const msg = err instanceof Error ? err.message : "Mint failed";
      setMintError(msg.includes("User rejected") ? null : "Mint failed. Try again.");
    } finally {
      setIsMinting(false);
    }
  }

  // Reset mint state when starting a new game
  const handlePlayAgain = () => {
    setHasMinted(false);
    setIsMinting(false);
    setMintError(null);
    game.reset();
  };

  // Difficulty selection
  if (game.status === "selecting") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center arena-bg">
        <DifficultySelector
          selected={game.difficulty}
          onSelect={game.setDifficulty}
          onStart={game.startGame}
        />
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
          onBack={game.reset}
        />

        <div className="relative w-full">
          <ArenaBoard
            pieces={game.pieces}
            selectedSquare={game.selectedSquare}
            legalMoves={game.legalMoves}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            isLocked={game.isThinking || isEndState}
            onSquareClick={game.selectSquare}
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
              className="shrink-0 rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-all hover:bg-rose-500/30 active:scale-95"
            >
              {ARENA_COPY.restartMatch}
            </button>
          </div>
        )}

        {/* Actions bar */}
        {!isEndState && !game.errorMessage && (
          <div className="flex items-center justify-center px-4 py-3">
            <button
              type="button"
              onClick={game.resign}
              className="rounded-2xl border border-white/8 bg-white/5 px-8 py-2.5 text-sm font-semibold text-white/50 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white/70 active:scale-95"
            >
              {ARENA_COPY.resign}
            </button>
          </div>
        )}
      </div>

      {isEndState && (
        <ArenaEndState
          status={game.status}
          isPlayerWin={isPlayerWin}
          onPlayAgain={handlePlayAgain}
          onBackToHub={handleBackToHub}
          onMintVictory={canMint ? () => void handleMintVictory() : undefined}
          isMinting={isMinting}
          hasMinted={hasMinted}
          mintPrice={mintPriceLabel}
          mintError={mintError}
        />
      )}
    </main>
  );
}
