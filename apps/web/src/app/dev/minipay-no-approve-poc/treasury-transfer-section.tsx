"use client";

import { useMemo, useRef, useState } from "react";
import { encodeFunctionData, formatUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";

import {
  getChesscitoTreasuryAddress,
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getShopAddress,
} from "@/lib/contracts/chains";
import {
  selectMaxBalanceToken,
  type BalanceReadResult,
} from "@/lib/contracts/select-payment-token";
import { chesscitoTreasuryAbi } from "@/lib/contracts/treasury";
import { ACCEPTED_TOKENS, erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { getMiniPayProvider } from "@/lib/minipay/provider";
import { requestLegacyGasPrice } from "@/lib/minipay/rawTx";
import { getTreasuryAddressClient } from "@/lib/payments/rail-config";
import {
  verifyStablecoinTransfer,
  type TransferLogInput,
} from "@/lib/payments/verify-transfer";
import { classifyTreasuryTransferResult } from "./result";

const TREASURY_POC_AMOUNT_USD6 = 10_000n;

type PaymentToken = (typeof ACCEPTED_TOKENS)[number];
type Phase = "idle" | "reading" | "submitting" | "confirming";
type TreasuryStatus = "not-run" | "success" | "failed" | "inconclusive";

type VerifiedTransfer = {
  token: string;
  from: string;
  to: string;
  amount: bigint;
  logIndex: number;
};

type TreasuryOutcome = {
  status: TreasuryStatus;
  txHash: `0x${string}` | null;
  receiptStatus: "success" | "reverted" | null;
  error: string | null;
  walletUsed: `0x${string}` | null;
  chainIdUsed: number | null;
  treasuryUsed: `0x${string}` | null;
  tokenUsed: PaymentToken | null;
  amountExpected: bigint | null;
  estimatedFee: bigint | null;
  transfer: VerifiedTransfer | null;
};

const INITIAL_OUTCOME: TreasuryOutcome = {
  status: "not-run",
  txHash: null,
  receiptStatus: null,
  error: null,
  walletUsed: null,
  chainIdUsed: null,
  treasuryUsed: null,
  tokenUsed: null,
  amountExpected: null,
  estimatedFee: null,
  transfer: null,
};

export function TreasuryTransferSection() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  const eoaTreasuryAddress = useMemo(() => getTreasuryAddressClient(), []);
  const treasuryContractAddress = useMemo(
    () => getChesscitoTreasuryAddress(chainId),
    [chainId],
  );
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<TreasuryOutcome>(INITIAL_OUTCOME);
  const runLockRef = useRef(false);

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

  const { data: acceptedTokenReads, refetch: refetchAccepted } = useReadContracts({
    contracts: ACCEPTED_TOKENS.map((token) => ({
      address: treasuryContractAddress ?? undefined,
      abi: chesscitoTreasuryAbi,
      functionName: "acceptedToken" as const,
      args: [token.address] as const,
      chainId,
    })),
    allowFailure: true,
    query: {
      enabled: Boolean(treasuryContractAddress && isCorrectChain),
      staleTime: 15_000,
    },
  });

  const selectedToken = useMemo(
    () => {
      const eligible = ACCEPTED_TOKENS.map((token, index) => ({
        token,
        balance: tokenBalances?.[index],
        accepted:
          acceptedTokenReads?.[index]?.status === "success" &&
          acceptedTokenReads[index].result === true,
      })).filter(
        (entry): entry is typeof entry & { balance: BalanceReadResult } =>
          entry.accepted && entry.balance != null,
      );
      return selectMaxBalanceToken(
        eligible.map((entry) => entry.token),
        eligible.map((entry) => entry.balance),
        TREASURY_POC_AMOUNT_USD6,
      );
    },
    [acceptedTokenReads, tokenBalances],
  );
  const amountExpected = selectedToken
    ? normalizePrice(TREASURY_POC_AMOUNT_USD6, selectedToken.decimals)
    : null;
  const selectedTokenIndex = selectedToken
    ? ACCEPTED_TOKENS.findIndex((token) => token.address === selectedToken.address)
    : -1;
  const selectedBalanceRead =
    selectedTokenIndex >= 0 ? tokenBalances?.[selectedTokenIndex] : undefined;
  const currentBalance =
    selectedBalanceRead?.status === "success" ? selectedBalanceRead.result : null;
  const tokenAccepted =
    selectedTokenIndex >= 0 &&
    acceptedTokenReads?.[selectedTokenIndex]?.status === "success" &&
    acceptedTokenReads[selectedTokenIndex].result === true;

  const { data: shopAllowance, refetch: refetchAllowance } = useReadContract({
    address: selectedToken?.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && shopAddress ? [address, shopAddress] : undefined,
    chainId,
    query: { enabled: Boolean(address && shopAddress && selectedToken && isCorrectChain) },
  });

  const blocker = getTreasuryBlocker({
    isConnected,
    isCorrectChain,
    configuredChainId,
    hasPublicClient: Boolean(publicClient),
    treasuryContractAddress,
    selectedToken: Boolean(selectedToken),
    amountExpected,
    currentBalance,
    tokenAccepted,
  });
  const isBusy = phase !== "idle";
  const alreadySubmitted = outcome.txHash != null;
  const conclusion = classifyTreasuryTransferResult({
    transferFailed: outcome.status === "failed",
    receiptStatus: outcome.receiptStatus,
    transferEventVerified: outcome.transfer != null,
  });

  async function transferToTreasuryContract() {
    if (
      !address ||
      !publicClient ||
      !treasuryContractAddress ||
      !selectedToken ||
      amountExpected == null ||
      blocker ||
      runLockRef.current
    ) {
      return;
    }

    runLockRef.current = true;
    setOutcome(INITIAL_OUTCOME);
    setPhase("reading");

    let hash: `0x${string}` | null = null;
    let receiptStatus: "success" | "reverted" | null = null;
    let status: TreasuryStatus = "failed";
    let errorMessage: string | null = null;
    let transfer: VerifiedTransfer | null = null;
    let estimatedFee: bigint | null = null;
    const walletUsed = address;
    const chainIdUsed = chainId;
    const treasuryUsed = treasuryContractAddress;
    const tokenUsed = selectedToken;
    const expected = amountExpected;

    try {
      const [freshBalance, freshAccepted] = await Promise.all([
        publicClient.readContract({
          address: tokenUsed.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletUsed],
        }),
        publicClient.readContract({
          address: treasuryContractAddress,
          abi: chesscitoTreasuryAbi,
          functionName: "acceptedToken",
          args: [tokenUsed.address],
        }),
      ]);
      if (!freshAccepted) throw new Error("Selected token is not accepted by Treasury metadata");

      const request = {
        address: tokenUsed.address,
        abi: erc20Abi,
        functionName: "transfer" as const,
        args: [treasuryContractAddress, expected] as const,
        chainId,
        account: walletUsed,
      };

      if (feeCurrency?.toLowerCase() === tokenUsed.address.toLowerCase()) {
        const provider = getMiniPayProvider();
        if (!provider) {
          throw new Error("MiniPay provider unavailable for fee-currency gas estimation");
        }
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [treasuryUsed, expected],
        });
        const gasHex = (await provider.request({
          method: "eth_estimateGas",
          params: [
            {
              from: walletUsed,
              to: tokenUsed.address,
              data,
              feeCurrency,
            },
          ],
        })) as string;
        const gasPrice = await requestLegacyGasPrice(provider, feeCurrency);
        if (!gasPrice.ok || gasPrice.mode !== "feeCurrencyParam" || !gasPrice.gasPrice) {
          throw new Error("Could not estimate gas cost in the selected stablecoin");
        }
        estimatedFee = BigInt(gasHex) * BigInt(gasPrice.gasPrice);
      } else {
        estimatedFee = 0n;
      }
      if (freshBalance < expected + estimatedFee) {
        throw new Error("Token balance cannot cover the fixed POC amount plus estimated gas");
      }

      setPhase("submitting");
      hash = await writeContractAsync(
        (feeCurrency ? { ...request, feeCurrency } : request) as Parameters<
          typeof writeContractAsync
        >[0],
      );

      setPhase("confirming");
      const receipt = await waitForReceiptWithTimeout(publicClient, hash);
      hash = receipt.transactionHash;
      receiptStatus = receipt.status;
      if (receipt.status !== "success") {
        throw new Error("Treasury transfer receipt reverted");
      }

      const logs: TransferLogInput[] = receipt.logs.flatMap((log) =>
        typeof log.logIndex === "number"
          ? [
              {
                address: log.address,
                topics: log.topics,
                data: log.data,
                logIndex: log.logIndex,
              },
            ]
          : [],
      );
      const verification = verifyStablecoinTransfer({
        logs,
        expectedTreasury: treasuryContractAddress,
        fromWallet: walletUsed,
        acceptedTokenAddressesLower: [tokenUsed.address.toLowerCase()],
        expectedAmount: expected,
        overpayAccepted: true,
      });

      if (verification.ok) {
        transfer = {
          token: verification.token,
          from: verification.from,
          to: verification.to,
          amount: verification.amount,
          logIndex: verification.logIndex,
        };
        status = "success";
      } else {
        status = "inconclusive";
        errorMessage = `Receipt succeeded but Transfer verification failed: ${verification.reason}`;
      }
    } catch (error) {
      errorMessage = extractErrorMessage(error);
      status =
        receiptStatus === "success" || (hash != null && receiptStatus == null)
          ? "inconclusive"
          : "failed";
    } finally {
      setOutcome({
        status,
        txHash: hash,
        receiptStatus,
        error: errorMessage,
        walletUsed,
        chainIdUsed,
        treasuryUsed,
        tokenUsed,
        amountExpected: expected,
        estimatedFee,
        transfer,
      });
      setPhase("idle");
      runLockRef.current = false;
      await Promise.allSettled([
        refetchBalances(),
        refetchAllowance(),
        refetchAccepted(),
      ]);
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Treasury Contract Transfer POC</h2>
      <div role="alert" style={warningStyle}>
        This sends a real, non-refundable $0.01 stablecoin transfer to the configured
        ChesscitoTreasury contract. It grants no product, claim, or reward.
      </div>

      <InfoGrid
        rows={[
          ["Connected wallet", address ?? "Not connected"],
          ["Chain", `${chainId}`],
          ["Selected stablecoin", selectedToken ? `${selectedToken.symbol} (${selectedToken.address})` : "—"],
          ["Token balance", formatTokenAmount(currentBalance, selectedToken)],
          ["Amount to transfer", formatTokenAmount(amountExpected, selectedToken)],
          ["Current Shop allowance", formatTokenAmount(shopAllowance ?? null, selectedToken)],
          ["Existing EOA treasury", eoaTreasuryAddress ?? "Not configured"],
          ["ChesscitoTreasury contract", treasuryContractAddress ?? "Not configured"],
          ["Token accepted by Treasury", tokenAccepted ? "yes" : "no"],
          ["Approve skipped", "yes"],
          ["Shop skipped", "yes"],
        ]}
      />

      {blocker && <p style={{ color: "#92400e" }}>Blocked: {blocker}</p>}
      {alreadySubmitted && (
        <p style={{ color: "#92400e" }}>
          A transaction hash was already issued. Inspect it before any retry.
        </p>
      )}
      <button
        type="button"
        onClick={() => void transferToTreasuryContract()}
        disabled={isBusy || Boolean(blocker) || alreadySubmitted}
        style={{ ...buttonStyle, opacity: isBusy || blocker || alreadySubmitted ? 0.55 : 1 }}
      >
        {phase === "reading"
          ? "Checking Treasury configuration…"
          : phase === "submitting"
            ? "Confirm transfer in wallet…"
            : phase === "confirming"
              ? "Verifying Transfer event…"
              : "Transfer to Treasury Contract"}
      </button>

      <div style={resultStyle} aria-live="polite">
        <h3 style={{ margin: 0, fontSize: 15 }}>Treasury POC result</h3>
        <InfoGrid
          rows={[
            ["Status", outcome.status],
            ["Tx hash", outcome.txHash ?? "—"],
            ["Receipt status", outcome.receiptStatus ?? "—"],
            ["Error", outcome.error ?? "—"],
            ["Attempted wallet", outcome.walletUsed ?? "—"],
            ["Attempted chain", outcome.chainIdUsed ? String(outcome.chainIdUsed) : "—"],
            ["Attempted treasury", outcome.treasuryUsed ?? "—"],
            [
              "Attempted token",
              outcome.tokenUsed
                ? `${outcome.tokenUsed.symbol} (${outcome.tokenUsed.address})`
                : "—",
            ],
            [
              "Expected amount",
              formatTokenAmount(outcome.amountExpected, outcome.tokenUsed),
            ],
            ["Estimated gas", formatTokenAmount(outcome.estimatedFee, outcome.tokenUsed)],
            ["Transfer token", outcome.transfer?.token ?? "—"],
            ["Transfer from", outcome.transfer?.from ?? "—"],
            ["Transfer to", outcome.transfer?.to ?? "—"],
            ["Transfer amount", outcome.transfer ? outcome.transfer.amount.toString() : "—"],
            ["Transfer log index", outcome.transfer ? String(outcome.transfer.logIndex) : "—"],
            ["Approve skipped", "yes"],
            ["Shop skipped", "yes"],
            ["Final conclusion", conclusion],
          ]}
        />
      </div>
    </section>
  );
}

