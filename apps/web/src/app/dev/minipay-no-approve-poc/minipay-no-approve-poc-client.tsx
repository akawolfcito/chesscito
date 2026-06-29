"use client";

import { useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";

import {
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getShopAddress,
} from "@/lib/contracts/chains";
import { selectMaxBalanceToken } from "@/lib/contracts/select-payment-token";
import { shopAbi } from "@/lib/contracts/shop";
import { FOUNDER_BADGE_ITEM_ID } from "@/lib/contracts/shop-catalog";
import { ACCEPTED_TOKENS, erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { isUserCancellation } from "@/lib/errors";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { classifyPocResult, type PocTxStatus } from "./result";

type Phase = "idle" | "reading" | "submitting" | "confirming";
type PaymentToken = (typeof ACCEPTED_TOKENS)[number];

type PocOutcome = {
  status: PocTxStatus;
  contractTxAttempted: boolean;
  txHash: `0x${string}` | null;
  error: string | null;
  walletUsed: `0x${string}` | null;
  chainIdUsed: number | null;
  tokenUsed: PaymentToken | null;
  allowanceBefore: bigint | null;
  balanceBefore: bigint | null;
  allowanceAfter: bigint | null;
  balanceAfter: bigint | null;
  requiredAmount: bigint | null;
};

const INITIAL_OUTCOME: PocOutcome = {
  status: "not-run",
  contractTxAttempted: false,
  txHash: null,
  error: null,
  walletUsed: null,
  chainIdUsed: null,
  tokenUsed: null,
  allowanceBefore: null,
  balanceBefore: null,
  allowanceAfter: null,
  balanceAfter: null,
  requiredAmount: null,
};

export function MiniPayNoApprovePocClient() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const { connectWallet, isConnecting } = useConnectWallet();

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;

  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<PocOutcome>(INITIAL_OUTCOME);
  const runLockRef = useRef(false);

  const { data: itemData } = useReadContract({
    address: shopAddress ?? undefined,
    abi: shopAbi,
    functionName: "getItem",
    args: [FOUNDER_BADGE_ITEM_ID],
    chainId,
    query: { enabled: Boolean(shopAddress), staleTime: 30_000 },
  });

  const { data: tokenBalances, refetch: refetchBalances } = useReadContracts({
    contracts: ACCEPTED_TOKENS.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: Boolean(address && isCorrectChain), staleTime: 15_000 },
  });

  const itemPriceUsd6 = Array.isArray(itemData) ? (itemData[0] as bigint) : null;
  const itemEnabled = Array.isArray(itemData) ? Boolean(itemData[1]) : false;
  const selectedToken = useMemo(
    () =>
      itemPriceUsd6 && itemPriceUsd6 > 0n
        ? selectMaxBalanceToken(ACCEPTED_TOKENS, tokenBalances, itemPriceUsd6)
        : null,
    [itemPriceUsd6, tokenBalances],
  );
  const requiredAmount =
    selectedToken && itemPriceUsd6 != null
      ? normalizePrice(itemPriceUsd6, selectedToken.decimals)
      : null;
  const selectedTokenIndex = selectedToken
    ? ACCEPTED_TOKENS.findIndex((token) => token.address === selectedToken.address)
    : -1;
  const selectedBalanceRead =
    selectedTokenIndex >= 0 ? tokenBalances?.[selectedTokenIndex] : undefined;
  const currentBalance =
    selectedBalanceRead?.status === "success" ? selectedBalanceRead.result : null;

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: selectedToken?.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && shopAddress ? [address, shopAddress] : undefined,
    chainId,
    query: { enabled: Boolean(address && shopAddress && selectedToken && isCorrectChain) },
  });

  const classification = classifyPocResult({
    status: outcome.status,
    contractTxAttempted: outcome.contractTxAttempted,
    allowanceBefore: outcome.allowanceBefore,
    requiredAmount: outcome.requiredAmount,
    error: outcome.error,
  });

  const isBusy = phase !== "idle";
  const alreadySubmitted = outcome.txHash != null;
  const blocker = getBlocker({
    isConnected,
    isCorrectChain,
    configuredChainId,
    shopAddress,
    publicClient: Boolean(publicClient),
    itemConfigured: itemPriceUsd6 != null && itemPriceUsd6 > 0n,
    itemEnabled,
    selectedToken: Boolean(selectedToken),
  });

  async function runWithoutApprove() {
    if (
      !address ||
      !shopAddress ||
      !publicClient ||
      !selectedToken ||
      requiredAmount == null ||
      blocker
    ) {
      return;
    }
    if (runLockRef.current) return;
    runLockRef.current = true;

    let hash: `0x${string}` | null = null;
    let status: PocTxStatus = "failed";
    let errorMessage: string | null = null;
    let contractTxAttempted = false;
    let allowanceBefore: bigint | null = null;
    let balanceBefore: bigint | null = null;
    let allowanceAfter: bigint | null = null;
    let balanceAfter: bigint | null = null;
    let freshRequiredAmount: bigint | null = null;
    const walletUsed = address;
    const chainIdUsed = chainId;
    const tokenUsed = selectedToken;

    setOutcome(INITIAL_OUTCOME);
    setPhase("reading");

    try {
      const [freshAllowance, freshBalance, freshItem] = await Promise.all([
        publicClient.readContract({
          address: tokenUsed.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [walletUsed, shopAddress],
        }),
        publicClient.readContract({
          address: tokenUsed.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletUsed],
        }),
        publicClient.readContract({
          address: shopAddress,
          abi: shopAbi,
          functionName: "getItem",
          args: [FOUNDER_BADGE_ITEM_ID],
        }),
      ]);
      allowanceBefore = freshAllowance;
      balanceBefore = freshBalance;

      const [freshPriceUsd6, freshItemEnabled] = freshItem;
      if (freshPriceUsd6 <= 0n) throw new Error("Founder Badge has no current on-chain price");
      if (!freshItemEnabled) throw new Error("Founder Badge is currently disabled on-chain");
      freshRequiredAmount = normalizePrice(freshPriceUsd6, tokenUsed.decimals);
      if (balanceBefore < freshRequiredAmount) {
        throw new Error("Fresh token balance is below the current required amount");
      }

      setPhase("submitting");
      const request = {
        address: shopAddress,
        abi: shopAbi,
        functionName: "buyItem" as const,
        args: [FOUNDER_BADGE_ITEM_ID, 1n, tokenUsed.address] as const,
        chainId: chainIdUsed,
        account: walletUsed,
      };

      contractTxAttempted = true;
      try {
        hash = await writeContractAsync(
          (feeCurrency ? { ...request, feeCurrency } : request) as Parameters<
            typeof writeContractAsync
          >[0],
        );
      } catch (error) {
        if (
          !feeCurrency ||
          isUserCancellation(error) ||
          !isFeeCurrencyCompatibilityError(error)
        ) {
          throw error;
        }
        hash = await writeContractAsync(request as Parameters<typeof writeContractAsync>[0]);
      }

      setPhase("confirming");
      const receipt = await waitForReceiptWithTimeout(publicClient, hash);
      if (receipt.status !== "success") {
        throw new Error("Transaction receipt status: reverted");
      }
      status = "success";
    } catch (error) {
      errorMessage = extractErrorMessage(error);
    } finally {
      const postReads = await Promise.allSettled([
        publicClient.readContract({
          address: tokenUsed.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [walletUsed, shopAddress],
        }),
        publicClient.readContract({
          address: tokenUsed.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletUsed],
        }),
      ]);
      allowanceAfter = postReads[0].status === "fulfilled" ? postReads[0].value : null;
      balanceAfter = postReads[1].status === "fulfilled" ? postReads[1].value : null;

      setOutcome({
        status,
        contractTxAttempted,
        txHash: hash,
        error: errorMessage,
        walletUsed,
        chainIdUsed,
        tokenUsed,
        allowanceBefore,
        balanceBefore,
        allowanceAfter,
        balanceAfter,
        requiredAmount: freshRequiredAmount,
      });
      setPhase("idle");
      runLockRef.current = false;
      await Promise.allSettled([refetchAllowance(), refetchBalances()]);
    }
  }

  return (
    <main style={shellStyle}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>MiniPay no-approve POC</h1>

      <div role="alert" style={warningStyle}>
        <strong>Real transaction warning</strong>
        <p style={{ margin: "6px 0 0" }}>
          This POC executes a real on-chain transaction. It may actually purchase the Founder
          Badge. This is not a simulation.
        </p>
      </div>

      <InfoGrid
        rows={[
          ["Connected wallet", address ?? "Not connected"],
          ["Network", networkLabel(chainId)],
          ["Contract address", shopAddress ?? "Not configured for this network"],
          ["Token address", selectedToken?.address ?? "No funded stablecoin selected"],
          ["Token", selectedToken?.symbol ?? "—"],
          ["Function name", "buyItem"],
          ["Arguments", `Founder Badge (${FOUNDER_BADGE_ITEM_ID}), quantity 1, selected token`],
          ["Amount/value", formatTokenAmount(requiredAmount, selectedToken)],
          ["Current allowance", formatTokenAmount(currentAllowance ?? null, selectedToken)],
          ["Current balance", formatTokenAmount(currentBalance, selectedToken)],
        ]}
      />

      {!isConnected ? (
        <button type="button" onClick={connectWallet} disabled={isConnecting} style={buttonStyle}>
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
      ) : (
        <>
          {blocker && <p style={{ color: "#92400e" }}>Blocked: {blocker}</p>}
          {alreadySubmitted && (
            <p style={{ color: "#92400e" }}>
              A transaction hash was already issued. Inspect it before attempting another run.
            </p>
          )}
          <button
            type="button"
            onClick={() => void runWithoutApprove()}
            disabled={isBusy || Boolean(blocker) || alreadySubmitted}
            style={{
              ...buttonStyle,
              opacity: isBusy || blocker || alreadySubmitted ? 0.55 : 1,
            }}
          >
            {phase === "reading"
              ? "Reading fresh allowance…"
              : phase === "submitting"
                ? "Confirm in wallet…"
                : phase === "confirming"
                  ? "Waiting for receipt…"
                  : "Run contract tx without approve"}
          </button>
        </>
      )}

      <section style={resultStyle} aria-live="polite">
        <h2 style={{ margin: 0, fontSize: 16 }}>POC result</h2>
        <InfoGrid
          rows={[
            ["Status", outcome.status],
            ["Tx hash", outcome.txHash ?? "—"],
            ["Error/revert", outcome.error ?? "—"],
            ["Tested wallet", outcome.walletUsed ?? "—"],
            ["Tested network", outcome.chainIdUsed ? networkLabel(outcome.chainIdUsed) : "—"],
            ["Token used", outcome.tokenUsed?.address ?? "—"],
            ["Allowance before", formatTokenAmount(outcome.allowanceBefore, outcome.tokenUsed)],
            ["Balance before", formatTokenAmount(outcome.balanceBefore, outcome.tokenUsed)],
            ["Allowance after", formatTokenAmount(outcome.allowanceAfter, outcome.tokenUsed)],
            ["Balance after", formatTokenAmount(outcome.balanceAfter, outcome.tokenUsed)],
            ["Was approve skipped?", "yes"],
            ["Does this prove approve can be removed?", classification.conclusion],
            ["Reason", classification.reason],
          ]}
        />
      </section>
    </main>
  );
}

