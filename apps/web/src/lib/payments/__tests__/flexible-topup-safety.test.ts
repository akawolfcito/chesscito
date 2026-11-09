import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePrice } from "@/lib/contracts/tokens";
import { buildPeonesPackTransfer } from "@/lib/payments/transfer-builder";
import {
  clampPeonesAmount,
  getPeonesPack,
  getPeonesPackSku,
  isSupportedPeonesAmount,
  PEONES_AMOUNT_STEP,
  PEONES_DEFAULT_AMOUNT,
  PEONES_MAX_AMOUNT,
  PEONES_MIN_AMOUNT,
  PEONES_PACKS,
  PEONES_UNIT_PRICE_USD6,
  SUPPORTED_PEONES_AMOUNTS,
  type PeonesPackSku,
} from "@/lib/payments/rail-config";

const SKUS = Object.keys(PEONES_PACKS) as PeonesPackSku[];
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";

describe("PAY-1 — price is always reward × unit price", () => {
  it.each(SKUS)("%s charges $0.01 per Peon exactly", (sku) => {
    const pack = getPeonesPack(sku);
    expect(pack.priceUsd6).toBe(BigInt(pack.peonesReward) * PEONES_UNIT_PRICE_USD6);
  });

  it("has no free and no zero-price pack", () => {
    for (const sku of SKUS) {
      const pack = getPeonesPack(sku);
      expect(pack.peonesReward).toBeGreaterThan(0);
      expect(pack.priceUsd6).toBeGreaterThan(0n);
    }
  });
});

describe("PAY-2 — the live 50-pack is byte-identical to before", () => {
  it("still costs $0.50 for 50 Peones", () => {
    expect(getPeonesPack("peones_pack_50")).toEqual({
      sku: "peones_pack_50",
      priceUsd6: 500_000n,
      peonesReward: 50,
      source: "pack_purchase",
    });
  });
});

describe("PAY-3 — the ladder matches the four constants", () => {
  it("is exactly min…max by step, with no gaps and no extras", () => {
    const expected: number[] = [];
    for (let a = PEONES_MIN_AMOUNT; a <= PEONES_MAX_AMOUNT; a += PEONES_AMOUNT_STEP) {
      expected.push(a);
    }
    expect([...SUPPORTED_PEONES_AMOUNTS]).toEqual(expected);
  });

  it("has one pack per amount and no orphan SKU", () => {
    expect(SKUS).toHaveLength(SUPPORTED_PEONES_AMOUNTS.length);
  });
});

describe("PAY-4 — the default is itself buyable", () => {
  it("defaults to 25 and 25 is on the ladder", () => {
    expect(PEONES_DEFAULT_AMOUNT).toBe(25);
    expect(isSupportedPeonesAmount(PEONES_DEFAULT_AMOUNT)).toBe(true);
  });

  it("bounds are on the ladder too", () => {
    expect(isSupportedPeonesAmount(PEONES_MIN_AMOUNT)).toBe(true);
    expect(isSupportedPeonesAmount(PEONES_MAX_AMOUNT)).toBe(true);
  });
});

describe("PAY-5 — SKU and reward cannot disagree", () => {
  it.each([...SUPPORTED_PEONES_AMOUNTS])("peones_pack_%i credits %i", (amount) => {
    const sku = getPeonesPackSku(amount);
    expect(sku).toBe(`peones_pack_${amount}`);
    const pack = getPeonesPack(sku);
    expect(pack.sku).toBe(sku);
    expect(pack.peonesReward).toBe(amount);
  });

  it("keys the record by the SKU each pack declares", () => {
    for (const sku of SKUS) expect(getPeonesPack(sku).sku).toBe(sku);
  });
});

describe("PAY-6 — every pack credits through the reserved ledger source", () => {
  it.each(SKUS)("%s uses pack_purchase", (sku) => {
    expect(getPeonesPack(sku).source).toBe("pack_purchase");
  });
});

describe("PAY-7 — clamping never produces an unbuyable amount", () => {
  it("snaps arbitrary input onto the ladder", () => {
    const inputs = [
      -1000, -5, 0, 1, 2, 3, 4, 5, 7, 12, 24, 26, 37, 99, 100, 101, 1000,
      Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 12.7, 0.5,
    ];
    for (const input of inputs) {
      const out = clampPeonesAmount(input);
      expect(isSupportedPeonesAmount(out)).toBe(true);
      expect(PEONES_PACKS[getPeonesPackSku(out)]).toBeDefined();
    }
  });

  it("clamps to the bounds rather than wrapping", () => {
    expect(clampPeonesAmount(-1000)).toBe(PEONES_MIN_AMOUNT);
    expect(clampPeonesAmount(1000)).toBe(PEONES_MAX_AMOUNT);
    expect(clampPeonesAmount(1)).toBe(PEONES_MIN_AMOUNT);
  });

  it("falls back to the default on non-numbers", () => {
    expect(clampPeonesAmount(Number.NaN)).toBe(PEONES_DEFAULT_AMOUNT);
  });

  it("leaves an already-valid amount alone", () => {
    for (const amount of SUPPORTED_PEONES_AMOUNTS) {
      expect(clampPeonesAmount(amount)).toBe(amount);
    }
  });
});

describe("PAY-8 — off-ladder amounts are refused, not rounded silently", () => {
  it("rejects in-range values that miss the step", () => {
    for (const bad of [1, 2, 3, 4, 6, 7, 11, 24, 26, 37, 99]) {
      expect(isSupportedPeonesAmount(bad)).toBe(false);
    }
  });

  it("rejects out-of-range and non-integer values", () => {
    for (const bad of [0, -5, 105, 500, 2.5, 12.5, Number.NaN]) {
      expect(isSupportedPeonesAmount(bad)).toBe(false);
    }
  });
});

describe("PAY-9 — the credited amount is server-decided from the SKU", () => {
  const route = readFileSync(
    join(process.cwd(), "src/app/api/verify-payment/route.ts"),
    "utf8",
  );

  it("derives the credit from the pack, not from the request body", () => {
    expect(route).toContain("const peonesCredited = pack.peonesReward;");
    expect(route).toContain("p_peones: peonesCredited,");
    // The ledger reference carries the SKU, and the SKU carries the amount.
    // That is what makes amount distribution queryable with NO new telemetry:
    // `select reference, count(*) from peones_ledger where source='pack_purchase'`.
    expect(route).toContain("p_sku: sku,");
  });

  it("never reads a reward or amount off the client payload", () => {
    expect(route).not.toMatch(/body\.(peones|peonesReward|amount|reward)\b/);
    expect(route).not.toMatch(/p_peones:\s*(body|payload|req)\b/);
  });

  it("validates the SKU against the catalogue before pricing it", () => {
    expect(route).toContain("sku in PEONES_PACKS");
  });
});

describe("PAY-10 — the transfer moves exactly the pack price", () => {
  it.each(SKUS)("%s transfers its own price", (sku) => {
    const pack = getPeonesPack(sku);
    const tx = buildPeonesPackTransfer({ sku, treasury: TREASURY, tokenSymbol: "USDC" });
    expect(tx.expectedAmount).toBe(normalizePrice(pack.priceUsd6, 6));
  });

  it("charges strictly more for more Peones", () => {
    const prices = SUPPORTED_PEONES_AMOUNTS.map(
      (a) => getPeonesPack(getPeonesPackSku(a)).priceUsd6,
    );
    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]!);
    }
  });
});
