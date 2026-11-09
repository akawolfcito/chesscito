import { describe, it, expect } from "vitest";

import {
  EMPTY_ONCHAIN_STATS,
  normalizeGetPeonesVolume,
  unionDistinctOrNull,
  type PackPurchaseVolumeRow,
} from "../onchain";
import { ACCEPTED_TOKENS } from "@/lib/contracts/tokens";

// Resolve the real accepted-stablecoin addresses so the fixtures stay
// in lock-step with the payment rail's allowlist (no hard-coded dupes).
function addrFor(symbol: string): string {
  const t = ACCEPTED_TOKENS.find((x) => x.symbol.toLowerCase() === symbol.toLowerCase());
  if (!t) throw new Error(`test setup: ${symbol} not in ACCEPTED_TOKENS`);
  return t.address;
}
function decimalsFor(symbol: string): number {
  return ACCEPTED_TOKENS.find((x) => x.symbol.toLowerCase() === symbol.toLowerCase())!.decimals;
}

const USDC = addrFor("USDC");
const USDT = addrFor("USDT");
const CUSD = addrFor("cUSD");

/** Build a base-unit string for `human` units of a token. */
function units(symbol: string, human: number): string {
  return (BigInt(Math.round(human * 100)) * 10n ** BigInt(decimalsFor(symbol) - 2)).toString();
}

describe("normalizeGetPeonesVolume", () => {
  it("null input (query failed) → all-null volume", () => {
    expect(normalizeGetPeonesVolume(null)).toEqual({ usdc: null, usdt: null, cusd: null });
  });

  it("empty rows → 0 per token (real empty, not null)", () => {
    expect(normalizeGetPeonesVolume([])).toEqual({ usdc: 0, usdt: 0, cusd: 0 });
  });

  it("sums per token, normalizing 6dp (USDC/USDT) and 18dp (cUSD) consistently", () => {
    const rows: PackPurchaseVolumeRow[] = [
      { token: USDC, amountPaid: units("USDC", 0.5) }, // 0.50
      { token: USDC, amountPaid: units("USDC", 1.25) }, // 1.25
      { token: USDT, amountPaid: units("USDT", 2) }, // 2.00
      { token: CUSD, amountPaid: units("cUSD", 3.5) }, // 3.50 at 18dp
    ];
    expect(normalizeGetPeonesVolume(rows)).toEqual({ usdc: 1.75, usdt: 2, cusd: 3.5 });
  });

  it("skips rows with an unknown / legacy token address", () => {
    const rows: PackPurchaseVolumeRow[] = [
      { token: USDC, amountPaid: units("USDC", 0.5) },
      { token: "0x9999888877776666555544443333222211110000", amountPaid: units("USDC", 99) },
    ];
    expect(normalizeGetPeonesVolume(rows)).toEqual({ usdc: 0.5, usdt: 0, cusd: 0 });
  });

  it("skips rows whose amountPaid is missing or non-integer (no NaN poisoning)", () => {
    const rows: PackPurchaseVolumeRow[] = [
      { token: USDC, amountPaid: units("USDC", 1) },
      { token: USDC, amountPaid: "not-a-number" },
      { token: USDC, amountPaid: "12.5" }, // decimals not allowed in base units
      { token: USDC, amountPaid: null },
      { token: USDC }, // missing
    ];
    expect(normalizeGetPeonesVolume(rows)).toEqual({ usdc: 1, usdt: 0, cusd: 0 });
  });

  it("matches token addresses case-insensitively", () => {
    const rows: PackPurchaseVolumeRow[] = [
      { token: USDC.toUpperCase().replace("0X", "0x"), amountPaid: units("USDC", 2) },
    ];
    expect(normalizeGetPeonesVolume(rows).usdc).toBe(2);
  });
});

describe("unionDistinctOrNull", () => {
  it("counts distinct wallets across sources, lowercasing before dedupe", () => {
    const a = ["0xAAA", "0xbbb"];
    const b = ["0xaaa", "0xccc"]; // 0xAAA / 0xaaa collapse
    expect(unionDistinctOrNull([a, b])).toBe(3);
  });

  it("returns null if ANY source failed (null) — never a partial union", () => {
    expect(unionDistinctOrNull([["0xaaa"], null, ["0xbbb"]])).toBeNull();
  });

  it("empty sources → 0 (real empty), not null", () => {
    expect(unionDistinctOrNull([[], [], []])).toBe(0);
  });

  it("ignores empty-string wallets defensively", () => {
    expect(unionDistinctOrNull([["0xaaa", ""], [""]])).toBe(1);
  });
});

describe("EMPTY_ONCHAIN_STATS", () => {
  it("has all-null counts, all-null volume, and literal-null roadmap fields", () => {
    expect(EMPTY_ONCHAIN_STATS.methodTx.victoryMints).toEqual({
      lifetime: null,
      last30d: null,
      last7d: null,
    });
    expect(EMPTY_ONCHAIN_STATS.uniqueOnchainUsersLifetime).toBeNull();
    expect(EMPTY_ONCHAIN_STATS.getPeonesVolume).toEqual({ usdc: null, usdt: null, cusd: null });
    expect(EMPTY_ONCHAIN_STATS.networkFeesPaidUsd).toBeNull();
    expect(EMPTY_ONCHAIN_STATS.failedTxRate).toBeNull();
  });
});
