"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
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

type ResultActionsProps = {
  piece: string;
  score: string;
  moves: string;
  status: string;
};

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

function shortenHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { isMiniPay, hasProvider, isReady } = useMiniPay();
  const {
    data: submitHash,
    error: submitError,
    isPending: isSubmitPending,
    writeContract: writeSubmitContract,
    reset: resetSubmit,
  } = useWriteContract();
  const {
    data: claimHash,
    error: claimError,
    isPending: isClaimPending,
    writeContract: writeClaimContract,
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

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const levelId = useMemo(() => getLevelId(piece), [piece]);
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

  const handleSubmitScore = async () => {
    if (!canSubmit || !scoreboardAddress || !address) {
      return;
    }

    setSubmissionError(null);
    resetSubmit();

    try {
      const signed = await requestSignature("/api/sign-score", {
        player: address,
        levelId: Number(levelId),
        score: Number(parsedScore),
        timeMs: Number(parsedTimeMs),
      });

      const baseRequest = {
        address: scoreboardAddress,
        abi: scoreboardAbi,
        functionName: "submitScoreSigned" as const,
        args: [
          levelId,
          parsedScore,
          parsedTimeMs,
          BigInt(signed.nonce),
          BigInt(signed.deadline),
          signed.signature,
        ],
        chainId,
        account: address,
      } as const;

      writeSubmitContract(
        (feeCurrency
          ? {
              ...baseRequest,
              feeCurrency,
            }
          : baseRequest) as Parameters<typeof writeSubmitContract>[0]
      );
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not submit score");
    }
  };

  const handleClaimBadge = async () => {
    if (!canClaimBadge || !badgesAddress || !address) {
      return;
    }

    setClaimBadgeError(null);
    resetClaim();

    try {
      const signed = await requestSignature("/api/sign-badge", {
        player: address,
        levelId: Number(levelId),
      });

      const baseRequest = {
        address: badgesAddress,
        abi: badgesAbi,
        functionName: "claimBadgeSigned" as const,
        args: [levelId, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature],
        chainId,
        account: address,
      } as const;

      writeClaimContract(
        (feeCurrency
          ? {
              ...baseRequest,
              feeCurrency,
            }
          : baseRequest) as Parameters<typeof writeClaimContract>[0]
      );
    } catch (error) {
      setClaimBadgeError(error instanceof Error ? error.message : "Could not claim badge");
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
            {hasClaimedBadge ? "Claimed" : "Unclaimed"}
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
          onClick={handleClaimBadge}
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
