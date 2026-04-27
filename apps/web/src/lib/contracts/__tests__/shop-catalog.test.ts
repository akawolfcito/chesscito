import { describe, it, expect } from "vitest";
import {
  COACH_PACK_ITEMS,
  FOUNDER_BADGE_CELO_ITEM_ID,
  FOUNDER_BADGE_ITEM_ID,
  SHIELDS_PER_PURCHASE,
  SHIELD_ITEM_ID,
  SHOP_ITEMS,
} from "../shop-catalog";

describe("shop-catalog", () => {
  it("publishes the founder badge as itemId 1n, the retry shield as 2n, and the CELO sibling as 5n", () => {
    expect(FOUNDER_BADGE_ITEM_ID).toBe(1n);
    expect(SHIELD_ITEM_ID).toBe(2n);
    expect(FOUNDER_BADGE_CELO_ITEM_ID).toBe(5n);
  });

  it("exposes all three items in the catalog with non-empty copy", () => {
    expect(SHOP_ITEMS).toHaveLength(3);
    for (const item of SHOP_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.subtitle.length).toBeGreaterThan(0);
    }
  });

  it("the CELO sibling reuses the Founder Badge label so the UI can group both routes under one product card", () => {
    const founder = SHOP_ITEMS.find((i) => i.itemId === FOUNDER_BADGE_ITEM_ID);
    const celoFounder = SHOP_ITEMS.find((i) => i.itemId === FOUNDER_BADGE_CELO_ITEM_ID);
    expect(founder?.label).toBe(celoFounder?.label);
  });

  it("ships the shield row with the documented item id so the admin tx setItem(2,...) wires it up", () => {
    const shield = SHOP_ITEMS.find((item) => item.itemId === SHIELD_ITEM_ID);
    expect(shield).toBeDefined();
    expect(shield?.label).toMatch(/shield/i);
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
});
