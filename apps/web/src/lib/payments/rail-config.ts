/**
 * Stablecoin single-tx payment rail — constants + config (slice B,
 * 2026-06-09).
 *
 * Config ONLY: no tx builder, no endpoint, no ledger writes, no UI. The
 * MiniPay direct-transfer rail (`ERC20.transfer(treasury, amount)`) reads
 * from here. Additive — does not touch Shop/PRO/Founder/Victory/Arena.
 *
 * Plan: docs/product/chesscito-stablecoin-single-tx-payment-rail-calibration-2026-06-09.md.
 */

import {
  ACCEPTED_TOKENS,
  STABLECOIN_ADDRESSES_LOWER,
} from "@/lib/contracts/tokens";

/* ── Treasury ───────────────────────────────────────────────────────
 * The direct-transfer rail needs an explicit recipient (the Shop flow
 * gets it from the contract event; a bare transfer does not). Configured
 * via env, never hardcoded. Getters are LAZY and return `null` when
 * unset/invalid so callers render a "coming soon" / fall back to the Shop
 * flow instead of crashing — NEVER eager-throw at import (cf.
 * sign-routes-labyrinth-env-fix). Until the real treasury is set the rail
 * is "not configured" and the MiniPay smoke is blocked. */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** True iff `value` is a well-formed 0x-prefixed 20-byte hex address. */
export function isValidAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

/** Frontend treasury (public build-time env). `null` when unset/invalid. */
export function getTreasuryAddressClient(): `0x${string}` | null {
  const raw = process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
  return isValidAddress(raw) ? raw : null;
}

/** Backend treasury (server-only env). `null` when unset/invalid. */
export function getTreasuryAddressServer(): `0x${string}` | null {
  const raw = process.env.CHESSCITO_TREASURY_ADDRESS;
  return isValidAddress(raw) ? raw : null;
}

/** Lowercased treasury for case-insensitive backend comparison against a
 *  decoded `Transfer` event `to`. `null` when the server treasury is unset. */
export function getTreasuryAddressServerLower(): string | null {
  const addr = getTreasuryAddressServer();
  return addr ? addr.toLowerCase() : null;
}

/** Whether the rail has a usable client treasury (UI gating / smoke gate). */
export function isRailTreasuryConfiguredClient(): boolean {
  return getTreasuryAddressClient() !== null;
}

/* ── Stablecoins ────────────────────────────────────────────────────
 * Reuses the existing token config. Default USDC (6 decimals → simple
 * math, already wired); cUSD/USDT stay accepted. USDm is NOT configured
 * and is out of scope until it is. */

/** Symbol of the default rail stablecoin. */
export const RAIL_DEFAULT_STABLECOIN_SYMBOL = "USDC" as const;

/** Tokens a user may pay the rail with (reuses ACCEPTED_TOKENS). */
export const RAIL_ACCEPTED_STABLECOINS = ACCEPTED_TOKENS;

/** Lowercased accepted-stablecoin allowlist for backend verification
 *  (reuses the existing defense-in-depth allowlist). */
export const RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER = STABLECOIN_ADDRESSES_LOWER;

/** The default rail stablecoin entry ({symbol, address, decimals}). */
export function getRailDefaultStablecoin() {
  return (
    ACCEPTED_TOKENS.find((t) => t.symbol === RAIL_DEFAULT_STABLECOIN_SYMBOL) ??
    ACCEPTED_TOKENS[0]
  );
}

/* ── Overpay policy ─────────────────────────────────────────────────
 * Verification (slice D) enforces this; declared here as the single
 * source of truth. value >= expected → accept + credit the nominal pack
 * (no automatic bonus). value < expected → reject. Overpay is logged in
 * metadata, never refunded automatically. */
export const RAIL_OVERPAY_ACCEPTED = true;

/* ── Peones packs ───────────────────────────────────────────────────
 * A pack is a direct stablecoin payment that credits Peones server-side
 * (source `pack_purchase`, already reserved in the ledger). No on-chain
 * item — clean fit for the direct-transfer rail. */

export type PeonesPackSku = "peones_pack_50";

/** Ledger source/event for a pack purchase (matches the reserved source
 *  in the Peones ledger). */
export const PACK_PURCHASE_SOURCE = "pack_purchase" as const;

export type PeonesPack = {
  sku: PeonesPackSku;
  /** Price in USD6 (1_000_000 = $1.00). */
  priceUsd6: bigint;
  /** Peones credited on a verified purchase. */
  peonesReward: number;
  source: typeof PACK_PURCHASE_SOURCE;
};

export const PEONES_PACKS: Record<PeonesPackSku, PeonesPack> = {
  peones_pack_50: {
    sku: "peones_pack_50",
    priceUsd6: 500_000n, // $0.50
    peonesReward: 50,
    source: PACK_PURCHASE_SOURCE,
  },
};

/** Lookup a pack by SKU. */
export function getPeonesPack(sku: PeonesPackSku): PeonesPack {
  return PEONES_PACKS[sku];
}

/* ── Idempotency ────────────────────────────────────────────────────
 * One stable key per on-chain transfer log so a re-submitted txHash
 * never double-credits. Slots into the ledger's UNIQUE idempotency_key.
 * txHash lowercased for stability. */
export function buildPaymentIdempotencyKey(args: {
  source: typeof PACK_PURCHASE_SOURCE;
  chainId: number;
  txHash: string;
  logIndex: number;
}): string {
  return `${args.source}:${args.chainId}:${args.txHash.toLowerCase()}:${args.logIndex}`;
}
