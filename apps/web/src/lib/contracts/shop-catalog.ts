import { SHOP_ITEM_COPY } from "@/lib/content/editorial";

/** Shop item id reserved on-chain for the Retry Shield. Each purchase
 *  credits 3 uses to localStorage via the pendingShieldCredit effect.
 *  Admin must call ShopUpgradeable.setItem(2, 25000, true) before the
 *  catalog row becomes purchasable; until then `configured=false` and
 *  the buy button stays disabled with the standard "Not configured"
 *  status — no crash, no silent failure. */
export const SHIELD_ITEM_ID = 2n;

/** Founder Badge id — kept here so anything that needs to special-case
 *  the badge by id can do so without re-deriving it. */
export const FOUNDER_BADGE_ITEM_ID = 1n;

export type ShopCatalogEntry = {
  itemId: bigint;
  label: string;
  subtitle: string;
};

export const SHOP_ITEMS: readonly ShopCatalogEntry[] = [
  {
    itemId: FOUNDER_BADGE_ITEM_ID,
    label: SHOP_ITEM_COPY.founderBadge.label,
    subtitle: SHOP_ITEM_COPY.founderBadge.subtitle,
  },
  {
    itemId: SHIELD_ITEM_ID,
    label: SHOP_ITEM_COPY.retryShield.label,
    subtitle: SHOP_ITEM_COPY.retryShield.subtitle,
  },
] as const;

/** Number of shield uses credited to localStorage per successful
 *  on-chain purchase of itemId=2. Mirrored in the receipt effect at
 *  play-hub-root.tsx and the SHIELD_COPY.buyLabel ("Buy (3 uses)"). */
export const SHIELDS_PER_PURCHASE = 3;

/** Coach credit packs sold via Shop.buyItem. Each entry maps the
 *  user-facing pack size (5 or 20 credits) to the on-chain itemId and
 *  USD6-denominated price. /api/coach/verify-purchase reads the
 *  ItemPurchased event topic and credits the wallet's
 *  coach:credits:<addr> Redis key with the matching pack size. */
export type CoachPackSize = 5 | 20;

export const COACH_PACK_ITEMS: Record<CoachPackSize, { itemId: bigint; priceUsd6: bigint }> = {
  5: { itemId: 3n, priceUsd6: 50_000n },   // $0.05
  20: { itemId: 4n, priceUsd6: 100_000n }, // $0.10
} as const;
