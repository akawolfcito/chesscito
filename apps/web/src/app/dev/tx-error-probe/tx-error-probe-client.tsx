"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { badgesAbi } from "@/lib/contracts/badges";
import { erc20Abi } from "@/lib/contracts/tokens";
import {
  getBadgesAddress,
  getMiniPayFeeCurrency,
  getShopAddress,
  getUsdcAddress,
} from "@/lib/contracts/chains";
import {
  findRevertData,
  serializeTxError,
  type SerializedTxErrorChain,
} from "@/lib/debug/serialize-tx-error";

type Scenario = "cancel" | "pre-broadcast" | "revert" | "success";

type Report = {
  scenario: Scenario;
  at: string;
  /** Did the wallet return a hash? This is the load-bearing distinction: a
   *  rejection at estimation never broadcasts, a mined revert does. */
  txHash: string | null;
  receiptStatus: string | null;
  revertData: string | null;
  error: SerializedTxErrorChain | null;
  env: {
    origin: string;
    chainId: number;
    userAgent: string;
    isMiniPay: boolean;
  };
};

function readEnv(chainId: number) {
  const eth = (globalThis as { ethereum?: { isMiniPay?: boolean } }).ethereum;
  return {
    origin: typeof window === "undefined" ? "" : window.location.origin,
    chainId,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    isMiniPay: Boolean(eth?.isMiniPay),
  };
}

export function TxErrorProbeClient() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const { connectWallet } = useConnectWallet();

  const [levelId, setLevelId] = useState("1");
  const [running, setRunning] = useState<Scenario | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  const badgesAddress = getBadgesAddress(chainId);
  const usdcAddress = getUsdcAddress(chainId);
  const shopAddress = getShopAddress(chainId);
  const feeCurrency = getMiniPayFeeCurrency(chainId);

  const record = useCallback((report: Report) => {
    setReports((prev) => [report, ...prev]);
  }, []);

  /** MiniPay wallets hold no CELO; every write must offer a fee currency, then
   *  retry without it for web wallets that reject the extra field. */
  const write = useCallback(
    async (request: Parameters<typeof writeContractAsync>[0]) => {
      try {
        const withFee = feeCurrency
          ? ({ ...request, feeCurrency } as unknown as Parameters<typeof writeContractAsync>[0])
          : request;
        return await writeContractAsync(withFee);
      } catch (error) {
        if (!feeCurrency) throw error;
        return writeContractAsync(request);
      }
    },
    [writeContractAsync, feeCurrency],
  );

  const run = useCallback(
    async (scenario: Scenario) => {
      if (!address) return;
      setRunning(scenario);

      let txHash: string | null = null;
      let receiptStatus: string | null = null;

      try {
        if (scenario === "pre-broadcast") {
          // A signing failure that never reaches the wallet. Malformed body →
          // the route 400s → requestSignature throws. No tx, no gas.
          const response = await fetch("/api/sign-badge", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? `sign-badge failed: ${response.status}`);
        }

        if (scenario === "revert") {
          // Claim a badge this wallet ALREADY owns. /api/sign-badge signs any
          // levelId without checking ownership, so the signature is valid and
          // the contract is the one that says no: BadgeAlreadyClaimed.
          // This is the only scenario that can produce real revert data.
          if (!badgesAddress) throw new Error("No badges address for this chain");
          const response = await fetch("/api/sign-badge", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ player: address, levelId: Number(levelId) }),
          });
          const signed = (await response.json()) as {
            nonce: string;
            deadline: string;
            signature: `0x${string}`;
            error?: string;
          };
          if (signed.error) throw new Error(signed.error);

          txHash = await write({
            address: badgesAddress,
            abi: badgesAbi,
            functionName: "claimBadgeSigned" as const,
            args: [
              BigInt(levelId),
              BigInt(signed.nonce),
              BigInt(signed.deadline),
              signed.signature,
            ] as const,
            chainId,
            account: address,
          });
        }

        if (scenario === "cancel" || scenario === "success") {
          // Harmless control write: approve(shop, 0). Real broadcast, real
          // receipt, zero economic effect. Reject it in the wallet for
          // `cancel`; accept it for `success`.
          if (!usdcAddress || !shopAddress) throw new Error("No USDC/shop address for this chain");
          txHash = await write({
            address: usdcAddress,
            abi: erc20Abi,
            functionName: "approve" as const,
            args: [shopAddress, 0n] as const,
            chainId,
            account: address,
          });
        }

        // A hash exists. Read the verdict raw — no helper, no throwing.
        if (txHash && publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash as `0x${string}`,
            timeout: 120_000,
          });
          receiptStatus = String(receipt.status);
        }

        record({
          scenario,
          at: new Date().toISOString(),
          txHash,
          receiptStatus,
          revertData: null,
          error: null,
          env: readEnv(chainId),
        });
      } catch (error) {
        const chain = serializeTxError(error);
        record({
          scenario,
          at: new Date().toISOString(),
          txHash,
          receiptStatus,
          revertData: findRevertData(chain),
          error: chain,
          env: readEnv(chainId),
        });
      } finally {
        setRunning(null);
      }
    },
    [address, badgesAddress, chainId, levelId, publicClient, record, shopAddress, usdcAddress, write],
  );

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(JSON.stringify(reports, null, 2));
  }, [reports]);

  return (
    <main style={{ padding: 16, fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 16, fontWeight: 700 }}>MiniPay raw tx-error probe</h1>
      <p>
        Answers one question: does a contract revert reach the dapp with its 4-byte
        revert data intact? Decodes nothing. Delete after use.
      </p>

      {!isConnected ? (
        <button type="button" onClick={() => connectWallet()} style={btn}>
          Connect wallet
        </button>
      ) : (
        <p>
          Connected: {address?.slice(0, 6)}…{address?.slice(-4)} · chain {chainId} ·
          MiniPay {String(readEnv(chainId).isMiniPay)}
        </p>
      )}

      <label style={{ display: "block", margin: "12px 0" }}>
        levelId of a badge this wallet ALREADY owns (rook = 1):{" "}
        <input
          value={levelId}
          onChange={(event) => setLevelId(event.target.value)}
          inputMode="numeric"
          style={{ width: 64, border: "1px solid #999", padding: 4 }}
        />
      </label>

      <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
        <button type="button" style={btn} disabled={!isConnected || running !== null} onClick={() => void run("cancel")}>
          1. Cancel — approve(shop, 0), then REJECT in the wallet
        </button>
        <button type="button" style={btn} disabled={!isConnected || running !== null} onClick={() => void run("pre-broadcast")}>
          2. Fail before broadcast — malformed /api/sign-badge
        </button>
        <button type="button" style={btn} disabled={!isConnected || running !== null} onClick={() => void run("revert")}>
          3. Revert — re-claim an owned badge (costs gas)
        </button>
        <button type="button" style={btn} disabled={!isConnected || running !== null} onClick={() => void run("success")}>
          4. Success control — approve(shop, 0), ACCEPT it
        </button>
      </div>

      {running ? <p>Running “{running}” — watch the wallet.</p> : null}

      {reports.length > 0 ? (
        <>
          <button type="button" style={{ ...btn, marginTop: 16 }} onClick={copy}>
            Copy all reports as JSON
          </button>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 12 }}>
            {JSON.stringify(reports, null, 2)}
          </pre>
        </>
      ) : null}
    </main>
  );
}

const btn: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 6,
  padding: "10px 12px",
  textAlign: "left",
  background: "#f3f3f3",
};
