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

/** Sibling itemId for the Founder Badge purchased with native CELO.
 *  The Shop contract has no per-token pricing — priceUsd6 is normalized
 *  by token decimals assuming a stablecoin peg, which would otherwise
 *  charge ~0.1 CELO (~$0.009) for a $0.10 badge. The helper itemId 5
 *  uses priceUsd6=1_000_000 ($1.00 nominal) so the same normalization
 *  rounds to ~1 CELO instead. UI groups itemId 5 under the same
 *  Founder Badge card; the user sees one product with two payment
 *  buttons (USDC / CELO).
 *
 *  Admin must call:
 *    ShopUpgradeable.setItem(5, 1_000_000, true)
 *    ShopUpgradeable.setAcceptedToken(CELO_TOKEN.address, true)
 *  before this row goes live. Until then `configured=false` and the
 *  CELO button stays hidden — same safe-default as itemId 2. */
export const FOUNDER_BADGE_CELO_ITEM_ID = 5n;

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
  // Helper entry for the CELO route. Hidden from the shop card list —
  // only its on-chain configured/enabled flags drive the visibility of
  // the "Buy with CELO" button rendered next to itemId 1.
  {
    itemId: FOUNDER_BADGE_CELO_ITEM_ID,
    label: SHOP_ITEM_COPY.founderBadge.label,
    subtitle: SHOP_ITEM_COPY.founderBadge.subtitle,
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

/** Chesscito PRO — first commercial SKU. Phase 0 monthly pass at
 *  $1.99 that unlocks unlimited Coach analyses (bypasses the
 *  coach:credits ledger). Sold via Shop.buyItem like coach packs.
 *  Verification at /api/verify-pro stores expiresAt at
 *  coach:pro:<wallet> with a 30-day TTL.
 *
 *  Intentionally NOT included in `SHOP_ITEMS` — PRO renders as its
 *  own stand-alone card in /play-hub instead of mixing into the
 *  founder/shield row.
 *
 *  Admin must call:
 *    ShopUpgradeable.setItem(6, 1_990_000, true)
 *  in Celo Mainnet with the admin wallet before the buy CTA in the
 *  PRO card becomes purchasable. Until then verify-pro will see no
 *  matching ItemPurchased event and the buy attempt will fail. */
export const PRO_ITEM_ID = 6n;
export const PRO_PRICE_USD6 = 1_990_000n; // $1.99
export const PRO_DURATION_DAYS = 30;
