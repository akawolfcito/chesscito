"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { decodeEventLog } from "viem";
import { getConfiguredChainId, getVictoryNFTAddress } from "@/lib/contracts/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import {
  ACCEPTED_TOKENS,
  DIFFICULTY_TO_CHAIN,
  VICTORY_PRICES,
  erc20Abi,
  normalizePrice,
} from "@/lib/contracts/tokens";
import { selectMaxBalanceToken } from "@/lib/contracts/select-payment-token";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { RESULT_OVERLAY_COPY } from "@/lib/content/editorial";
import { hapticSuccess } from "@/lib/haptics";
import {
  classifyTxErrorKind,
  isTransactionTimeout,
  isUserCancellation,
} from "@/lib/errors";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClaimPhase = "ready" | "claiming" | "success" | "error" | "cancelled" | "timeout";
export type ClaimStep = "signing" | "confirming" | "done";
export type ShareStatus = "locked" | "generating" | "ready";

export type ClaimData = {
  tokenId: bigint | null;
  claimTxHash: `0x${string}` | null;
  shareCardUrl: string | null;
  shareLinkUrl: string | null;
};

export type MintVictoryInjected = {
  address?: `0x${string}`;
  chainId?: number;
  /** Override for EIP-712 signTypedData — for VR fixtures + tests. */
  sendSig?: (typedData: unknown) => Promise<`0x${string}`>;
  /** Override for ERC-20 approve writeContract — for VR fixtures + tests. */
  sendApprove?: (token: `0x${string}`, amount: bigint) => Promise<`0x${string}`>;
  /** Override for mintSigned writeContract — for VR fixtures + tests. */
  sendMint?: (signed: unknown) => Promise<`0x${string}`>;
  /** Override for waitForReceipt — for VR fixtures + tests. */
  waitReceipt?: (hash: `0x${string}`) => Promise<unknown>;
};

export type MintVictoryInput = {
  gameId?: string;
  walletAddress?: `0x${string}`;
  difficulty?: "easy" | "medium" | "hard";
  result?: "win";
  totalMoves?: number;
  elapsedMs?: number;
  /** SAN move history — passed to /api/sign-victory for server-side replay. */
  moveHistory?: string[];
  /** Player colour ("w" | "b") — passed to /api/sign-victory. */
  playerColor?: "w" | "b";
  /** Whether the wallet is connected — affects reconnect-reset effect. */
  isConnected?: boolean;
  /** Consumer override for VR fixtures + tests. */
  injected?: MintVictoryInjected;
  /**
   * Consumer fires telemetry — hook is side-effect-free for tracking so
   * the caller can attach the correct `surface` dimension.
   */
  onClaimTelemetry?: (event: {
    stage: "start" | "signing" | "submitted" | "confirmed" | "success" | "failed" | "cancelled" | "timeout" | "error";
    gameId?: string;
    txHash?: `0x${string}`;
    error?: string;
    error_kind?: string;
    has_token_id?: boolean;
  }) => void;
};

export type MintVictoryState = {
  /** Current phase of the claim state machine. */
  phase: ClaimPhase;
  /** Sub-step within the "claiming" phase. */
  step: ClaimStep;
  /** On-chain data available after success. */
  data: ClaimData;
  /** Whether the share card URL is ready. */
  shareStatus: ShareStatus;
  /** Localized error message, or null when no error. */
  error: string | null;
  /** Begin the claim flow. No-op when already claiming or guard fails. */
  start: () => Promise<void>;
  /** Reset all claim state + sessionStorage chesscito:claim. */
  reset: () => void;
};

// ─── Inline error translator (avoids useTranslations in the hook body) ───────

function translateTxError(error: unknown): string {
  const kind = classifyTxErrorKind(error);
  const map: Record<string, string> = {
    cancelled: RESULT_OVERLAY_COPY.error.cancelled,
    timeout: RESULT_OVERLAY_COPY.error.timeout,
    insufficientFunds: RESULT_OVERLAY_COPY.error.insufficientFunds,
    network: RESULT_OVERLAY_COPY.error.network,
    badgeAlreadyClaimed: RESULT_OVERLAY_COPY.error.badgeAlreadyClaimed,
    signingUnavailable: RESULT_OVERLAY_COPY.error.signingUnavailable,
    revert: RESULT_OVERLAY_COPY.error.revert,
    unknown: RESULT_OVERLAY_COPY.error.unknown,
  };
  return map[kind] ?? RESULT_OVERLAY_COPY.error.unknown;
}

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Mint victory claim phase machine.
 *
 * Owns all claim-related state (phase, step, data, shareStatus, error) and
 * the sessionStorage keys `chesscito:claim` + `chesscito:optimistic-victory`.
 *
 * Behind feature flag `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` — default OFF.
 * Production reads from the inline path in arena/page.tsx until T13.
 *
 * @remarks
 * Single-game mount expectation: state initializes on mount and does not
 * auto-reset when input identity changes. Pass `key={gameId}` to force a
 * remount between games.
 */
