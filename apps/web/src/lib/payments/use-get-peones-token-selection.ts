"use client";

/**
 * Stablecoin balance read + auto-selection for Get Peones (slice D,
 * 2026-06-09). Picks a PAYABLE stablecoin so we never repeat the smoke
 * bug (USDC default with 0 balance → "transfer amount exceeds balance").
 *
 * Pure `selectPayableToken` (fully testable) + `useGetPeonesTokenSelection`
 * (reads balances via useReadContracts, same pattern as the Shop). No
 * Shop/approve/contract/endpoint changes.
 */

import { useMemo, useState } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";

import { erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import {
  getPeonesPack,
  RAIL_ACCEPTED_STABLECOINS,
  type PeonesPackSku,
} from "@/lib/payments/rail-config";

/** Auto-select preference: USDC, then USDT, then cUSD. USDC is the default
 *  ONLY when it has a sufficient balance. */
const PREFERENCE = ["USDC", "USDT", "cUSD"] as const;

function prefIndex(symbol: string): number {
  const i = (PREFERENCE as readonly string[]).indexOf(symbol);
  return i === -1 ? PREFERENCE.length : i;
}

export type TokenBalanceInput = {
  symbol: string;
  address: string;
  decimals: number;
  balance: bigint;
};

export type PayableToken = TokenBalanceInput & {
  expectedAmount: bigint;
  payable: boolean;
};

/**
 * Pure: given the pack price + per-token balances, compute each token's
 * required amount (normalized by decimals) + payability, in preference
 * order, and the first payable token (or null if none can pay).
 */
export function selectPayableToken(
  priceUsd6: bigint,
  balances: readonly TokenBalanceInput[],
): { tokens: PayableToken[]; autoSelected: string | null } {
  const tokens = [...balances]
    .sort((a, b) => prefIndex(a.symbol) - prefIndex(b.symbol))
    .map((t) => {
      const expectedAmount = normalizePrice(priceUsd6, t.decimals);
      return { ...t, expectedAmount, payable: t.balance >= expectedAmount };
    });
  return { tokens, autoSelected: tokens.find((t) => t.payable)?.symbol ?? null };
}

export function useGetPeonesTokenSelection(sku: PeonesPackSku) {
  const { address } = useAccount();
  const chainId = useChainId();
  const pack = getPeonesPack(sku);
  // Manual override; null = follow the auto-selection.
  const [override, setOverride] = useState<string | null>(null);

  const { data, isLoading } = useReadContracts({
    contracts: RAIL_ACCEPTED_STABLECOINS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: Boolean(address), staleTime: 15_000 },
  });

  const { tokens, autoSelected } = useMemo(() => {
    // Fail-safe: a failed/missing read counts as 0 (not payable), never throws.
    const balances: TokenBalanceInput[] = RAIL_ACCEPTED_STABLECOINS.map((t, i) => {
      const r = data?.[i];
      const balance =
        r && r.status === "success" && typeof r.result === "bigint" ? r.result : 0n;
      return { symbol: t.symbol, address: t.address, decimals: t.decimals, balance };
    });
    return selectPayableToken(pack.priceUsd6, balances);
  }, [data, pack.priceUsd6]);

  const selectedSymbol = override ?? autoSelected;
  const selected = tokens.find((t) => t.symbol === selectedSymbol) ?? null;
  const loading = Boolean(address) && isLoading;
  // Insufficient ONLY once balances have loaded for a connected wallet.
  const noPayableToken = Boolean(address) && !loading && autoSelected === null;

  return {
    loading,
    tokens,
    selectedSymbol,
    setSelectedSymbol: (s: string) => setOverride(s),
    selected,
    noPayableToken,
  };
}
