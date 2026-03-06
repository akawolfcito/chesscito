"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createPublicClient, custom } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { Button } from "@/components/ui/button";
import { useMiniPay } from "@/hooks/use-minipay";
import { badgesAbi } from "@/lib/contracts/badges";
import {
  getBadgesAddress,
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getScoreboardAddress,
} from "@/lib/contracts/chains";
import { getLevelId, scoreboardAbi } from "@/lib/contracts/scoreboard";
import {
  getMiniPayProvider,
  requestAccount,
  requestChainId,
  safeJson,
} from "@/lib/minipay/provider";
import {
  encodeCallData,
  probeEstimateAndCall,
  sendRawTxNoEstimate,
} from "@/lib/minipay/rawTx";

type ResultActionsProps = {
  piece: string;
  score: string;
  moves: string;
  status: string;
};

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

type MiniPayDebugSnapshot = {
  chainIdHex: string;
  chainId: number | null;
  account: string | null;
  badgesAddress: string | null;
  scoreboardAddress: string | null;
  badgesHasCode: boolean;
  scoreboardHasCode: boolean;
  scoreSigner: string | null;
  error: string | null;
};

type RawPayloadPreview = {
  label: "claim" | "submit";
  from: string;
  to: string;
  gas: string;
  feeCurrency: string | null;
  dataPrefix: string;
};

type QaRunState = {
  claimTxHash: string | null;
  submitTxHash: string | null;
  claimAgainResult: string | null;
  lastError: string | null;
};