function getBlocker(input: {
  isConnected: boolean;
  isCorrectChain: boolean;
  configuredChainId: number | null;
  shopAddress: `0x${string}` | null;
  publicClient: boolean;
  itemConfigured: boolean;
  itemEnabled: boolean;
  selectedToken: boolean;
}): string | null {
  if (!input.isConnected) return "Connect a wallet first.";
  if (input.configuredChainId == null) return "The app chain is not configured.";
  if (!input.isCorrectChain) return `Switch to the configured chain (${input.configuredChainId}).`;
  if (!input.shopAddress) return "The Shop contract is not configured for this chain.";
  if (!input.publicClient) return "No public RPC client is available.";
  if (!input.itemConfigured) return "The Founder Badge item has no on-chain price.";
  if (!input.itemEnabled) return "The Founder Badge item is disabled on-chain.";
  if (!input.selectedToken) return "No accepted stablecoin has enough balance for this purchase.";
  return null;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return String(error);

  const messages: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as {
      shortMessage?: unknown;
      details?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    for (const value of [candidate.shortMessage, candidate.details, candidate.message]) {
      if (typeof value === "string" && value.trim() && !messages.includes(value)) {
        messages.push(value);
      }
    }
    current = candidate.cause;
  }

  return messages.length > 0 ? messages.join(" | ") : "Unknown transaction error";
}

