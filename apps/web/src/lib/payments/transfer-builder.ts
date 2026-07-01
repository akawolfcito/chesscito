/**
 * Stablecoin single-tx payment rail — pure transfer tx builder (slice C,
 * 2026-06-09).
 *
 * Builds the payload for a direct `ERC20.transfer(treasury, amount)` (the
 * MiniPay one-tx rail). PURE: no tx send, no UI, no React, no window, no
 * receipt verification, no ledger, no env reads (the caller passes the
 * treasury in from rail-config). Gas is NOT adjusted here — it's handled
 * separately via feeCurrency / writeWithOptionalFeeCurrency in a later
 * slice. Does not touch Shop/PRO/Founder/Victory/Arena or Peones spend.
 *
 * Plan: docs/product/chesscito-stablecoin-single-tx-payment-rail-calibration-2026-06-09.md.
 */

import { encodeFunctionData } from "viem";
import { erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import {
  getRailDefaultStablecoin,
  isValidAddress,
  PACK_PURCHASE_SOURCE,
  PEONES_PACKS,
  PRO_PACKS,
  PRO_PURCHASE_SOURCE,
  RAIL_ACCEPTED_STABLECOINS,
  SEASON_PASSES,
  SEASON_PASS_SOURCE,
  type PeonesPackSku,
  type ProPackSku,
  type SeasonPassSku,
} from "@/lib/payments/rail-config";

export type DirectTransferTx = {
  /** Token contract to call (the tx `to`). */
  to: `0x${string}`;
  /** Encoded `transfer(treasury, amount)` calldata. */
  data: `0x${string}`;
  /** Native value — always 0n (this is a token transfer, not a native send). */
  value: bigint;
  /** Token used for the payment. */
  token: { symbol: string; address: `0x${string}`; decimals: number };
  /** Recipient treasury. */
  treasury: `0x${string}`;
  /** Token amount the transfer moves (normalized from priceUsd6). */
  expectedAmount: bigint;
  /** Source price in USD6. */
  priceUsd6: bigint;
  /** Pack SKU + ledger source this transfer pays for. */
  sku: PeonesPackSku;
  source: typeof PACK_PURCHASE_SOURCE;
};

/** Resolve an accepted stablecoin by symbol, or the default (USDC) when
 *  no symbol is given. Throws when the symbol isn't allowlisted. */
function resolveToken(tokenSymbol?: string) {
  if (tokenSymbol === undefined) return getRailDefaultStablecoin();
  const token = RAIL_ACCEPTED_STABLECOINS.find((t) => t.symbol === tokenSymbol);
  if (!token) {
    throw new Error(`Unknown / not-allowlisted stablecoin: ${tokenSymbol}`);
  }
  return token;
}

/**
 * Build the direct-transfer payload for a Peones pack purchase.
 *
 * @param treasury  Recipient address (caller passes it from rail-config —
 *                  the builder never reads env).
 * @param tokenSymbol  Optional stablecoin symbol; defaults to USDC.
 * @throws on an invalid treasury, an unknown SKU, or a non-allowlisted token.
 */
export function buildPeonesPackTransfer(args: {
  sku: PeonesPackSku;
  treasury: string;
  tokenSymbol?: string;
}): DirectTransferTx {
  if (!isValidAddress(args.treasury)) {
    throw new Error(`Invalid treasury address: ${String(args.treasury)}`);
  }
  const pack = PEONES_PACKS[args.sku];
  if (!pack) {
    throw new Error(`Unknown pack SKU: ${String(args.sku)}`);
  }
  const token = resolveToken(args.tokenSymbol);

  // No gas adjustment here — the Transfer moves exactly `expectedAmount`;
  // gas is paid separately (Celo fee abstraction) in a later slice.
  const expectedAmount = normalizePrice(pack.priceUsd6, token.decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [args.treasury, expectedAmount],
  });

  return {
    to: token.address,
    data,
    value: 0n,
    token: { symbol: token.symbol, address: token.address, decimals: token.decimals },
    treasury: args.treasury,
    expectedAmount,
    priceUsd6: pack.priceUsd6,
    sku: pack.sku,
    source: pack.source,
  };
}

export type SeasonPassTransferTx = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  token: { symbol: string; address: `0x${string}`; decimals: number };
  treasury: `0x${string}`;
  expectedAmount: bigint;
  priceUsd6: bigint;
  sku: SeasonPassSku;
  source: typeof SEASON_PASS_SOURCE;
};

export function buildSeasonPassTransfer(args: {
  sku: SeasonPassSku;
  treasury: string;
  tokenSymbol?: string;
}): SeasonPassTransferTx {
  if (!isValidAddress(args.treasury)) {
    throw new Error(`Invalid treasury address: ${String(args.treasury)}`);
  }
  const pass = SEASON_PASSES[args.sku];
  if (!pass) {
    throw new Error(`Unknown season pass SKU: ${String(args.sku)}`);
  }
  const token = resolveToken(args.tokenSymbol);
  const expectedAmount = normalizePrice(pass.priceUsd6, token.decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [args.treasury, expectedAmount],
  });
  return {
    to: token.address,
    data,
    value: 0n,
    token: { symbol: token.symbol, address: token.address, decimals: token.decimals },
    treasury: args.treasury,
    expectedAmount,
    priceUsd6: pass.priceUsd6,
    sku: pass.sku,
    source: pass.source,
  };
}

export type ProPackTransferTx = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  token: { symbol: string; address: `0x${string}`; decimals: number };
  treasury: `0x${string}`;
  expectedAmount: bigint;
  priceUsd6: bigint;
  sku: ProPackSku;
  source: typeof PRO_PURCHASE_SOURCE;
};

/**
 * Build the direct-transfer payload for a Chesscito PRO purchase via the
 * no-approve rail. Same shape as `buildSeasonPassTransfer` — the Shop's
 * approve+`buyItem` PRO path (itemId 6) is untouched and stays a separate
 * way to buy the identical entitlement.
 *
 * @throws on an invalid treasury, an unknown SKU, or a non-allowlisted token.
 */
export function buildProPackTransfer(args: {
  sku: ProPackSku;
  treasury: string;
  tokenSymbol?: string;
}): ProPackTransferTx {
  if (!isValidAddress(args.treasury)) {
    throw new Error(`Invalid treasury address: ${String(args.treasury)}`);
  }
  const pack = PRO_PACKS[args.sku];
  if (!pack) {
    throw new Error(`Unknown PRO pack SKU: ${String(args.sku)}`);
  }
  const token = resolveToken(args.tokenSymbol);
  const expectedAmount = normalizePrice(pack.priceUsd6, token.decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [args.treasury, expectedAmount],
  });
  return {
    to: token.address,
    data,
    value: 0n,
    token: { symbol: token.symbol, address: token.address, decimals: token.decimals },
    treasury: args.treasury,
    expectedAmount,
    priceUsd6: pack.priceUsd6,
    sku: pack.sku,
    source: pack.source,
  };
}