const signerReadAbi = [
  {
    type: "function",
    name: "signer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const CLAIM_RAW_GAS = "0x493e0";
const SUBMIT_RAW_GAS = "0x7a120";

function shortenHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function dataPrefix(data: `0x${string}`) {
  return `${data.slice(0, 18)}...${data.slice(-10)}`;
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

function isBadgeAlreadyClaimedError(errorMessage: string) {
  return errorMessage.includes("BadgeAlreadyClaimed");
}

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

export function ResultActions({ piece, score, moves, status }: ResultActionsProps) {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { isMiniPay, hasProvider, isReady } = useMiniPay();
  const {
    data: submitHash,
    error: submitError,
    isPending: isSubmitPending,
    writeContractAsync: writeSubmitContractAsync,
    reset: resetSubmit,
  } = useWriteContract();
  const {
    data: claimHash,
    error: claimError,
    isPending: isClaimPending,
    writeContractAsync: writeClaimContractAsync,
    reset: resetClaim,
  } = useWriteContract();
  const { isLoading: isSubmitConfirming, isSuccess: isSubmitConfirmed } = useWaitForTransactionReceipt({
    chainId,
    hash: submitHash,
    query: {
      enabled: Boolean(submitHash),
    },
  });
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({
    chainId,
    hash: claimHash,
    query: {
      enabled: Boolean(claimHash),
    },
  });
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [claimBadgeError, setClaimBadgeError] = useState<string | null>(null);
  const [miniPayDebug, setMiniPayDebug] = useState<MiniPayDebugSnapshot | null>(null);
  const [lastProbeResult, setLastProbeResult] = useState<string | null>(null);
  const [lastRawTxPayload, setLastRawTxPayload] = useState<string | null>(null);
  const [lastRawTxResult, setLastRawTxResult] = useState<string | null>(null);
  const [isQaOpen, setIsQaOpen] = useState(true);
  const [qaLevelInput, setQaLevelInput] = useState("2");
  const [qaState, setQaState] = useState<QaRunState>({
    claimTxHash: null,
    submitTxHash: null,
    claimAgainResult: null,
    lastError: null,
  });

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const defaultLevelId = useMemo(() => getLevelId(piece), [piece]);
  const qaEnabled = useMemo(
    () => process.env.NEXT_PUBLIC_QA_MODE === "1" || searchParams.get("qa") === "1",
    [searchParams]
  );
  const qaLevel = useMemo(() => Number.parseInt(qaLevelInput, 10), [qaLevelInput]);
  const isQaLevelValid = Number.isInteger(qaLevel) && qaLevel >= 1 && qaLevel <= 9999;
  const levelId = useMemo(
    () => (qaEnabled ? (isQaLevelValid ? BigInt(qaLevel) : 0n) : defaultLevelId),
    [defaultLevelId, isQaLevelValid, qaEnabled, qaLevel]
  );
  const rawToolsEnabled = useMemo(
    () => process.env.NEXT_PUBLIC_ENABLE_MINIPAY_RAWTX !== "0",
    []
  );
  const parsedScore = BigInt(Number.parseInt(score, 10) || 0);
  const parsedMoves = BigInt(Number.parseInt(moves, 10) || 0);
  const parsedTimeMs = parsedMoves > 0n ? parsedMoves * 1000n : 1000n;
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

  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const canSubmit =
    isReady &&
    hasProvider &&
    isConnected &&
    Boolean(address) &&
    isCorrectChain &&
    Boolean(scoreboardAddress) &&
    levelId > 0n &&
    status === "success";
  const canClaimBadge =
    isReady &&
    hasProvider &&
    isConnected &&
    Boolean(address) &&
    isCorrectChain &&
    Boolean(badgesAddress) &&
    levelId > 0n &&
    status === "success" &&
    !hasClaimedBadge;

  const buildClaimRequest = async (player: `0x${string}`, selectedLevelId: bigint = levelId) => {
    if (!badgesAddress) {
      throw new Error("Missing badges address");
    }

    const signed = await requestSignature("/api/sign-badge", {
      player,
      levelId: Number(selectedLevelId),
    });
    const args = [
      selectedLevelId,
      BigInt(signed.nonce),
      BigInt(signed.deadline),
      signed.signature,
    ] as const;
    const data = encodeCallData({
      abi: badgesAbi,
      functionName: "claimBadgeSigned",
      args,
    });

    return { args, data };
  };

  const buildSubmitRequest = async (player: `0x${string}`, selectedLevelId: bigint = levelId) => {
    if (!scoreboardAddress) {
      throw new Error("Missing scoreboard address");
    }

    const signed = await requestSignature("/api/sign-score", {
      player,
      levelId: Number(selectedLevelId),
      score: Number(parsedScore),
      timeMs: Number(parsedTimeMs),
    });
    const args = [
      selectedLevelId,
      parsedScore,
      parsedTimeMs,
      BigInt(signed.nonce),
      BigInt(signed.deadline),
      signed.signature,
    ] as const;
    const data = encodeCallData({
      abi: scoreboardAbi,
      functionName: "submitScoreSigned",
      args,
    });

    return { args, data };
  };

  const handleSubmitScore = async () => {
    if (!canSubmit || !scoreboardAddress || !address || (qaEnabled && !isQaLevelValid)) {
      return;
    }

    setSubmissionError(null);
    setQaState((previous) => ({ ...previous, lastError: null }));
    resetSubmit();

    try {
      const { args } = await buildSubmitRequest(address);
      const baseRequest = {
        address: scoreboardAddress,
        abi: scoreboardAbi,
        functionName: "submitScoreSigned" as const,
        args,
        chainId,
        account: address,
      } as const;

      let gasOverride: bigint | undefined;
      try {
        const estimatedGas = await publicClient?.estimateContractGas(baseRequest);
        gasOverride = estimatedGas ? (estimatedGas * 12n) / 10n : undefined;
      } catch {
        gasOverride = undefined;
      }

      const txHash = await writeSubmitContractAsync(
        (feeCurrency
          ? {
              ...baseRequest,
              feeCurrency,
              ...(gasOverride ? { gas: gasOverride } : {}),
            }
          : {
              ...baseRequest,
              ...(gasOverride ? { gas: gasOverride } : {}),
            }) as Parameters<typeof writeSubmitContractAsync>[0]
      );
      setQaState((previous) => ({
        ...previous,
        submitTxHash: txHash,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not submit score";
      setSubmissionError(errorMessage);
      setQaState((previous) => ({
        ...previous,
        lastError: errorMessage,
      }));
    }
  };

  const handleClaimBadge = async (ignoreClaimedGate = false) => {
    if (!badgesAddress || !address || (qaEnabled && !isQaLevelValid)) {
      return;
    }

    if (!ignoreClaimedGate && !canClaimBadge) {
      return;
    }

    setClaimBadgeError(null);
    setQaState((previous) => ({
      ...previous,
      lastError: null,
      ...(ignoreClaimedGate ? { claimAgainResult: null } : {}),
    }));
    resetClaim();

    try {
      const { args } = await buildClaimRequest(address);
      const baseRequest = {
        address: badgesAddress,
        abi: badgesAbi,
        functionName: "claimBadgeSigned" as const,
        args,
        chainId,
        account: address,
      } as const;

      let gasOverride: bigint | undefined;
      try {
        const estimatedGas = await publicClient?.estimateContractGas(baseRequest);
        gasOverride = estimatedGas ? (estimatedGas * 12n) / 10n : undefined;
      } catch {
        gasOverride = undefined;
      }

      const txHash = await writeClaimContractAsync(
        (feeCurrency
          ? {
              ...baseRequest,
              feeCurrency,
              ...(gasOverride ? { gas: gasOverride } : {}),
            }
          : {
              ...baseRequest,
              ...(gasOverride ? { gas: gasOverride } : {}),
            }) as Parameters<typeof writeClaimContractAsync>[0]
      );
      setQaState((previous) => ({
        ...previous,
        claimTxHash: txHash,
        ...(ignoreClaimedGate ? { claimAgainResult: "Unexpected success (should fail)" } : {}),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not claim badge";
      setClaimBadgeError(errorMessage);
      setQaState((previous) => ({
        ...previous,
        lastError: errorMessage,
        ...(ignoreClaimedGate
          ? {
              claimAgainResult: isBadgeAlreadyClaimedError(errorMessage)
                ? "Expected fail ✅"
                : "Unexpected error",
            }
          : {}),
      }));
    }
  };

  const handleClaimAgainExpectedFail = async () => {
    if (!qaEnabled || !badgesAddress || !address || !isQaLevelValid) {
      return;
    }

    const provider = getMiniPayProvider();
    if (!provider) {
      setQaState((previous) => ({
        ...previous,
        claimAgainResult: "Unexpected error",
        lastError: "MiniPay provider not available",
      }));
      return;
    }

    try {
      const account = (await requestAccount(provider)) ?? address;
      if (!account) {
        throw new Error("No account available");
      }
      const claim = await buildClaimRequest(account as `0x${string}`, levelId);
      const txPayload = {
        from: account as `0x${string}`,
        to: badgesAddress,
        data: claim.data,
        gas: CLAIM_RAW_GAS,
        ...(feeCurrency ? { feeCurrency } : {}),
      } as const;

      console.info("[MiniPayTx] request", {
        label: "claim-again-expected-fail",
        levelId: Number(levelId),
        tx: txPayload,
      });
      const result = await sendRawTxNoEstimate(provider, txPayload, {
        skipFeeCurrencyRetry: true,
        logLabel: "claim-again-expected-fail",
      });

      if (result.txHash) {
        console.info("[MiniPayTx] result", {
          label: "claim-again-expected-fail",
          levelId: Number(levelId),
          txHash: result.txHash,
        });
        setQaState((previous) => ({
          ...previous,
          claimTxHash: result.txHash,
          claimAgainResult: "Unexpected success (should fail)",
          lastError: null,
        }));
        return;
      }

      const errorMessage = toErrorMessage(result.error);
      console.warn("[MiniPayTx] error", {
        label: "claim-again-expected-fail",
        levelId: Number(levelId),
        error: errorMessage,
      });
      setQaState((previous) => ({
        ...previous,
        claimAgainResult: isBadgeAlreadyClaimedError(errorMessage) ? "Expected fail ✅" : "Unexpected error",
        lastError: errorMessage,
      }));
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      console.warn("[MiniPayTx] error", {
        label: "claim-again-expected-fail",
        levelId: Number(levelId),
        error: errorMessage,
      });
      setQaState((previous) => ({
        ...previous,
        claimAgainResult: isBadgeAlreadyClaimedError(errorMessage) ? "Expected fail ✅" : "Unexpected error",
        lastError: errorMessage,
      }));
    }
  };

  const handleMiniPayDebug = async () => {
    const provider = getMiniPayProvider();
    if (!provider || !badgesAddress || !scoreboardAddress) {
      setMiniPayDebug({
        chainIdHex: "n/a",
        chainId: null,
        account: address ?? null,
        badgesAddress: badgesAddress ?? null,
        scoreboardAddress: scoreboardAddress ?? null,
        badgesHasCode: false,
        scoreboardHasCode: false,
        scoreSigner: null,
        error: "Missing MiniPay provider or contract addresses",
      });
      return;
    }

    try {
      const chainInfo = await requestChainId(provider);
      const account = await requestAccount(provider);
      const miniPayClient = createPublicClient({
        transport: custom(provider),
      });

      const [badgesCode, scoreboardCode, scoreSigner] = await Promise.all([
        miniPayClient.getBytecode({ address: badgesAddress }),
        miniPayClient.getBytecode({ address: scoreboardAddress }),
        miniPayClient.readContract({
          address: scoreboardAddress,
          abi: signerReadAbi,
          functionName: "signer",
        }),
      ]);

      setMiniPayDebug({
        chainIdHex: chainInfo.chainIdHex,
        chainId: chainInfo.chainId,
        account,
        badgesAddress,
        scoreboardAddress,
        badgesHasCode: Boolean(badgesCode && badgesCode !== "0x"),
        scoreboardHasCode: Boolean(scoreboardCode && scoreboardCode !== "0x"),
        scoreSigner,
        error: null,
      });
    } catch (error) {
      setMiniPayDebug({
        chainIdHex: "error",
        chainId: null,
        account: address ?? null,
        badgesAddress,
        scoreboardAddress,
        badgesHasCode: false,
        scoreboardHasCode: false,
        scoreSigner: null,
        error: error instanceof Error ? error.message : "MiniPay debug failed",
      });
    }
  };

  const handleProbeEstimateAndCall = async () => {
    const provider = getMiniPayProvider();
    if (!provider || !badgesAddress || !scoreboardAddress) {
      setLastProbeResult("Missing MiniPay provider or addresses");
      return;
    }

    const account = (await requestAccount(provider)) ?? address;
    if (!account) {
      setLastProbeResult("No account available in MiniPay provider");
      return;
    }

    try {
      const [claim, submit] = await Promise.all([
        buildClaimRequest(account as `0x${string}`),
        buildSubmitRequest(account as `0x${string}`),
      ]);

      const [claimProbe, submitProbe] = await Promise.all([
        probeEstimateAndCall(provider, {
          from: account as `0x${string}`,
          to: badgesAddress,
          data: claim.data,
        }),
        probeEstimateAndCall(provider, {
          from: account as `0x${string}`,
          to: scoreboardAddress,
          data: submit.data,
        }),
      ]);

      setLastProbeResult(
        safeJson({
          chainId,
          account,
          claimProbe,
          submitProbe,
        })
      );
    } catch (error) {
      setLastProbeResult(safeJson({ error }));
    }
  };

  const handleSendRawClaim = async () => {
    const provider = getMiniPayProvider();
    if (!provider || !badgesAddress) {
      setLastRawTxResult("Missing MiniPay provider or badges address");
      return;
    }

    const account = (await requestAccount(provider)) ?? address;
    if (!account) {
      setLastRawTxResult("No account available in MiniPay provider");
      return;
    }

    try {
      const claim = await buildClaimRequest(account as `0x${string}`);
      const payload: RawPayloadPreview = {
        label: "claim",
        from: account,
        to: badgesAddress,
        gas: CLAIM_RAW_GAS,
        feeCurrency: feeCurrency ?? null,
        dataPrefix: dataPrefix(claim.data),
      };
      setLastRawTxPayload(safeJson(payload));

      const result = await sendRawTxNoEstimate(provider, {
        from: account as `0x${string}`,
        to: badgesAddress,
        data: claim.data,
        gas: CLAIM_RAW_GAS,
        ...(feeCurrency ? { feeCurrency } : {}),
      }, {
        skipFeeCurrencyRetry: true,
        logLabel: "result-actions-claim-raw",
      });
      setLastRawTxResult(
        safeJson({
          txHash: result.txHash,
          error: result.error,
          payload: result.payload,
        })
      );
    } catch (error) {
      setLastRawTxResult(safeJson({ error }));
    }
  };

  const handleSendRawSubmit = async () => {
    const provider = getMiniPayProvider();
    if (!provider || !scoreboardAddress) {
      setLastRawTxResult("Missing MiniPay provider or scoreboard address");
      return;
    }

    const account = (await requestAccount(provider)) ?? address;
    if (!account) {
      setLastRawTxResult("No account available in MiniPay provider");
      return;
    }

    try {
      const submit = await buildSubmitRequest(account as `0x${string}`);
      const payload: RawPayloadPreview = {
        label: "submit",
        from: account,
        to: scoreboardAddress,
        gas: SUBMIT_RAW_GAS,
        feeCurrency: feeCurrency ?? null,
        dataPrefix: dataPrefix(submit.data),
      };
      setLastRawTxPayload(safeJson(payload));

      const result = await sendRawTxNoEstimate(provider, {
        from: account as `0x${string}`,
        to: scoreboardAddress,
        data: submit.data,
        gas: SUBMIT_RAW_GAS,
        ...(feeCurrency ? { feeCurrency } : {}),
      }, {
        skipFeeCurrencyRetry: true,
        logLabel: "result-actions-submit-raw",
      });
      setLastRawTxResult(
        safeJson({
          txHash: result.txHash,
          error: result.error,
          payload: result.payload,
        })
      );
    } catch (error) {
      setLastRawTxResult(safeJson({ error }));
    }
  };

  const explorerSubdomain = chainId === 44787 ? "alfajores." : chainId === 11142220 ? "sepolia." : "";
  const explorerBaseUrl = `https://${explorerSubdomain}celoscan.io/tx/`;

  return (
    <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          On-chain proof
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Enviar puntaje on-chain
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          El backend firma el payload EIP-712 y MiniPay solo envia la transaccion. El flujo mantiene
          legacy tx y fee currency opcional si la configuracion del entorno la define.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Wallet state</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">
            {!isReady
              ? "Detectando provider"
              : !hasProvider
                ? "No provider"
                : !isConnected
                  ? "Wallet not connected"
                  : isMiniPay
                    ? "MiniPay connected"
                    : "Wallet connected"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Chain</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">
            {chainId ? `${chainId}` : "No chain"}
            {configuredChainId ? ` / target ${configuredChainId}` : ""}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Scoreboard</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-950">
            {scoreboardAddress ?? "Missing NEXT_PUBLIC_SCOREBOARD_ADDRESS"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Badge state</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">
            {hasClaimedBadge ? "Claimed" : "Pending"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Badges contract</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-950">
            {badgesAddress ?? "Missing NEXT_PUBLIC_BADGES_ADDRESS"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          disabled={!canSubmit || isSubmitPending || isSubmitConfirming}
          onClick={handleSubmitScore}
        >
          {isSubmitPending
            ? "Esperando wallet..."
            : isSubmitConfirming
              ? "Confirmando..."
              : "Enviar puntaje on-chain"}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          disabled={!canClaimBadge || isClaimPending || isClaimConfirming}
          onClick={() => {
            void handleClaimBadge();
          }}
        >
          {hasClaimedBadge
            ? "Badge claimed"
            : isClaimPending
              ? "Esperando wallet..."
              : isClaimConfirming
                ? "Confirmando..."
                : "Reclamar badge (NFT)"}
        </Button>
      </div>

      {qaEnabled ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Debug QA
            </p>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => setIsQaOpen((previous) => !previous)}
            >
              {isQaOpen ? "Hide" : "Show"}
            </Button>
          </div>

          {isQaOpen ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex w-full max-w-[200px] flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  LevelId
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    type="number"
                    min={1}
                    max={9999}
                    value={qaLevelInput}
                    onChange={(event) => {
                      setQaLevelInput(event.target.value);
                    }}
                  />
                </label>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  onClick={() => {
                    if (!isQaLevelValid) {
                      return;
                    }
                    setQaLevelInput(String(Math.min(9999, qaLevel + 1)));
                  }}
                >
                  Level +1
                </Button>
              </div>
              {!isQaLevelValid ? (
                <p className="text-sm text-rose-700">LevelId must be between 1 and 9999.</p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  className="w-full sm:w-auto"
                  disabled={!canClaimBadge || isClaimPending || isClaimConfirming || !isQaLevelValid}
                  onClick={() => {
                    void handleClaimBadge();
                  }}
                >
                  A) Claim badge
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={!canSubmit || isSubmitPending || isSubmitConfirming || !isQaLevelValid}
                  onClick={() => {
                    void handleSubmitScore();
                  }}
                >
                  B) Submit score
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={isClaimPending || isClaimConfirming || !isQaLevelValid}
                  onClick={() => {
                    void handleClaimAgainExpectedFail();
                  }}
                >
                  C) Claim again (expected fail)
                </Button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <p>chainId: {chainId ?? "n/a"}</p>
                <p>account: {address ?? "n/a"}</p>
                <p>levelId: {isQaLevelValid ? qaLevel : "invalid"}</p>
                <p>badgesAddress: {badgesAddress ?? "missing"}</p>
                <p>scoreboardAddress: {scoreboardAddress ?? "missing"}</p>
                <p>claimTxHash: {qaState.claimTxHash ?? claimHash ?? "n/a"}</p>
                <p>submitTxHash: {qaState.submitTxHash ?? submitHash ?? "n/a"}</p>
                <p>claimAgain: {qaState.claimAgainResult ?? "n/a"}</p>
                <p>lastError: {qaState.lastError ?? "n/a"}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            MiniPay debug
          </p>
          <Button className="w-full sm:w-auto" variant="outline" onClick={handleMiniPayDebug}>
            Run provider diagnostics
          </Button>
        </div>
        {miniPayDebug ? (
          <pre className="mt-3 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-700">
            {safeJson(miniPayDebug)}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Ejecuta el diagnostico dentro de MiniPay para confirmar red real, bytecode y signer().
          </p>
        )}
      </div>

      {isMiniPay && rawToolsEnabled ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Advanced (MiniPay)
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button className="w-full sm:w-auto" variant="outline" onClick={handleProbeEstimateAndCall}>
              Probe estimate/call (MiniPay)
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={handleSendRawClaim}>
              Send raw claim (no-estimate)
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={handleSendRawSubmit}>
              Send raw submit (no-estimate)
            </Button>
          </div>
          {lastRawTxPayload ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Last raw payload</p>
              <pre className="mt-2 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-700">
                {lastRawTxPayload}
              </pre>
            </div>
          ) : null}
          {lastProbeResult ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Last probe result</p>
              <pre className="mt-2 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-700">
                {lastProbeResult}
              </pre>
            </div>
          ) : null}
          {lastRawTxResult ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Last raw tx result</p>
              <pre className="mt-2 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-700">
                {lastRawTxResult}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {!hasProvider ? (
        <p className="text-sm text-slate-600">
          Abre esta pantalla dentro de MiniPay o conecta una wallet compatible para enviar la transaccion.
        </p>
      ) : null}
      {configuredChainId && !isCorrectChain ? (
        <p className="text-sm text-amber-700">
          Cambia la wallet a la red {configuredChainId} para usar las direcciones configuradas del demo.
        </p>
      ) : null}
      {status !== "success" ? (
        <p className="text-sm text-slate-600">
          El submit on-chain se habilita cuando el challenge termina en exito.
        </p>
      ) : null}
      {!scoreboardAddress ? (
        <p className="text-sm text-amber-700">
          Falta configurar la direccion del contrato Scoreboard para la red actual.
        </p>
      ) : null}
      {!badgesAddress ? (
        <p className="text-sm text-amber-700">
          Falta configurar la direccion del contrato Badges para la red actual.
        </p>
      ) : null}

      {submissionError ? <p className="text-sm text-rose-700">{submissionError}</p> : null}
      {submitError ? <p className="text-sm text-rose-700">{submitError.message}</p> : null}
      {claimBadgeError ? <p className="text-sm text-rose-700">{claimBadgeError}</p> : null}
      {claimError ? <p className="text-sm text-rose-700">{claimError.message}</p> : null}

      {submitHash ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">Score tx hash</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-700">{submitHash}</p>
          <p className="mt-2 text-xs text-slate-600">
            {isSubmitConfirmed ? "Confirmed" : "Submitted"}
          </p>
          <Link
            href={`${explorerBaseUrl}${submitHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-xs font-semibold text-primary"
          >
            Ver en explorer ({shortenHash(submitHash)})
          </Link>
        </div>
      ) : null}
      {claimHash ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">Badge tx hash</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-700">{claimHash}</p>
          <p className="mt-2 text-xs text-slate-600">
            {isClaimConfirmed ? "Confirmed" : "Submitted"}
          </p>
          <Link
            href={`${explorerBaseUrl}${claimHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-xs font-semibold text-primary"
            onClick={() => {
              void refetchClaimedBadge();
            }}
          >
            Ver en explorer ({shortenHash(claimHash)})
          </Link>
        </div>
      ) : null}
    </div>
  );
}
