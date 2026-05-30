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

/** Chesscito PRO — first commercial SKU. Phase 0 monthly pass at
 *  $1.99 that unlocks unlimited Coach analyses (bypasses the
 *  coach:credits ledger). Sold via Shop.buyItem like coach packs.
 *  Verification at /api/verify-pro stores expiresAt at
 *  coach:pro:<wallet> with a 30-day TTL.
 *
 *  Surfaced inside `SHOP_ITEMS` so the shop sheet renders a PRO row
 *  next to founder/shield. The standalone `<ProSheet>` card in /hub
 *  continues to exist as the hero discoverability surface — both
 *  routes hit the same on-chain item, so a PRO bought from the shop
 *  sheet is the same SKU as one bought from the PRO sheet.
 *
 *  Admin must call:
 *    ShopUpgradeable.setItem(6, 1_990_000, true)
 *  in Celo Mainnet with the admin wallet before the buy CTA becomes
 *  purchasable. Until then verify-pro will see no matching
 *  ItemPurchased event and the buy attempt will fail. */
export const PRO_ITEM_ID = 6n;
export const PRO_PRICE_USD6 = 1_990_000n; // $1.99
export const PRO_DURATION_DAYS = 30;

/** Locale-agnostic key into `SHOP_ITEM_COPY` for resolving a row's
 *  label / subtitle copy at render time. Callers thread the active
 *  `useTranslations("SHOP_ITEM_COPY")` translator and resolve
 *  `${copyKey}.label` / `${copyKey}.subtitle` locally. */
export type ShopCopyKey =
  | "founderBadge"
  | "retryShield"
  | "pro"
  | "coachPack5"
  | "coachPack20";

export type ShopCatalogEntry = {
  itemId: bigint;
  copyKey: ShopCopyKey;
};

export const SHOP_ITEMS: readonly ShopCatalogEntry[] = [
  // Chesscito PRO leads the catalog as the premium subscription tile.
  // `useShopSheetState` branches on this itemId to await the on-chain
  // receipt and POST `/api/verify-pro` (parallel to the SHIELD_ITEM_ID
  // /api/credit-shield branch). The standalone `<ProSheet>` card in
  // /hub is the hero discoverability surface; both routes hit the
  // same on-chain item.
  { itemId: PRO_ITEM_ID, copyKey: "pro" },
  { itemId: FOUNDER_BADGE_ITEM_ID, copyKey: "founderBadge" },
  { itemId: SHIELD_ITEM_ID, copyKey: "retryShield" },
  // Coach packs (A2 cluster). itemIds 3n + 4n already configured
  // on-chain — the existing CoachPaywall surface buys them today via
  // `arena/page.tsx:handleBuyCredits`. Mounting them here exposes the
  // packs as regular shop tiles so users can discover Coach without
  // hitting a paywall first. Verified by /api/coach/verify-purchase
  // post-receipt (mirrors the PRO_ITEM_ID branch in
  // `useShopSheetState`). Hardcoded ids — `COACH_PACK_ITEMS` declared
  // after SHOP_ITEMS, so referencing it here would TDZ.
  { itemId: 3n, copyKey: "coachPack5" },
  { itemId: 4n, copyKey: "coachPack20" },
  // Helper entry for the CELO route. Hidden from the shop card list —
  // only its on-chain configured/enabled flags drive the visibility of
  // the "Buy with CELO" button rendered next to founder.
  { itemId: FOUNDER_BADGE_CELO_ITEM_ID, copyKey: "founderBadge" },
] as const;

/** Per-tile art lookup for the shop sheet. Each entry pairs a copy
 *  key with its foreground icon (the figure rendered on the left
 *  side of the tile). Tile backgrounds are painted by the vitrine
 *  candy-pill family in CSS — no image asset needed. The CELO
 *  sibling shares the founder mapping since both surface the
 *  founder badge.
 *
 *  Asset basenames (no extension) so the consumer can build the
 *  `image-set()` URL list per format. New tiles MUST ship the
 *  triplet (`scripts/optimize-art-assets.sh` / cwebp / avifenc) —
 *  the `image-three-formats` memory rule. */
export const SHOP_TILE_ASSETS: Record<ShopCopyKey, { icon: string }> = {
  pro: { icon: "/art/shop/pro" },
  founderBadge: { icon: "/art/shop/founder" },
  retryShield: { icon: "/art/shop/shield" },
  // Placeholder assets (A2 cluster). Reuses Luz icon from
  // /art/redesign/icons. Replace with bespoke
  // /art/shop/coach-pack-{5,20}.* triplets when Sally's
  // visual-polish foundation (A4) lands.
  coachPack5: { icon: "/art/redesign/icons/coach" },
  coachPack20: { icon: "/art/redesign/icons/coach" },
};

/** Number of shield uses credited to localStorage per successful
 *  on-chain purchase of itemId=2. Mirrored in the receipt effect at
 *  exercises-screen.tsx and the SHIELD_COPY.buyLabel ("Buy (3 uses)"). */
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
