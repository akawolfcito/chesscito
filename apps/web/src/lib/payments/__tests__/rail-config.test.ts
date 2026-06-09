import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STABLECOIN_ADDRESSES_LOWER } from "@/lib/contracts/tokens";
import {
  buildPaymentIdempotencyKey,
  getPeonesPack,
  getRailDefaultStablecoin,
  getTreasuryAddressClient,
  getTreasuryAddressServer,
  getTreasuryAddressServerLower,
  isRailTreasuryConfiguredClient,
  isValidAddress,
  PACK_PURCHASE_SOURCE,
  PEONES_PACKS,
  RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER,
  RAIL_DEFAULT_STABLECOIN_SYMBOL,
  RAIL_OVERPAY_ACCEPTED,
} from "@/lib/payments/rail-config";

const VALID = "0x1234567890abcdef1234567890abcdef12345678";

describe("rail-config — treasury", () => {
  const original = {
    client: process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS,
    server: process.env.CHESSCITO_TREASURY_ADDRESS,
    legacy: process.env.TREASURY_ADDRESS,
  };
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
    delete process.env.CHESSCITO_TREASURY_ADDRESS;
    delete process.env.TREASURY_ADDRESS;
  });
  afterEach(() => {
    if (original.client === undefined) delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
    else process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS = original.client;
    if (original.server === undefined) delete process.env.CHESSCITO_TREASURY_ADDRESS;
    else process.env.CHESSCITO_TREASURY_ADDRESS = original.server;
    if (original.legacy === undefined) delete process.env.TREASURY_ADDRESS;
    else process.env.TREASURY_ADDRESS = original.legacy;
  });

  it("validates a well-formed address", () => {
    expect(isValidAddress(VALID)).toBe(true);
    expect(isValidAddress("0x123")).toBe(false); // too short
    expect(isValidAddress("1234567890abcdef1234567890abcdef12345678")).toBe(false); // no 0x
    expect(isValidAddress("0xZZZ4567890abcdef1234567890abcdef12345678")).toBe(false); // non-hex
    expect(isValidAddress(undefined)).toBe(false);
    expect(isValidAddress(123)).toBe(false);
  });

  it("returns the configured client treasury", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS = VALID;
    expect(getTreasuryAddressClient()).toBe(VALID);
    expect(isRailTreasuryConfiguredClient()).toBe(true);
  });

  it("returns the configured server treasury (+ lowercased)", () => {
    process.env.CHESSCITO_TREASURY_ADDRESS = "0xAbCdEf1234567890ABCDEF1234567890abcdef12";
    expect(getTreasuryAddressServer()).toBe("0xAbCdEf1234567890ABCDEF1234567890abcdef12");
    expect(getTreasuryAddressServerLower()).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("falls back to TREASURY_ADDRESS when CHESSCITO_TREASURY_ADDRESS is unset", () => {
    process.env.TREASURY_ADDRESS = VALID;
    expect(getTreasuryAddressServer()).toBe(VALID);
  });

  it("prefers CHESSCITO_TREASURY_ADDRESS over TREASURY_ADDRESS", () => {
    process.env.CHESSCITO_TREASURY_ADDRESS = VALID;
    process.env.TREASURY_ADDRESS = "0x0000000000000000000000000000000000000001";
    expect(getTreasuryAddressServer()).toBe(VALID);
  });

  it("rejects an invalid/unset treasury (null, no throw)", () => {
    expect(getTreasuryAddressClient()).toBeNull();
    expect(getTreasuryAddressServer()).toBeNull();
    expect(getTreasuryAddressServerLower()).toBeNull();
    expect(isRailTreasuryConfiguredClient()).toBe(false);

    process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS = "not-an-address";
    expect(getTreasuryAddressClient()).toBeNull();
    expect(isRailTreasuryConfiguredClient()).toBe(false);
  });
});

describe("rail-config — stablecoins", () => {
  it("defaults to USDC and the default token exists", () => {
    expect(RAIL_DEFAULT_STABLECOIN_SYMBOL).toBe("USDC");
    const def = getRailDefaultStablecoin();
    expect(def.symbol).toBe("USDC");
    expect(def.decimals).toBe(6);
    expect(def.address).toBe("0xcebA9300f2b948710d2653dD7B07f33A8B32118C");
  });

  it("accepted stablecoin allowlist matches the existing token allowlist", () => {
    expect(RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER).toEqual(STABLECOIN_ADDRESSES_LOWER);
    // USDC + USDT + cUSD, all lowercased.
    expect(RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER).toHaveLength(3);
    for (const a of RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER) {
      expect(a).toBe(a.toLowerCase());
    }
  });
});

describe("rail-config — peones_pack_50 SKU", () => {
  it("exists with $0.50 price and 50 Peones reward", () => {
    const pack = getPeonesPack("peones_pack_50");
    expect(pack.sku).toBe("peones_pack_50");
    expect(pack.priceUsd6).toBe(500_000n); // $0.50
    expect(pack.peonesReward).toBe(50);
    expect(pack.source).toBe("pack_purchase");
    expect(PEONES_PACKS.peones_pack_50).toBe(pack);
  });

  it("ledger source is pack_purchase", () => {
    expect(PACK_PURCHASE_SOURCE).toBe("pack_purchase");
  });
});

describe("rail-config — overpay policy + idempotency", () => {
  it("accepts overpay (value >= expected)", () => {
    expect(RAIL_OVERPAY_ACCEPTED).toBe(true);
  });

  it("builds a stable idempotency key from chainId + txHash + logIndex", () => {
    const key = buildPaymentIdempotencyKey({
      source: PACK_PURCHASE_SOURCE,
      chainId: 42220,
      txHash: "0xABCDEF",
      logIndex: 2,
    });
    expect(key).toBe("pack_purchase:42220:0xabcdef:2"); // txHash lowercased
  });
});
