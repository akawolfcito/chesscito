import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  COACH_PACK_ITEMS,
  FOUNDER_BADGE_CELO_ITEM_ID,
  FOUNDER_BADGE_ITEM_ID,
  PRO_DURATION_DAYS,
  PRO_ITEM_ID,
  PRO_PRICE_USD6,
  SHIELDS_PER_PURCHASE,
  SHIELD_ITEM_ID,
  SHOP_ITEMS,
  SHOP_TILE_ASSETS,
} from "../shop-catalog";

function findWebRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      const content = JSON.parse(readFileSync(pkg, "utf-8"));
      if (content.name === "web") return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Could not find apps/web root");
}

describe("shop-catalog", () => {
  it("publishes the founder badge as itemId 1n, the retry shield as 2n, and the CELO sibling as 5n", () => {
    expect(FOUNDER_BADGE_ITEM_ID).toBe(1n);
    expect(SHIELD_ITEM_ID).toBe(2n);
    expect(FOUNDER_BADGE_CELO_ITEM_ID).toBe(5n);
  });

  it("exposes founder + PRO + shield + coach packs + CELO sibling in the catalog with copy keys for locale-aware resolution", () => {
    // PRO + Founder + Shield + CoachPack5 + CoachPack20 + CELO sibling.
    expect(SHOP_ITEMS).toHaveLength(6);
    for (const item of SHOP_ITEMS) {
      expect(item.copyKey.length).toBeGreaterThan(0);
    }
  });

  it("includes both coach packs in SHOP_ITEMS with size-specific copy keys", () => {
    const pack5 = SHOP_ITEMS.find((i) => i.itemId === COACH_PACK_ITEMS[5].itemId);
    const pack20 = SHOP_ITEMS.find((i) => i.itemId === COACH_PACK_ITEMS[20].itemId);
    expect(pack5?.copyKey).toBe("coachPack5");
    expect(pack20?.copyKey).toBe("coachPack20");
  });

  it("the CELO sibling reuses the Founder Badge copy key so the UI can group both routes under one product card", () => {
    const founder = SHOP_ITEMS.find((i) => i.itemId === FOUNDER_BADGE_ITEM_ID);
    const celoFounder = SHOP_ITEMS.find((i) => i.itemId === FOUNDER_BADGE_CELO_ITEM_ID);
    expect(founder?.copyKey).toBe(celoFounder?.copyKey);
  });

  it("ships the shield row with the documented item id so the admin tx setItem(2,...) wires it up", () => {
    const shield = SHOP_ITEMS.find((item) => item.itemId === SHIELD_ITEM_ID);
    expect(shield).toBeDefined();
    expect(shield?.copyKey).toBe("retryShield");
  });

  it("credits 3 shield uses per purchase to match the SHIELD_COPY.buyLabel '(3 uses)' promise", () => {
    expect(SHIELDS_PER_PURCHASE).toBe(3);
  });

  it("publishes the 5-credit coach pack as itemId 3n at $0.05 (50_000 USD6)", () => {
    expect(COACH_PACK_ITEMS[5].itemId).toBe(3n);
    expect(COACH_PACK_ITEMS[5].priceUsd6).toBe(50_000n);
  });

  it("publishes the 20-credit coach pack as itemId 4n at $0.10 (100_000 USD6)", () => {
    expect(COACH_PACK_ITEMS[20].itemId).toBe(4n);
    expect(COACH_PACK_ITEMS[20].priceUsd6).toBe(100_000n);
  });

  it("keeps the 20-credit pack at a better unit price than the 5-credit pack", () => {
    const unit5 = Number(COACH_PACK_ITEMS[5].priceUsd6) / 5;
    const unit20 = Number(COACH_PACK_ITEMS[20].priceUsd6) / 20;
    expect(unit20).toBeLessThan(unit5);
  });

  it("publishes Chesscito PRO as itemId 6n at $1.99 (1_990_000 USD6) for a 30-day pass", () => {
    expect(PRO_ITEM_ID).toBe(6n);
    expect(PRO_PRICE_USD6).toBe(1_990_000n);
    expect(PRO_DURATION_DAYS).toBe(30);
  });

  it("includes PRO in SHOP_ITEMS with the 'pro' copy key so the shop sheet can render it next to founder/shield", () => {
    const pro = SHOP_ITEMS.find((i) => i.itemId === PRO_ITEM_ID);
    expect(pro).toBeDefined();
    expect(pro?.copyKey).toBe("pro");
  });
});

describe("SHOP_TILE_ASSETS path resolution", () => {
  const PUBLIC = join(findWebRoot(), "public");
  const FORMATS = [".avif", ".webp", ".png"] as const;
  const entries = Object.entries(SHOP_TILE_ASSETS);

  it("declares an icon basename for every ShopCopyKey", () => {
    const expectedKeys = ["pro", "founderBadge", "retryShield", "coachPack5", "coachPack20"];
    expect(entries.map(([key]) => key).sort()).toEqual(expectedKeys.sort());
  });

  it("uses extensionless basenames so the consumer can build image-set() per format", () => {
    for (const [, { icon }] of entries) {
      expect(icon).not.toMatch(/\.(png|webp|avif|jpg|jpeg|svg)$/i);
      expect(icon.startsWith("/art/")).toBe(true);
    }
  });

  for (const [copyKey, { icon }] of entries) {
    for (const ext of FORMATS) {
      it(`${copyKey} icon resolves to ${icon}${ext}`, () => {
        const full = join(PUBLIC, `${icon}${ext}`);
        expect(existsSync(full)).toBe(true);
      });
    }
  }
});
