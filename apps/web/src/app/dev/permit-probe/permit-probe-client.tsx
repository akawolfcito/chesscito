"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { recoverTypedDataAddress } from "viem";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";

import { isMiniPayEnv } from "@/lib/minipay";

// Shaped like a real EIP-2612 Permit message, but the domain is a throwaway
// — this probe never touches a real token contract, on-chain state, or
// funds. It only answers whether the wallet's `eth_signTypedData_v4` RPC
// method works at all inside MiniPay, distinct from `personal_sign`
// (already confirmed working — see /dev/sign-probe).
const DOMAIN = {
  name: "Chesscito Permit Probe",
  version: "1",
  chainId: 42220,
  // The all-zero address needs no EIP-55 checksum (no letters), so it can
  // never trigger viem's strict checksum validation the way a cosmetic
  // "dead" address can.
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
};

const TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

type Outcome =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "ok"; signature: string; recovered: string }
  | { kind: "mismatch"; signature: string; recovered: string }
  | { kind: "fail"; message: string };

/**
 * One-button probe: tap "Sign permit-shaped message" → call
 * `useSignTypedData` (EIP-712 / eth_signTypedData_v4 under the hood) →
 * recover the signer from the returned signature and compare against the
 * connected address. Distinguishes "wallet doesn't support typed-data
 * signing at all" (throws) from "signed something, but recovery doesn't
 * match" (would be a real bug) from the success case. Touches nothing else
 * — no API, no ledger, no contracts, no real token.
 */
export function PermitProbeClient() {
  const { address, isConnected } = useAccount();
  const { connectWallet } = useConnectWallet();
  const { signTypedDataAsync } = useSignTypedData();

  const [inMiniPay, setInMiniPay] = useState<boolean | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  // isMiniPayEnv reads window — resolve after mount to avoid hydration drift.
  useEffect(() => {
    setInMiniPay(isMiniPayEnv());
  }, []);

  async function runProbe() {
    if (!address) return;
    setOutcome({ kind: "signing" });
    const message = {
      owner: address,
      spender: "0x0000000000000000000000000000000000000000" as const,
      value: 1n,
      nonce: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    try {
      const signature = await signTypedDataAsync({
        domain: DOMAIN,
        types: TYPES,
        primaryType: "Permit",
        message,
      });
      const recovered = await recoverTypedDataAddress({
        domain: DOMAIN,
        types: TYPES,
        primaryType: "Permit",
        message,
        signature,
      });
      if (recovered.toLowerCase() === address.toLowerCase()) {
        setOutcome({ kind: "ok", signature, recovered });
      } else {
        setOutcome({ kind: "mismatch", signature, recovered });
      }
    } catch (e) {
      setOutcome({
        kind: "fail",
        message: e instanceof Error ? e.message : JSON.stringify(e),
      });
    }
  }

  return (
    <main
      style={{
        maxWidth: 390,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>MiniPay permit probe</h1>
      <p style={{ fontSize: 13, color: "#555" }}>
        Tests whether <code>eth_signTypedData_v4</code> (EIP-712, what an
        EIP-2612 permit needs) works in this wallet. Not a real permit — no
        token, no contract, no funds touched.
      </p>

      <ul style={{ fontSize: 14, paddingLeft: 18 }}>
        <li>
          In MiniPay:{" "}
          <strong>{inMiniPay === null ? "…" : inMiniPay ? "YES" : "no"}</strong>
        </li>
        <li>
          Connected:{" "}
          <strong>
            {isConnected && address
              ? `${address.slice(0, 6)}…${address.slice(-4)}`
              : "no"}
          </strong>
        </li>
      </ul>

      {!isConnected ? (
        <button
          type="button"
          onClick={() => connectWallet()}
          style={btnStyle("#2563eb")}
        >
          Connect wallet
        </button>
      ) : (
        <button
          type="button"
          onClick={runProbe}
          disabled={outcome.kind === "signing"}
          style={btnStyle("#16a34a")}
        >
          {outcome.kind === "signing" ? "Waiting for wallet…" : "Sign permit-shaped message"}
        </button>
      )}

      {outcome.kind === "ok" && (
        <div style={resultBox("#dcfce7", "#166534")}>
          <strong>✅ SIGNED + VERIFIED — MiniPay supports eth_signTypedData_v4.</strong>
          <p style={{ fontSize: 11, wordBreak: "break-all", marginTop: 8 }}>
            {outcome.signature}
          </p>
        </div>
      )}

      {outcome.kind === "mismatch" && (
        <div style={resultBox("#fef3c7", "#92400e")}>
          <strong>⚠️ SIGNED but recovery mismatch — signature produced, but
            recovered address does not match the connected wallet. Treat as
            not viable without further investigation.</strong>
          <p style={{ fontSize: 11, wordBreak: "break-all", marginTop: 8 }}>
            expected {address}, recovered {outcome.recovered}
          </p>
        </div>
      )}

      {outcome.kind === "fail" && (
        <div style={resultBox("#fee2e2", "#991b1b")}>
          <strong>❌ FAILED — typed-data signing not available here.</strong>
          <p style={{ fontSize: 11, wordBreak: "break-all", marginTop: 8 }}>
            {outcome.message}
          </p>
        </div>
      )}
    </main>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 16,
    padding: "12px 16px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
  };
}

function resultBox(bg: string, fg: string): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 12,
    background: bg,
    color: fg,
    borderRadius: 10,
    fontSize: 14,
  };
}
