"use client";

import { useMemo, useState } from "react";
import { toHex } from "viem";
import { useChainId } from "wagmi";

import { Button } from "@/components/ui/button";
import { badgesAbi } from "@/lib/contracts/badges";
import {
  getBadgesAddress,
  getMiniPayFeeCurrency,
  getScoreboardAddress,
} from "@/lib/contracts/chains";
import {
  getMiniPayProvider,
  requestAccount,
  requestChainId,
  safeJson,
} from "@/lib/minipay/provider";
import {
  encodeCallData,
  probeEstimateAndCall,
  requestLegacyGasPrice,
  sendRawTxNoEstimate,
} from "@/lib/minipay/rawTx";
import { scoreboardAbi } from "@/lib/contracts/scoreboard";

const SUBMIT_RAW_GAS = "0x7a120";

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

function truncateData(data: `0x${string}`) {
  return `${data.slice(0, 18)}...${data.slice(-10)} (${data.length} chars)`;
}

function toBufferedGasPriceHex(gasPriceHex: `0x${string}`) {
  const current = BigInt(gasPriceHex);
  const buffered = (current * 125n + 99n) / 100n;
  return toHex(buffered) as `0x${string}`;
}

async function requestBadgeSignature(player: `0x${string}`) {
  const response = await fetch("/api/sign-badge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ player, levelId: 1 }),
  });
  const payload = (await response.json()) as SignatureResponse;

  if (!response.ok || "error" in payload) {
    throw new Error(payload.error ?? "Could not sign badge");
  }

  return payload;
}

async function requestScoreSignature(player: `0x${string}`) {
  const response = await fetch("/api/sign-score", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ player, levelId: 1, score: 100, timeMs: 1000 }),
  });
  const payload = (await response.json()) as SignatureResponse;

  if (!response.ok || "error" in payload) {
    throw new Error(payload.error ?? "Could not sign score");
  }

  return payload;
}

