"use client";

import { useState } from "react";
import { erc20Abi } from "viem";

import {
  getMiniPayProvider,
  requestAccount,
  requestChainId,
  safeJson,
  type Eip1193Provider,
} from "@/lib/minipay/provider";
import {
  encodeCallData,
  probeEstimateAndCall,
  requestLegacyGasPrice,
  sendRawTxNoEstimate,
} from "@/lib/minipay/rawTx";
import { getMiniPayFeeCurrency } from "@/lib/contracts/chains";
import { getTreasuryAddressClient } from "@/lib/payments/rail-config";
import { ACCEPTED_TOKENS } from "@/lib/contracts/tokens";

/** One unit of a 6-decimal stablecoin — 0.000001 USDT. Small enough that a
 *  success costs nothing, real enough that it exercises the same path as a
 *  Get Peones payment. */
const DUST = 1n;

type Step = { label: string; value: unknown };

export function MiniPayRawSendClient() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);

  const push = (label: string, value: unknown) =>
    setSteps((prev) => [...prev, { label, value }]);

  async function run(withFeeCurrency: boolean) {
    setSteps([]);
    setBusy(true);
    try {
      const provider = getMiniPayProvider() as Eip1193Provider | null;
      if (!provider) {
        push("provider", "NOT FOUND — open this page inside MiniPay");
        return;
      }

      const [account, chainId] = await Promise.all([
        requestAccount(provider),
        requestChainId(provider),
      ]);
      const treasury = getTreasuryAddressClient();
      const token = ACCEPTED_TOKENS.find((t) => t.symbol === "USDT")!;
      const feeCurrency = getMiniPayFeeCurrency(Number(chainId));

      push("context", {
        account,
        chainId,
        treasury,
        token: token.address,
        feeCurrencyConfigured: feeCurrency ?? null,
        sendingWithFeeCurrency: withFeeCurrency,
      });

      if (!account || !treasury) {
        push("abort", "missing account or treasury");
        return;
      }

      const data = encodeCallData({
        abi: erc20Abi as unknown as readonly unknown[],
        functionName: "transfer",
        args: [treasury, DUST],
      });

      // Does the provider even let us READ? Separates "MiniPay refuses this
      // app entirely" from "MiniPay refuses this particular send".
      push(
        "eth_estimateGas + eth_call",
        await probeEstimateAndCall(provider, {
          from: account as `0x${string}`,
          to: token.address,
          data,
        }),
      );

      if (withFeeCurrency && feeCurrency) {
        push("eth_gasPrice(feeCurrency)", await requestLegacyGasPrice(provider, feeCurrency));
      }

      // The whole point: a bare eth_sendTransaction with NO gas fields, so
      // nothing viem adds can be blamed. MiniPay fills gas itself.
      push(
        "eth_sendTransaction (raw)",
        await sendRawTxNoEstimate(
          provider,
          {
            from: account as `0x${string}`,
            to: token.address,
            data,
            ...(withFeeCurrency && feeCurrency ? { feeCurrency } : {}),
          },
          { skipFeeCurrencyRetry: !withFeeCurrency, logLabel: "raw-probe" },
        ),
      );
    } catch (err) {
      push("threw", err instanceof Error ? { name: err.name, message: err.message } : err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 16, fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 16 }}>MiniPay raw send probe</h1>
      <p>
        Sends <code>eth_sendTransaction</code> straight through
        <code> window.ethereum</code> — no wagmi, no viem. If this succeeds while
        the app fails, the request wagmi builds is the problem. If this is
        denied too, MiniPay is refusing the app itself.
      </p>
      <p>Transfers 0.000001 USDT to the treasury.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <button type="button" disabled={busy} onClick={() => run(false)} style={btn}>
          Send WITHOUT feeCurrency
        </button>
        <button type="button" disabled={busy} onClick={() => run(true)} style={btn}>
          Send WITH feeCurrency
        </button>
      </div>

      {steps.map((s, i) => (
        <section key={i} style={{ marginBottom: 12 }}>
          <strong>{s.label}</strong>
          <pre style={pre}>{safeJson(s.value)}</pre>
        </section>
      ))}
    </main>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #444",
  borderRadius: 8,
  background: "#111",
  color: "#fff",
};

const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  background: "#0b0b0b",
  color: "#d8d8d8",
  padding: 8,
  borderRadius: 6,
  margin: "4px 0 0",
};