function isFeeCurrencyCompatibilityError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return [
    "feecurrency",
    "fee currency",
    "unsupported transaction parameter",
    "invalid transaction parameter",
  ].some((pattern) => message.includes(pattern));
}

function formatTokenAmount(
  value: bigint | null,
  token: (typeof ACCEPTED_TOKENS)[number] | null,
): string {
  if (value == null || !token) return "—";
  return `${formatUnits(value, token.decimals)} ${token.symbol} (${value.toString()} raw)`;
}

function networkLabel(chainId: number): string {
  if (chainId === 42220) return "Celo Mainnet (42220)";
  if (chainId === 11142220) return "Celo Sepolia (11142220)";
  if (chainId === 44787) return "Celo Alfajores (44787)";
  return `Unknown (${chainId})`;
}

function InfoGrid({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 42%) minmax(0, 1fr)", gap: "7px 10px" }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt style={{ color: "#475569", fontWeight: 700 }}>{label}</dt>
          <dd data-allow-select="true" style={{ margin: 0, overflowWrap: "anywhere" }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const shellStyle: React.CSSProperties = {
  maxWidth: 390,
  minHeight: "100dvh",
  margin: "0 auto",
  padding: 20,
  background: "#f8fafc",
  color: "#0f172a",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  lineHeight: 1.5,
};

const warningStyle: React.CSSProperties = {
  margin: "16px 0",
  padding: 12,
  border: "2px solid #b91c1c",
  borderRadius: 10,
  background: "#fef2f2",
  color: "#991b1b",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: "12px 14px",
  border: "1px solid #047857",
  borderRadius: 10,
  background: "#059669",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const resultStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "white",
};
