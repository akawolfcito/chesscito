import { erc20Abi, type PublicClient } from "viem";

import { shopAbi } from "@/lib/contracts/shop";
import { PRO_ITEM_ID, PRO_PRICE_USD6 } from "@/lib/contracts/shop-catalog";
import { normalizePrice } from "@/lib/contracts/tokens";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { isTransactionTimeout, isUserCancellation } from "@/lib/errors";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Subset of wagmi's writeContractAsync that the helper needs. The
 *  helper accepts the full wagmi callable so the play-hub root can
 *  pass `writeShopAsync` directly without an adapter. */
type WriteContractAsync = (args: {
  address: `0x${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any;
  functionName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: readonly any[];
  chainId: number;
  account: `0x${string}`;
}) => Promise<`0x${string}`>;

type PaymentToken = {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
};

export type ExecuteProPurchaseDeps = {
  address: `0x${string}`;
  shopAddress: `0x${string}`;
  chainId: number;
  publicClient: PublicClient;
  writeContractAsync: WriteContractAsync;
  selectPaymentToken: (priceUsd6: bigint) => PaymentToken | null;
  onPhaseChange?: (phase: "purchasing" | "verifying") => void;
};

export type ExecuteProPurchaseResult =
  | { kind: "success"; txHash: string; expiresAt: number }
  | { kind: "no-token" }
  | { kind: "cancelled" }
  | { kind: "timeout" }
  | { kind: "verify-failed"; txHash?: string }
  | { kind: "error"; message: string };

/** Coordinates the Chesscito PRO purchase flow:
 *    1. select stablecoin payment token (USDC > USDT > cUSD by balance)
 *    2. approve if allowance < normalizedTotal
 *    3. shop.buyItem(PRO_ITEM_ID, 1n, token)
 *    4. POST /api/verify-pro to mint the PRO pass server-side
 *
 *  Returns a discriminated result so the caller can map each kind
 *  to its own copy + telemetry. The verify-failed branch carries the
 *  txHash so the UI can offer "refresh and we'll reconcile" copy
 *  without losing the on-chain receipt the user already paid for.
 *
 *  Never throws — all failure modes funnel through the result union.
 *  This keeps the play-hub wrapper free of try/catch sprawl. */
export async function executeProPurchase(
  deps: ExecuteProPurchaseDeps,
): Promise<ExecuteProPurchaseResult> {
  const token = deps.selectPaymentToken(PRO_PRICE_USD6);
  if (!token) return { kind: "no-token" };

  const normalizedTotal = normalizePrice(PRO_PRICE_USD6, token.decimals);

  try {
    deps.onPhaseChange?.("purchasing");

    // 1. Allowance + approve
    const allowance = (await deps.publicClient.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [deps.address, deps.shopAddress],
    })) as bigint;

    if (allowance < normalizedTotal) {
      const approveHash = await deps.writeContractAsync({
        address: token.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [deps.shopAddress, normalizedTotal],
        chainId: deps.chainId,
        account: deps.address,
      });
      await waitForReceiptWithTimeout(deps.publicClient, approveHash);
    }

    // 2. buyItem(PRO_ITEM_ID, 1n, token)
    const buyHash = await deps.writeContractAsync({
      address: deps.shopAddress,
      abi: shopAbi,
      functionName: "buyItem",
      args: [PRO_ITEM_ID, 1n, token.address],
      chainId: deps.chainId,
      account: deps.address,
    });
    await waitForReceiptWithTimeout(deps.publicClient, buyHash);

    // 3. Server-side verification
    deps.onPhaseChange?.("verifying");
    const res = await fetch("/api/verify-pro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash: buyHash, walletAddress: deps.address }),
    });
    const data = (await res.json().catch(() => null)) as
      | { active?: boolean; expiresAt?: number }
      | null;

    if (!res.ok || !data?.active || typeof data.expiresAt !== "number") {
      return { kind: "verify-failed", txHash: buyHash };
    }

    return { kind: "success", txHash: buyHash, expiresAt: data.expiresAt };
  } catch (err) {
    if (isUserCancellation(err)) return { kind: "cancelled" };
    if (isTransactionTimeout(err)) return { kind: "timeout" };
    return { kind: "error", message: toErrorMessage(err) };
  }
}
