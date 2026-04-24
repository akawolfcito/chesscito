"use client";

import { useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import { getUsdcAddress, getVictoryNFTAddress } from "./chains";
import { victoryAbi } from "./victory";

export type PrizePoolBalance = {
  /** Prize pool USDC balance as bigint (6 decimals). Null while
   *  loading or when config is missing. */
  balance: bigint | null;
  /** Human-readable amount with a leading $ (e.g. "$1.24"). Null while
   *  loading or when config is missing. */
  formatted: string | null;
  isLoading: boolean;
  isError: boolean;
};

/** Reads the live USDC balance of the VictoryNFT prizePool address.
 *
 *  The contract transfers 20% of every Victory mint fee directly to
 *  the prizePool address — it does not hold funds internally. So the
 *  "prize pool balance" is the USDC balanceOf(prizePool()) on-chain.
 *
 *  SSR-safe: returns loading state when wagmi config or chain is
 *  missing. Chain-gated via getConfiguredChainId → returns null for
 *  wrong-chain reads instead of attempting them.
 */
export function usePrizePoolBalance(chainId: number | undefined): PrizePoolBalance {
  const victoryAddress = getVictoryNFTAddress(chainId);
  const usdcAddress = getUsdcAddress(chainId);
  const configReady = victoryAddress != null && usdcAddress != null;

  const poolRead = useReadContracts({
    contracts: configReady
      ? [
          {
            address: victoryAddress,
            abi: victoryAbi,
            functionName: "prizePool",
            chainId,
          } as const,
        ]
      : [],
    query: { enabled: configReady },
  });

  const prizePoolAddress = poolRead.data?.[0]?.result as `0x${string}` | undefined;
  const poolAddressReady = configReady && prizePoolAddress != null;

  const balanceRead = useReadContracts({
    contracts: poolAddressReady
      ? [
          {
            address: usdcAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [prizePoolAddress],
            chainId,
          } as const,
        ]
      : [],
    query: { enabled: poolAddressReady },
  });

  const balance = balanceRead.data?.[0]?.result as bigint | undefined;

  const isLoading = !configReady
    ? false
    : poolRead.isLoading || balanceRead.isLoading;
  const isError = poolRead.isError || balanceRead.isError;

  return {
    balance: balance ?? null,
    formatted: balance != null ? formatUsdc(balance) : null,
    isLoading,
    isError,
  };
}

function formatUsdc(amount: bigint): string {
  const dollars = Number(amount) / 1_000_000;
  if (dollars >= 1000) return `$${dollars.toFixed(0)}`;
  if (dollars >= 10) return `$${dollars.toFixed(1)}`;
  return `$${dollars.toFixed(2)}`;
}