export function useMintVictory(input: MintVictoryInput): MintVictoryState {
  // ── Wagmi reads ────────────────────────────────────────────────────────────
  const wagmiAccount = useAccount();
  const wagmiChainId = useChainId();
  const wagmiPublicClient = usePublicClient({ chainId: wagmiChainId });
  const { writeContractAsync } = useWriteContract();

  // Resolve effective values (injected overrides win)
  const address = input.injected?.address ?? input.walletAddress ?? wagmiAccount.address;
  const chainId = input.injected?.chainId ?? wagmiChainId;
  const isConnected = input.isConnected ?? wagmiAccount.isConnected;

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const victoryNFTAddress = useMemo(() => getVictoryNFTAddress(chainId), [chainId]);

  const chainDifficulty = input.difficulty ? DIFFICULTY_TO_CHAIN[input.difficulty] : 1;
  const mintPriceUsd6 = VICTORY_PRICES[chainDifficulty] ?? 0n;

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

  // ── Mutable ref bag — keeps start/reset referentially stable ─────────────
  // All live values the callbacks need are kept in a ref updated every render
  // so useCallback deps stay empty while closures always see fresh data.
  const liveRef = useRef({
    input,
    address,
    chainId,
    isConnected,
    isCorrectChain,
    victoryNFTAddress,
    chainDifficulty,
    mintPriceUsd6,
    tokenBalances,
    wagmiPublicClient,
    writeContractAsync,
  });
  // Sync every render — no extra renders triggered (ref mutation is sync)
  liveRef.current = {
    input,
    address,
    chainId,
    isConnected,
    isCorrectChain,
    victoryNFTAddress,
    chainDifficulty,
    mintPriceUsd6,
    tokenBalances,
    wagmiPublicClient,
    writeContractAsync,
  };

  // ── Claim state ───────────────────────────────────────────────────────────
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("ready");
  const [claimStep, setClaimStep] = useState<ClaimStep>("signing");
  const [claimData, setClaimData] = useState<ClaimData>({
    tokenId: null,
    claimTxHash: null,
    shareCardUrl: null,
    shareLinkUrl: null,
  });
  const [shareStatus, setShareStatus] = useState<ShareStatus>("locked");
  const [claimError, setClaimError] = useState<string | null>(null);
  const claimingRef = useRef(false);

  // ── Persist success to sessionStorage ────────────────────────────────────
  useEffect(() => {
    if (claimPhase === "success" && claimData.claimTxHash) {
      const { input: inp } = liveRef.current;
      try {
        sessionStorage.setItem(
          "chesscito:claim",
          JSON.stringify({
            phase: "success",
            tokenId: claimData.tokenId?.toString() ?? null,
            claimTxHash: claimData.claimTxHash,
            moves: inp.totalMoves ?? 0,
            elapsedMs: inp.elapsedMs ?? 0,
            difficulty: inp.difficulty ?? "easy",
          }),
        );
      } catch { /* storage full or unavailable */ }
    }
  }, [claimPhase, claimData]);

  // ── Restore claim success on mount (e.g. returning from WhatsApp) ─────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("chesscito:claim");
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (saved.phase === "success") {
        setClaimPhase("success");
        setClaimData({
          tokenId: saved.tokenId ? BigInt(saved.tokenId as string) : null,
          claimTxHash: saved.claimTxHash as `0x${string}`,
          shareCardUrl: null,
          shareLinkUrl: null,
        });
        setShareStatus("ready");
      } else if (saved.phase === "claiming") {
        // Stale claiming state from a previous session — clear it.
        sessionStorage.removeItem("chesscito:claim");
      }
    } catch { /* corrupt data — ignore */ }
    // Intentionally run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reset claim error when wallet reconnects ──────────────────────────────
  const prevConnected = useRef(isConnected);
  useEffect(() => {
    if (isConnected && !prevConnected.current && claimPhase === "error") {
      setClaimPhase("ready");
      setClaimError(null);
      claimingRef.current = false;
    }
    prevConnected.current = isConnected;
  }, [isConnected, claimPhase]);

  // ── start — stable ref, reads live values via liveRef ─────────────────────
  const start = useCallback(async () => {
    const {
      input: inp,
      address: addr,
      chainId: cid,
      victoryNFTAddress: nftAddr,
      chainDifficulty: chainDiff,
      mintPriceUsd6: priceUsd6,
      tokenBalances: balances,
      wagmiPublicClient: publicClient,
      writeContractAsync: writeAsync,
    } = liveRef.current;

    // Guard: injected tests bypass normal canClaim; real path requires
    // address + victoryNFT + win result.
    const isInjected = inp.injected?.address != null;
    const effectiveAddr = inp.injected?.address ?? addr;
    const effectiveNFT = nftAddr ?? (isInjected ? ("0xDEAD" as `0x${string}`) : null);

    const canClaim =
      inp.result === "win" &&
      effectiveAddr != null &&
      (isInjected || effectiveNFT != null);

    if (!canClaim || !effectiveAddr) return;
    if (!isInjected && !publicClient) return;
    if (claimingRef.current) return;
    claimingRef.current = true;

    setClaimPhase("claiming");
    setClaimStep("signing");
    setClaimError(null);

    inp.onClaimTelemetry?.({ stage: "start", gameId: inp.gameId });

    // Snapshot verifiedMoves once — sign + mint must stay aligned
    const verifiedMoves = inp.moveHistory?.length ?? inp.totalMoves ?? 0;
    const effectiveChainDiff = inp.difficulty ? DIFFICULTY_TO_CHAIN[inp.difficulty] : chainDiff;
    const effectivePriceUsd6 = VICTORY_PRICES[effectiveChainDiff] ?? priceUsd6;

    try {
      // 1. Get server signature
      const res = await fetch("/api/sign-victory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: effectiveAddr,
          difficulty: effectiveChainDiff,
          moveHistory: inp.moveHistory ?? [],
          playerColor: inp.playerColor ?? "w",
          timeMs: inp.elapsedMs ?? 0,
        }),
      });
      const payload = (await res.json()) as SignatureResponse;
      if (!res.ok || "error" in payload) {
        throw new Error(payload.error ?? "Could not fetch signature");
      }

      // Persist claiming state so page refresh can't double-mint
      try {
        sessionStorage.setItem(
          "chesscito:claim",
          JSON.stringify({ phase: "claiming", deadline: payload.deadline }),
        );
      } catch { /* ignore */ }

      // 2. Select payment token
      // When sendMint is fully injected (test / VR fixture), token selection
      // is not meaningful — the mock controls the entire mint path. Use a
      // sentinel token so the guard doesn't block the flow.
      const sentinelToken = inp.injected?.sendMint
        ? { address: ACCEPTED_TOKENS[0].address, decimals: ACCEPTED_TOKENS[0].decimals }
        : null;
      const token =
        sentinelToken ?? selectMaxBalanceToken(ACCEPTED_TOKENS, balances, effectivePriceUsd6);
      if (!token) throw new Error("No token with sufficient balance");

      const normalizedAmount = normalizePrice(effectivePriceUsd6, token.decimals);

      // 3. Check allowance and approve if needed
      if (inp.injected?.sendApprove) {
        await inp.injected.sendApprove(token.address, normalizedAmount);
      } else {
        const allowance = await publicClient!.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [effectiveAddr, effectiveNFT!],
        });
        if ((allowance as bigint) < normalizedAmount) {
          const approveHash = await writeAsync({
            address: token.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [effectiveNFT!, normalizedAmount],
            chainId: cid,
            account: effectiveAddr,
          });
          await waitForReceiptWithTimeout(publicClient!, approveHash);
        }
      }

      // Approve done — move to confirming step
      setClaimStep("confirming");

      // 4. Check signature hasn't expired (30s buffer for tx propagation)
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      if (nowSec + 30n >= BigInt(payload.deadline)) {
        throw new Error("Signature expired — please try again");
      }

      // 5. Claim (mint) and wait for confirmation
      let claimHash: `0x${string}`;
      if (inp.injected?.sendMint) {
        claimHash = await inp.injected.sendMint({
          address: effectiveNFT,
          difficulty: effectiveChainDiff,
          verifiedMoves,
          elapsedMs: inp.elapsedMs ?? 0,
          token: token.address,
          nonce: BigInt(payload.nonce),
          deadline: BigInt(payload.deadline),
          signature: payload.signature,
        });
      } else {
        claimHash = await writeAsync({
          address: effectiveNFT!,
          abi: victoryAbi,
          functionName: "mintSigned",
          args: [
            effectiveChainDiff,
            verifiedMoves,
            inp.elapsedMs ?? 0,
            token.address,
            BigInt(payload.nonce),
            BigInt(payload.deadline),
            payload.signature,
          ],
          chainId: cid,
          account: effectiveAddr,
        });
      }

      type ReceiptLike = { logs: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> };
      let receipt: ReceiptLike;
      if (inp.injected?.waitReceipt) {
        receipt = (await inp.injected.waitReceipt(claimHash)) as ReceiptLike;
      } else {
        receipt = await waitForReceiptWithTimeout(publicClient!, claimHash);
      }

      // 6. Extract tokenId from VictoryMinted event
      let extractedTokenId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: victoryAbi,
            data: log.data,
            topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          });
          if (decoded.eventName === "VictoryMinted" && "tokenId" in decoded.args) {
            extractedTokenId = decoded.args.tokenId as bigint;
            break;
          }
        } catch {
          // Not our event — skip
        }
      }

      // 7. Build victory URL + OG image URL
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const victoryId = extractedTokenId ? String(extractedTokenId) : null;
      const victoryUrl = victoryId
        ? `${origin}/victory/${victoryId}`
        : `https://celoscan.io/tx/${claimHash}`;
      const ogImageUrl = victoryId ? `${origin}/api/og/victory/${victoryId}` : null;

      setClaimStep("done");
      setClaimData({
        tokenId: extractedTokenId,
        claimTxHash: claimHash,
        shareCardUrl: ogImageUrl,
        shareLinkUrl: victoryUrl,
      });
      setShareStatus("ready");
      hapticSuccess();
      setClaimPhase("success");
      setClaimError(null);

      inp.onClaimTelemetry?.({
        stage: "success",
        gameId: inp.gameId,
        txHash: claimHash,
        has_token_id: Boolean(extractedTokenId),
      });

      // Write-through to Supabase (fire-and-forget)
      void fetch("/api/cache-victory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: effectiveAddr,
          tokenId: extractedTokenId ? String(extractedTokenId) : "0",
          difficulty: effectiveChainDiff,
          totalMoves: verifiedMoves,
          timeMs: inp.elapsedMs ?? 0,
          txHash: claimHash,
        }),
      }).catch(() => { });

      // Optimistic entry for trophies page
      try {
        sessionStorage.setItem(
          "chesscito:optimistic-victory",
          JSON.stringify({
            tokenId: extractedTokenId ? String(extractedTokenId) : "0",
            player: effectiveAddr.toLowerCase(),
            difficulty: effectiveChainDiff,
            totalMoves: verifiedMoves,
            timeMs: inp.elapsedMs ?? 0,
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
    } catch (err) {
      console.error("Claim failed:", err);
      // Stale "claiming" sessionStorage would strand the player on next mount
      try { sessionStorage.removeItem("chesscito:claim"); } catch { /* ignore */ }

      if (isUserCancellation(err)) {
        inp.onClaimTelemetry?.({ stage: "cancelled", gameId: inp.gameId });
        setClaimError(null);
        setClaimPhase("cancelled");
        return;
      }
      if (isTransactionTimeout(err)) {
        inp.onClaimTelemetry?.({ stage: "timeout", gameId: inp.gameId });
        setClaimError(null);
        setClaimPhase("timeout");
        return;
      }

      const raw = err instanceof Error ? err.message : "Claim failed";
      const errorKind = /expired/i.test(raw) ? "expired" : String(classifyTxErrorKind(err));
      const friendly = /expired/i.test(raw)
        ? "Signature expired — tap to get a fresh one"
        : translateTxError(err);

      setClaimError(friendly);
      setClaimPhase("error");

      inp.onClaimTelemetry?.({
        stage: "error",
        gameId: inp.gameId,
        error: raw,
        error_kind: errorKind,
      });
    } finally {
      claimingRef.current = false;
    }
  // Empty dep array: all live values are read from liveRef (mutable, synced each render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── reset — stable ref ─────────────────────────────────────────────────────
  const reset = useCallback(() => {
    claimingRef.current = false;
    try { sessionStorage.removeItem("chesscito:claim"); } catch { /* ignore */ }
    setClaimPhase("ready");
    setClaimStep("signing");
    setClaimData({ tokenId: null, claimTxHash: null, shareCardUrl: null, shareLinkUrl: null });
    setShareStatus("locked");
    setClaimError(null);
  }, []);

  return {
    phase: claimPhase,
    step: claimStep,
    data: claimData,
    shareStatus,
    error: claimError,
    start,
    reset,
  };
}
