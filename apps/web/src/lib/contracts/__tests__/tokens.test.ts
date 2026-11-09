import { describe, it, expect } from "vitest";
import {
  ACCEPTED_TOKENS,
  CELO_ADDRESS_LOWER,
  CELO_TOKEN,
  STABLECOIN_ADDRESSES_LOWER,
  normalizePrice,
} from "../tokens";

describe("CELO_TOKEN constants", () => {
  it("uses the canonical Celo mainnet address with 18 decimals", () => {
    expect(CELO_TOKEN.symbol).toBe("CELO");
    expect(CELO_TOKEN.decimals).toBe(18);
    expect(CELO_TOKEN.address).toBe("0x471EcE3750Da237f93B8E339c536989b8978a438");
  });

  it("CELO_ADDRESS_LOWER matches CELO_TOKEN.address case-insensitively", () => {
    expect(CELO_ADDRESS_LOWER).toBe(CELO_TOKEN.address.toLowerCase());
  });

  it("CELO is NOT in the stablecoin allowlist used by coach verify-purchase", () => {
    expect(STABLECOIN_ADDRESSES_LOWER).not.toContain(CELO_ADDRESS_LOWER);
  });
});

describe("STABLECOIN_ADDRESSES_LOWER", () => {
  it("contains every accepted stablecoin in lowercase form", () => {
    expect(STABLECOIN_ADDRESSES_LOWER).toHaveLength(ACCEPTED_TOKENS.length);
    for (const stable of ACCEPTED_TOKENS) {
      expect(STABLECOIN_ADDRESSES_LOWER).toContain(stable.address.toLowerCase());
    }
  });
});

describe("normalizePrice with the helper Founder Badge CELO priceUsd6", () => {
  // priceUsd6 = 1_000_000 ($1.00 nominal) is what the admin tx
  // setItem(5, 1_000_000, true) installs. With 18 decimals it should
  // resolve to exactly one CELO so the user sees "Buy with 1 CELO".
  it("normalizes the calibrated $1 USD6 to exactly 1e18 wei (1 CELO)", () => {
    expect(normalizePrice(1_000_000n, CELO_TOKEN.decimals)).toBe(10n ** 18n);
  });
});