export default function TxLabPage() {
  const chainId = useChainId();
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastProbe, setLastProbe] = useState<string | null>(null);

  const withMiniPayContext = async <T,>(
    fn: (
      provider: NonNullable<ReturnType<typeof getMiniPayProvider>>,
      account: `0x${string}`
    ) => Promise<T>
  ) => {
    const provider = getMiniPayProvider();
    if (!provider) {
      throw new Error("MiniPay provider not detected. Open this page in MiniPay.");
    }

    const account = await requestAccount(provider);
    if (!account) {
      throw new Error("No account returned by MiniPay provider");
    }

    return fn(provider, account as `0x${string}`);
  };

  const handleProbe = async () => {
    try {
      await withMiniPayContext(async (provider, account) => {
        if (!badgesAddress || !scoreboardAddress) {
          throw new Error("Missing badges or scoreboard address for the current chain");
        }

        const [claimSig, submitSig] = await Promise.all([
          requestBadgeSignature(account),
          requestScoreSignature(account),
        ]);

        const claimData = encodeCallData({
          abi: badgesAbi,
          functionName: "claimBadgeSigned",
          args: [1n, BigInt(claimSig.nonce), BigInt(claimSig.deadline), claimSig.signature],
        });
        const submitData = encodeCallData({
          abi: scoreboardAbi,
          functionName: "submitScoreSigned",
          args: [1n, 100n, 1000n, BigInt(submitSig.nonce), BigInt(submitSig.deadline), submitSig.signature],
        });

        const [claimProbe, submitProbe] = await Promise.all([
          probeEstimateAndCall(provider, { from: account, to: badgesAddress, data: claimData }),
          probeEstimateAndCall(provider, { from: account, to: scoreboardAddress, data: submitData }),
        ]);

        setLastProbe(
          safeJson({
            chain: await requestChainId(provider),
            account,
            claimProbe,
            submitProbe,
          })
        );
      });
    } catch (error) {
      setLastProbe(safeJson({ error }));
    }
  };

  const handleSendSubmitMatrix = async (mode: "A" | "B" | "C") => {
    try {
      await withMiniPayContext(async (provider, account) => {
        if (!scoreboardAddress) {
          throw new Error("Missing scoreboard address for the current chain");
        }

        const signed = await requestScoreSignature(account);
        const data = encodeCallData({
          abi: scoreboardAbi,
          functionName: "submitScoreSigned",
          args: [1n, 100n, 1000n, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature],
        });

        const txBase = {
          from: account,
          to: scoreboardAddress,
          data,
          gas: SUBMIT_RAW_GAS,
        } as const;

        if (mode === "A") {
          setLastPayload(
            safeJson({
              label: "A) sendTransaction minimal",
              tx: txBase,
            })
          );
          const result = await sendRawTxNoEstimate(provider, txBase, {
            skipFeeCurrencyRetry: true,
            logLabel: "tx-lab-submit-A",
          });
          setLastResult(
            safeJson({
              label: "A) sendTransaction minimal",
              txHash: result.txHash,
              error: result.error,
            })
          );
          return;
        }

        if (mode === "B") {
          if (!feeCurrency) {
            throw new Error("NEXT_PUBLIC_MINIPAY_FEE_CURRENCY is not configured");
          }

          const tx = {
            ...txBase,
            feeCurrency,
          } as const;

          setLastPayload(
            safeJson({
              label: "B) sendTransaction minimal + feeCurrency",
              tx,
            })
          );
          const result = await sendRawTxNoEstimate(provider, tx, {
            skipFeeCurrencyRetry: true,
            logLabel: "tx-lab-submit-B",
          });
          setLastResult(
            safeJson({
              label: "B) sendTransaction minimal + feeCurrency",
              txHash: result.txHash,
              error: result.error,
            })
          );
          return;
        }

        const gasPriceResult = await requestLegacyGasPrice(provider);
        if (!gasPriceResult.gasPrice) {
          throw new Error("Could not read eth_gasPrice for matrix C");
        }

        const gasPriceBuffered = toBufferedGasPriceHex(gasPriceResult.gasPrice as `0x${string}`);
        const tx = {
          ...txBase,
          gasPrice: gasPriceBuffered,
        } as const;

        setLastPayload(
          safeJson({
            label: "C) sendTransaction with gasPrice buffered x1.25",
            tx,
            baseGasPrice: gasPriceResult.gasPrice,
            gasPriceBuffered,
            data: truncateData(data),
          })
        );
        const result = await sendRawTxNoEstimate(provider, tx, {
          skipFeeCurrencyRetry: true,
          logLabel: "tx-lab-submit-C",
        });
        setLastResult(
          safeJson({
            label: "C) sendTransaction with gasPrice buffered x1.25",
            txHash: result.txHash,
            error: result.error,
            baseGasPrice: gasPriceResult.gasPrice,
            gasPriceBuffered,
          })
        );
      });
    } catch (error) {
      setLastResult(safeJson({ error }));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-950">Tx Lab (MiniPay / Sepolia)</h1>
      <p className="text-sm text-slate-600">
        Matriz de envio para aislar `eth_sendTransaction` en MiniPay con submitScoreSigned.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>Current chain: {chainId ?? "unknown"}</p>
        <p>Scoreboard: {scoreboardAddress ?? "missing"}</p>
        <p>Badges: {badgesAddress ?? "missing"}</p>
        <p>feeCurrency (env): {feeCurrency ?? "not configured"}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="outline" onClick={handleProbe}>
          Probe estimate/call errors
        </Button>
        <Button variant="outline" onClick={() => void handleSendSubmitMatrix("A")}>
          A) sendTransaction minimal
        </Button>
        <Button
          variant="outline"
          disabled={!feeCurrency}
          onClick={() => void handleSendSubmitMatrix("B")}
        >
          B) minimal + feeCurrency
        </Button>
        <Button variant="outline" onClick={() => void handleSendSubmitMatrix("C")}>
          C) with gasPrice x1.25
        </Button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Last payload
        </p>
        <pre className="mt-2 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          {lastPayload ?? "No payload sent yet"}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Last probe result
        </p>
        <pre className="mt-2 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          {lastProbe ?? "No probe executed yet"}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Last tx result (txHash/error)
        </p>
        <pre className="mt-2 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          {lastResult ?? "No transaction sent yet"}
        </pre>
      </section>
    </main>
  );
}
