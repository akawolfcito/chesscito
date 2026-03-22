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
  const [claimData, setClaimData] = useState<ClaimData>({
    tokenId: null,
    claimTxHash: null,
    shareCardUrl: null,
    shareLinkUrl: null,
  });
  const [shareStatus, setShareStatus] = useState<ShareStatus>("locked");
  const [claimError, setClaimError] = useState<string | null>(null);
  const claimingRef = useRef(false);

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

  const handleBackToHub = () => router.push("/");

  async function handleClaimVictory() {
    if (!canClaim || !address || !victoryNFTAddress || !publicClient) return;
    if (claimingRef.current) return; // Prevent double-click
    claimingRef.current = true;

    setClaimPhase("claiming");
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

      // 4. Claim (mint) and wait for confirmation
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
      const victoryId = extractedTokenId ? String(extractedTokenId) : claimHash.slice(0, 10);
      const victoryUrl = `${origin}/victory/${victoryId}`;
      const ogImageUrl = `${origin}/api/og/victory/${victoryId}`;

      setClaimData({
        tokenId: extractedTokenId,
        claimTxHash: claimHash,
        shareCardUrl: ogImageUrl,
        shareLinkUrl: victoryUrl,
      });
      setShareStatus("ready"); // For now, share is immediately ready post-claim
      setClaimPhase("success");
      setClaimError(null);
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
      const friendly = /insufficient/i.test(raw) ? "Insufficient balance"
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

  // Reset claim state when starting a new game
  const handlePlayAgain = () => {
    claimingRef.current = false;
    try { sessionStorage.removeItem("chesscito:claim"); } catch { /* ignore */ }
    setClaimPhase("ready");
    setClaimData({ tokenId: null, claimTxHash: null, shareCardUrl: null, shareLinkUrl: null });
    setShareStatus("locked");
    setClaimError(null);
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
          onBack={handleBackToHub}
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

      </div>

      {isEndState && (
        <ArenaEndState
          status={game.status}
          isPlayerWin={isPlayerWin}
          onPlayAgain={handlePlayAgain}
          onBackToHub={handleBackToHub}
          claimPhase={claimPhase}
          shareStatus={shareStatus}
          claimData={claimData}
          onClaimVictory={canClaim ? () => void handleClaimVictory() : undefined}
          claimPrice={claimPriceLabel}
          claimError={claimError}
          moves={game.moveCount}
          elapsedMs={game.elapsedMs}
          difficulty={game.difficulty}
        />
      )}
    </main>
  );
}
