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

/** Backend treasury (server-only env). Reads CHESSCITO_TREASURY_ADDRESS,
 *  falling back to the existing TREASURY_ADDRESS (the Shop's payment
 *  recipient — the rail reuses the same treasury). `null` when both are
 *  unset/invalid → fail closed. */
export function getTreasuryAddressServer(): `0x${string}` | null {
  const raw =
    process.env.CHESSCITO_TREASURY_ADDRESS ?? process.env.TREASURY_ADDRESS;
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

/* Flexible top-up. One Peon costs $0.01, so a pack's price is simply its
 * reward times the unit price — there is no per-tier discount and no bonus.
 * These four numbers are the ONLY authority for what the player may buy. */

/** $0.01 per Peon, in USD6 (1_000_000 = $1.00). */
export const PEONES_UNIT_PRICE_USD6 = 10_000n;
export const PEONES_MIN_AMOUNT = 5;
export const PEONES_MAX_AMOUNT = 100;
export const PEONES_AMOUNT_STEP = 5;
export const PEONES_DEFAULT_AMOUNT = 25;

/* Written out as a literal tuple because `as const` is what gives us the
 * per-amount SKU union below — a computed range would collapse to `number`
 * and take the type safety with it. `supported-amounts` in the tests asserts
 * this tuple against the range the four constants describe, so the two can
 * never drift apart silently. */
export const SUPPORTED_PEONES_AMOUNTS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const;

export type PeonesAmount = (typeof SUPPORTED_PEONES_AMOUNTS)[number];

export type PeonesPackSku = `peones_pack_${PeonesAmount}`;

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

/** SKU for a supported amount. Type-level guarantee that every amount in the
 *  tuple has a pack, and that no other amount can name one. */
export function getPeonesPackSku(amount: PeonesAmount): PeonesPackSku {
  return `peones_pack_${amount}`;
}

export const PEONES_PACKS: Record<PeonesPackSku, PeonesPack> = Object.fromEntries(
  SUPPORTED_PEONES_AMOUNTS.map((amount) => [
    getPeonesPackSku(amount),
    {
      sku: getPeonesPackSku(amount),
      priceUsd6: BigInt(amount) * PEONES_UNIT_PRICE_USD6,
      peonesReward: amount,
      source: PACK_PURCHASE_SOURCE,
    } satisfies PeonesPack,
  ]),
) as Record<PeonesPackSku, PeonesPack>;

/** Lookup a pack by SKU. */
export function getPeonesPack(sku: PeonesPackSku): PeonesPack {
  return PEONES_PACKS[sku];
}

/** Narrow an untrusted number to a buyable amount. The step matters as much as
 *  the bounds: 37 is inside the range and still not for sale. */
export function isSupportedPeonesAmount(amount: number): amount is PeonesAmount {
  return (SUPPORTED_PEONES_AMOUNTS as readonly number[]).includes(amount);
}

/** Snap an arbitrary number onto the nearest buyable amount, bounds included.
 *  Used by the stepper and by the `initialAmount` API, both of which take input
 *  we do not control. NaN and friends fall back to the default. */
export function clampPeonesAmount(amount: number): PeonesAmount {
  if (!Number.isFinite(amount)) return PEONES_DEFAULT_AMOUNT;
  const snapped = Math.round(amount / PEONES_AMOUNT_STEP) * PEONES_AMOUNT_STEP;
  const bounded = Math.min(PEONES_MAX_AMOUNT, Math.max(PEONES_MIN_AMOUNT, snapped));
  return (isSupportedPeonesAmount(bounded) ? bounded : PEONES_DEFAULT_AMOUNT) as PeonesAmount;
}

/* ── Lite Season Pass ────────────────────────────────────────────────
 * A time-gated entitlement for Chesscito Lite. Same direct-transfer
 * rail (`ERC20.transfer(treasury, amount)`) — different SKU, different
 * DB table, different reward (entitlement TTL + 3 Streak Shields).
 * No contracts, no PRO, no Coach, no Shop. Lite-only. */

export type SeasonPassSku = "lite_season_pass_21";

export const SEASON_PASS_SOURCE = "season_pass" as const;

export type SeasonPass = {
  sku: SeasonPassSku;
  priceUsd6: bigint;
  /** Cuánto acceso pagado otorga la compra. Gobierna `expires_at` y, por lo
   *  tanto, la reconstrucción del inicio de ventana. NO es la meta. */
  accessDurationDays: number;
  /** Cuántos Focus Days hay que completar DENTRO de la ventana de acceso.
   *  NO es la duración del pase. Invariante: <= accessDurationDays.
   *
   *  Los dos son `number`, así que cruzarlos COMPILA. Lo único que lo detecta
   *  son los tests de discriminación (AC2–AC6 del spec 21-en-30), que se
   *  validan intercambiando estos dos valores: si la suite queda verde, los
   *  tests no sirven. */
  challengeGoalDays: number;
  shieldsOnPurchase: number;
  seasonId: string;
  supporterStatus: string;
  source: typeof SEASON_PASS_SOURCE;
};

export const SEASON_PASSES: Record<SeasonPassSku, SeasonPass> = {
  lite_season_pass_21: {
    sku: "lite_season_pass_21",
    priceUsd6: 990_000n, // $0.99
    accessDurationDays: 30,
    challengeGoalDays: 21,
    shieldsOnPurchase: 3,
    seasonId: "21day-mind-challenge-2026-q3",
    supporterStatus: "challenger",
    source: SEASON_PASS_SOURCE,
  },
};

export function getSeasonPass(sku: SeasonPassSku): SeasonPass {
  return SEASON_PASSES[sku];
}

/* ── Chesscito PRO ──────────────────────────────────────────────────
 * Same direct-transfer rail as Season Pass / Peones. Price and duration
 * match the existing Shop.buyItem PRO item (itemId 6, shop-catalog.ts)
 * exactly — this is a second way to pay for the identical entitlement,
 * not a different product. The Shop path stays live in parallel during
 * rollout (see docs/product/chesscito-monetization-consolidation-audit-2026-07-01.md). */

export type ProPackSku = "chesscito_pro_30";

export const PRO_PURCHASE_SOURCE = "pro_purchase" as const;

export type ProPack = {
  sku: ProPackSku;
  priceUsd6: bigint;
  durationDays: number;
  source: typeof PRO_PURCHASE_SOURCE;
};

export const PRO_PACKS: Record<ProPackSku, ProPack> = {
  chesscito_pro_30: {
    sku: "chesscito_pro_30",
    priceUsd6: 1_990_000n, // $1.99, matches PRO_PRICE_USD6 in shop-catalog.ts
    durationDays: 30,
    source: PRO_PURCHASE_SOURCE,
  },
};

export function getProPack(sku: ProPackSku): ProPack {
  return PRO_PACKS[sku];
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
