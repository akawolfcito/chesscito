"use client";

import { useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";

import { erc20Abi } from "@/lib/contracts/tokens";
import { getMiniPayFeeCurrency } from "@/lib/contracts/chains";
import {
  getPeonesPack,
  getTreasuryAddressClient,
  RAIL_ACCEPTED_STABLECOINS,
} from "@/lib/payments/rail-config";
import { buildPeonesPackTransfer } from "@/lib/payments/transfer-builder";

const SKU = "peones_pack_50" as const;
const CELO_MAINNET = 42220;

type Phase = "idle" | "paying" | "verifying" | "done" | "error";

/**
 * Minimal internal smoke surface for the MiniPay single-tx stablecoin
 * rail. One tap → direct `token.transfer(treasury, amount)` (no approve,
 * gas as stablecoin via feeCurrency) → POST /api/verify-payment → show the
 * verdict. Treasury-gated (fail-closed): no pay button when the treasury
 * env is missing. Touches ONLY the rail — no Shop/PRO/Founder/Victory.
 */
export function RailSmokeClient() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const { connectWallet } = useConnectWallet();

  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Pay with whatever stablecoin the wallet holds (default USDC). The
  // verify endpoint + builder accept any allowlisted token.
  const [tokenSymbol, setTokenSymbol] = useState<string>("USDC");

  const treasury = getTreasuryAddressClient();
  const pack = getPeonesPack(SKU);

  // Fail-closed: no treasury → no button, no path to a placeholder send.
  if (!treasury) {
    return (
      <Shell>
        <p style={{ color: "#b91c1c", fontWeight: 700 }}>
          Rail not configured — NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS is missing/invalid.
        </p>
        <p>Fail-closed: the pay button is disabled until the treasury env is set.</p>
      </Shell>
    );
  }

  const tx = buildPeonesPackTransfer({ sku: SKU, treasury, tokenSymbol });
  const onWrongChain = chainId !== CELO_MAINNET;

  async function verify(hash: `0x${string}`) {
    setPhase("verifying");
    const res = await fetch("/api/verify-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chainId: CELO_MAINNET,
        txHash: hash,
        wallet: address,
        token: tx.token.address,
        sku: SKU,
      }),
    });
    const json = await res.json();
    setResult({ httpStatus: res.status, ...json });
    setPhase("done");
  }

  async function onPay() {
    if (!address) return;
    setErrorMsg(null);
    setResult(null);
    setTxHash(null);
    setPhase("paying");
    const feeCurrency = getMiniPayFeeCurrency(chainId);
    const base = {
      address: tx.token.address,
      abi: erc20Abi,
      functionName: "transfer" as const,
      args: [treasury, tx.expectedAmount] as const,
      chainId: CELO_MAINNET,
      account: address,
    };
    try {
      let hash: `0x${string}`;
      try {
        hash = await writeContractAsync(
          (feeCurrency ? { ...base, feeCurrency } : base) as Parameters<
            typeof writeContractAsync
          >[0],
        );
      } catch (e) {
        // MiniPay feeCurrency rejected → retry once without it.
        if (!feeCurrency) throw e;
        hash = await writeContractAsync(base as Parameters<typeof writeContractAsync>[0]);
      }
      setTxHash(hash);
      await publicClient?.waitForTransactionReceipt({ hash });
      await verify(hash);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  return (
    <Shell>
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
        <dt>SKU</dt><dd>{tx.sku} — ${(Number(pack.priceUsd6) / 1e6).toFixed(2)} → {pack.peonesReward} Peones</dd>
        <dt>Token</dt><dd>{tx.token.symbol} ({tx.token.address})</dd>
        <dt>Treasury</dt><dd>{treasury}</dd>
        <dt>Amount</dt><dd>{tx.expectedAmount.toString()} ({tx.token.decimals} dec)</dd>
        <dt>tx.to == token</dt><dd>yes (direct transfer — anti-replay guardrail)</dd>
      </dl>

      <label style={{ display: "block", marginTop: 12 }}>
        Pay with:{" "}
        <select
          value={tokenSymbol}
          onChange={(e) => setTokenSymbol(e.target.value)}
          disabled={phase === "paying" || phase === "verifying"}
        >
          {RAIL_ACCEPTED_STABLECOINS.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>{" "}
        <span style={{ color: "#6b7280" }}>(elegí el token que tengas en la wallet)</span>
      </label>

      {!isConnected ? (
        <button type="button" onClick={() => connectWallet()} style={btn}>
          Connect wallet
        </button>
      ) : onWrongChain ? (
        <p style={{ color: "#b45309" }}>Switch your wallet to Celo mainnet (42220) to smoke.</p>
      ) : (
        <button
          type="button"
          onClick={() => void onPay()}
          disabled={phase === "paying" || phase === "verifying"}
          style={btn}
        >
          {phase === "paying"
            ? "Confirm in wallet…"
            : phase === "verifying"
              ? "Verifying…"
              : `Pay ${(Number(pack.priceUsd6) / 1e6).toFixed(2)} ${tx.token.symbol} (1 tx, no approve)`}
        </button>
      )}

      {txHash && (
        <p>
          txHash: <code data-allow-select="true">{txHash}</code>{" "}
          <button type="button" onClick={() => void verify(txHash)} style={btnSm}>
            Verify again (expect duplicate)
          </button>
        </p>
      )}

      {result != null && (
        <pre style={pre}>{JSON.stringify(result, null, 2)}</pre>
      )}
      {errorMsg && <p style={{ color: "#b91c1c" }}>Error: {errorMsg}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 24, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800 }}>Rail smoke — peones_pack_50 (dev)</h1>
      <p style={{ color: "#6b7280" }}>
        Internal MiniPay single-tx rail smoke. Sends a REAL stablecoin transfer + verifies it.
        Not in production.
      </p>
      {children}
    </main>
  );
}

const btn: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #047857",
  background: "#059669",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};
const btnSm: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid #9ca3af",
  background: "#f3f4f6",
  cursor: "pointer",
  fontSize: 12,
};
const pre: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  background: "#0f172a",
  color: "#e2e8f0",
  overflowX: "auto",
};
