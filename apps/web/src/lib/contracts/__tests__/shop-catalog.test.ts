import { describe, it, expect } from "vitest";
import {
  FOUNDER_BADGE_ITEM_ID,
  SHIELDS_PER_PURCHASE,
  SHIELD_ITEM_ID,
  SHOP_ITEMS,
} from "../shop-catalog";

describe("shop-catalog", () => {
  it("publishes the founder badge as itemId 1n and the retry shield as itemId 2n", () => {
    expect(FOUNDER_BADGE_ITEM_ID).toBe(1n);
    expect(SHIELD_ITEM_ID).toBe(2n);
  });

  it("exposes both items in the catalog with non-empty copy", () => {
    expect(SHOP_ITEMS).toHaveLength(2);
    for (const item of SHOP_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.subtitle.length).toBeGreaterThan(0);
    }
  });

  it("ships the shield row with the documented item id so the admin tx setItem(2,...) wires it up", () => {
    const shield = SHOP_ITEMS.find((item) => item.itemId === SHIELD_ITEM_ID);
    expect(shield).toBeDefined();
    expect(shield?.label).toMatch(/shield/i);
  });

  it("credits 3 shield uses per purchase to match the SHIELD_COPY.buyLabel '(3 uses)' promise", () => {
    expect(SHIELDS_PER_PURCHASE).toBe(3);
  });
});