function getTreasuryBlocker(input: {
  isConnected: boolean;
  isCorrectChain: boolean;
  configuredChainId: number | null;
  hasPublicClient: boolean;
  treasuryContractAddress: `0x${string}` | null;
  selectedToken: boolean;
  amountExpected: bigint | null;
  currentBalance: bigint | null;
  tokenAccepted: boolean;
}): string | null {
  if (!input.isConnected) return "Connect a wallet first.";
  if (input.configuredChainId == null) return "The app chain is not configured.";
  if (!input.isCorrectChain) return `Switch to chain ${input.configuredChainId}.`;
  if (!input.hasPublicClient) return "No public RPC client is available.";
  if (!input.treasuryContractAddress) return "ChesscitoTreasury contract address is not configured.";
  if (!input.selectedToken || input.amountExpected == null) {
    return "No accepted stablecoin has enough balance for the fixed $0.01 POC.";
  }
  if (input.currentBalance == null || input.currentBalance < input.amountExpected) {
    return "Stablecoin balance is below the fixed $0.01 POC amount.";
  }
  if (!input.tokenAccepted) return "Selected token is not accepted by Treasury metadata.";
  return null;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return String(error);
  const candidate = error as { shortMessage?: unknown; details?: unknown; message?: unknown };
  for (const value of [candidate.shortMessage, candidate.details, candidate.message]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "Unknown Treasury transfer error";
}

function formatTokenAmount(value: bigint | null, token: PaymentToken | null): string {
  if (value == null || !token) return "—";
  return `${formatUnits(value, token.decimals)} ${token.symbol} (${value.toString()} raw)`;
}

function InfoGrid({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 42%) minmax(0, 1fr)", gap: "7px 10px" }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt style={{ color: "#475569", fontWeight: 700 }}>{label}</dt>
          <dd data-allow-select="true" style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
  paddingTop: 20,
  borderTop: "3px solid #0f766e",
};
const warningStyle: React.CSSProperties = {
  margin: "12px 0",
  padding: 10,
  border: "1px solid #b45309",
  borderRadius: 8,
  background: "#fffbeb",
  color: "#92400e",
};
const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: "12px 14px",
  border: "1px solid #0f766e",
  borderRadius: 10,
  background: "#0d9488",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};
const resultStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  border: "1px solid #99f6e4",
  borderRadius: 10,
  background: "#f0fdfa",
};
