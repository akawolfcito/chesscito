import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  FOUNDER_BADGE_CELO_ITEM_ID,
  FOUNDER_BADGE_ITEM_ID,
  PRO_DURATION_DAYS,
  PRO_ITEM_ID,
  PRO_PRICE_USD6,
  SHOP_ITEMS,
  SHOP_TILE_ASSETS,
} from "../shop-catalog";
import { resolveThemeAsset } from "@/lib/themes/resolve-theme-asset";

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
  it("publishes the founder badge as itemId 1n and the CELO sibling as 5n", () => {
    expect(FOUNDER_BADGE_ITEM_ID).toBe(1n);
    expect(FOUNDER_BADGE_CELO_ITEM_ID).toBe(5n);
  });

  it("exposes founder + PRO + CELO sibling in the catalog with copy keys for locale-aware resolution", () => {
    // PRO + Founder + CELO sibling.
    expect(SHOP_ITEMS).toHaveLength(3);
    for (const item of SHOP_ITEMS) {
      expect(item.copyKey.length).toBeGreaterThan(0);
    }
  });

  it("the CELO sibling reuses the Founder Badge copy key so the UI can group both routes under one product card", () => {
    const founder = SHOP_ITEMS.find((i) => i.itemId === FOUNDER_BADGE_ITEM_ID);
    const celoFounder = SHOP_ITEMS.find((i) => i.itemId === FOUNDER_BADGE_CELO_ITEM_ID);
    expect(founder?.copyKey).toBe(celoFounder?.copyKey);
  });

  it("publishes Chesscito PRO as itemId 6n at $1.99 (1_990_000 USD6) for a 30-day pass", () => {
    expect(PRO_ITEM_ID).toBe(6n);
    expect(PRO_PRICE_USD6).toBe(1_990_000n);
    expect(PRO_DURATION_DAYS).toBe(30);
  });

  it("includes PRO in SHOP_ITEMS with the 'pro' copy key so the shop sheet can render it next to founder", () => {
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
    const expectedKeys = ["pro", "founderBadge"];
    expect(entries.map(([key]) => key).sort()).toEqual(expectedKeys.sort());
  });

  it("uses extensionless basenames so the consumer can build image-set() per format", () => {
    for (const [, { icon, iconSlot }] of entries) {
      const basename = icon ?? (iconSlot ? resolveThemeAsset(iconSlot, "default") : null);
      expect(basename).toBeTruthy();
      expect(basename).not.toMatch(/\.(png|webp|avif|jpg|jpeg|svg)$/i);
      expect(basename?.startsWith("/art/")).toBe(true);
    }
  });

  for (const [copyKey, { icon, iconSlot }] of entries) {
    const basename = icon ?? (iconSlot ? resolveThemeAsset(iconSlot, "default") : null);
    for (const ext of FORMATS) {
      it(`${copyKey} icon resolves to ${basename}${ext}`, () => {
        const full = join(PUBLIC, `${basename}${ext}`);
        expect(existsSync(full)).toBe(true);
      });
    }
  }
});
