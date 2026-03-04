"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { Button } from "@/components/ui/button";
import { useMiniPay } from "@/hooks/use-minipay";
import { getMiniPayFeeCurrency, getScoreboardAddress } from "@/lib/contracts/chains";
import { getLevelId, scoreboardAbi } from "@/lib/contracts/scoreboard";

type ResultActionsProps = {
  piece: string;
  score: string;
  moves: string;
  status: string;
};

function shortenHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function ResultActions({ piece, score, moves, status }: ResultActionsProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { isMiniPay, hasProvider, isReady } = useMiniPay();
  const { data: hash, error, isPending, writeContract, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    chainId,
    hash,
    query: {
      enabled: Boolean(hash),
    },
  });
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const levelId = useMemo(() => getLevelId(piece), [piece]);
  const parsedScore = BigInt(Number.parseInt(score, 10) || 0);
  const parsedMoves = BigInt(Number.parseInt(moves, 10) || 0);
  const parsedTimeMs = parsedMoves > 0n ? parsedMoves * 1000n : 1000n;

  const canSubmit =
    isReady &&
    hasProvider &&
    isConnected &&
    Boolean(address) &&
    Boolean(scoreboardAddress) &&
    levelId > 0n &&
    status === "success";

  const handleSubmitScore = async () => {
    if (!canSubmit || !scoreboardAddress) {
      return;
    }

    setSubmissionError(null);
    reset();

    const baseRequest = {
      address: scoreboardAddress,
      abi: scoreboardAbi,
      functionName: "submitScore" as const,
      args: [levelId, parsedScore, parsedTimeMs, BigInt(Date.now())],
      chainId,
      account: address,
      type: isMiniPay ? ("legacy" as const) : undefined,
    } as const;

    try {
      writeContract(
        (feeCurrency
          ? {
              ...baseRequest,
              feeCurrency,
            }
          : baseRequest) as Parameters<typeof writeContract>[0]
      );
    } catch (submitError) {
      setSubmissionError(submitError instanceof Error ? submitError.message : "Could not submit score");
    }
  };

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
          Crea la prueba on-chain del resultado local. El flujo usa transaccion legacy dentro de
          MiniPay y fee currency opcional si la configuracion del entorno la define.
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
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contract</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-950">
            {scoreboardAddress ?? "Missing NEXT_PUBLIC_SCOREBOARD_ADDRESS_*"}
          </p>
        </div>
      </div>

      <Button className="w-full sm:w-auto" disabled={!canSubmit || isPending || isConfirming} onClick={handleSubmitScore}>
        {isPending ? "Esperando wallet..." : isConfirming ? "Confirmando..." : "Enviar puntaje on-chain"}
      </Button>

      {!hasProvider ? (
        <p className="text-sm text-slate-600">
          Abre esta pantalla dentro de MiniPay o conecta una wallet compatible para enviar la transaccion.
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

      {submissionError ? <p className="text-sm text-rose-700">{submissionError}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error.message}</p> : null}

      {hash ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">Transaction hash</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-700">{hash}</p>
          <p className="mt-2 text-xs text-slate-600">
            {isConfirmed ? "Confirmed" : "Submitted"}
          </p>
          <Link
            href={`https://${chainId === 11142220 ? "sepolia." : ""}celoscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-xs font-semibold text-primary"
          >
            Ver en explorer ({shortenHash(hash)})
          </Link>
        </div>
      ) : null}
    </div>
  );
}
