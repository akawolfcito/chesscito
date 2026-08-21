import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GET_PEONES_CANARY_REWARD,
  GET_PEONES_CANARY_SKU,
  isCanaryEligibleSku,
} from "@/lib/payments/get-peones-canary";
import { getPeonesPack, PEONES_PACKS, type PeonesPackSku } from "@/lib/payments/rail-config";

/**
 * The treasury canary is pinned in PRODUCTION, not just in this repo. Proven
 * read-only against the live database on 2026-08-20
 * (`docs/audits/2026-08-20-peones-flexible-topup-canary-proof.md`):
 *
 *   treasury_payment_intents_sku_check  CHECK ((sku = 'peones_pack_50'::text))
 *   consume_get_peones_treasury_payment  →  if v_intent.sku <> 'peones_pack_50'
 *                                             then raise exception 'wrong_sku'
 *   …and the ledger insert HARDCODES the reward:
 *   lower(p_wallet), 'earn', 50, 'pack_purchase', 'peones_pack_50',
 *
 * That last line is why widening the canary is not a config change: the DB
 * would credit 50 Peones for ANY amount. Flexible top-up therefore ships on
 * the legacy rail only, and these tests are the fence.
 */

const WEB_SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(WEB_SRC, rel), "utf8");

describe("CANARY-1 — the canary SKU is frozen", () => {
  it("is exactly the SKU the production CHECK constraint allows", () => {
    expect(GET_PEONES_CANARY_SKU).toBe("peones_pack_50");
  });

  it("declares the reward the production function hardcodes", () => {
    expect(GET_PEONES_CANARY_REWARD).toBe(50);
  });
});

describe("CANARY-2 — the canary pack keeps its exact live shape", () => {
  it("credits 50 Peones for $0.50, byte-for-byte", () => {
    const pack = getPeonesPack(GET_PEONES_CANARY_SKU);
    expect(pack.peonesReward).toBe(50);
    expect(pack.priceUsd6).toBe(500_000n);
    expect(pack.sku).toBe("peones_pack_50");
    expect(pack.source).toBe("pack_purchase");
  });

  it("agrees with the reward the canary module advertises", () => {
    expect(getPeonesPack(GET_PEONES_CANARY_SKU).peonesReward).toBe(GET_PEONES_CANARY_REWARD);
  });
});

describe("CANARY-3 — no flexible SKU may reach the treasury canary", () => {
  const flexible = (Object.keys(PEONES_PACKS) as PeonesPackSku[]).filter(
    (sku) => sku !== GET_PEONES_CANARY_SKU,
  );

  it("has flexible SKUs to guard (otherwise this suite proves nothing)", () => {
    expect(flexible.length).toBeGreaterThan(0);
  });

  it.each(flexible)("rejects %s as canary-eligible", (sku) => {
    expect(isCanaryEligibleSku(sku)).toBe(false);
  });

  it("rejects arbitrary strings, not just known SKUs", () => {
    for (const candidate of ["", "peones_pack_5", "peones_pack_500", "PEONES_PACK_50", "pro_30"]) {
      expect(isCanaryEligibleSku(candidate)).toBe(false);
    }
  });

  it("gates intent creation on the predicate, so the guard cannot drift", () => {
    const route = read("app/api/payment-intents/get-peones/route.ts");
    expect(route).toContain("isCanaryEligibleSku");
    // The route must never persist a caller-supplied SKU: every write and
    // lookup uses the frozen constant.
    expect(route).not.toMatch(/sku:\s*body\.sku/);
  });

  it("never lets the canary verifier read a caller-supplied SKU", () => {
    const verifier = read("app/api/verify-payment/get-peones-canary/route.ts");
    expect(verifier).not.toMatch(/getPeonesPackSku|isSupportedPeonesAmount/);
  });
});

describe("CANARY-4 — only the canary SKU is canary-eligible", () => {
  it("accepts exactly one SKU out of the whole catalogue", () => {
    const eligible = (Object.keys(PEONES_PACKS) as PeonesPackSku[]).filter(isCanaryEligibleSku);
    expect(eligible).toEqual([GET_PEONES_CANARY_SKU]);
  });
});
