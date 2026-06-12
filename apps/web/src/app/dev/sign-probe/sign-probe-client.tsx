"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";

import { isMiniPayEnv } from "@/lib/minipay";

const TEST_MESSAGE = "Chesscito sign probe — does MiniPay support personal_sign?";

type Outcome =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "ok"; signature: string }
  | { kind: "fail"; message: string };

/**
 * One-button probe: tap "Sign test message" → call `useSignMessage`
 * (EIP-191 personal_sign under the hood) → render either the signature
 * (MiniPay SUPPORTS signing) or the raw error (MiniPay does NOT). The
 * detection line shows whether we're inside MiniPay so the result is
 * unambiguous. Touches nothing else — no API, no ledger, no contracts.
 */
export function SignProbeClient() {
  const { address, isConnected } = useAccount();
  const { connectWallet } = useConnectWallet();
  const { signMessageAsync } = useSignMessage();

  const [inMiniPay, setInMiniPay] = useState<boolean | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  // isMiniPayEnv reads window — resolve after mount to avoid hydration drift.
  useEffect(() => {
    setInMiniPay(isMiniPayEnv());
  }, []);

  async function runProbe() {
    setOutcome({ kind: "signing" });
    try {
      const signature = await signMessageAsync({ message: TEST_MESSAGE });
      setOutcome({ kind: "ok", signature });
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
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>MiniPay sign probe</h1>
      <p style={{ fontSize: 13, color: "#555" }}>
        Tests whether <code>personal_sign</code> works in this wallet.
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
          {outcome.kind === "signing" ? "Waiting for wallet…" : "Sign test message"}
        </button>
      )}

      {outcome.kind === "ok" && (
        <div style={resultBox("#dcfce7", "#166534")}>
          <strong>✅ SIGNED — MiniPay supports personal_sign.</strong>
          <p style={{ fontSize: 11, wordBreak: "break-all", marginTop: 8 }}>
            {outcome.signature}
          </p>
        </div>
      )}

      {outcome.kind === "fail" && (
        <div style={resultBox("#fee2e2", "#991b1b")}>
          <strong>❌ FAILED — signing not available here.</strong>
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
