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
  | "pro";

export type ShopCatalogEntry = {
  itemId: bigint;
  copyKey: ShopCopyKey;
};

export const SHOP_ITEMS: readonly ShopCatalogEntry[] = [
  // Chesscito PRO leads the catalog as the premium subscription tile.
  // `useShopSheetState` branches on this itemId to await the on-chain
  // receipt and POST `/api/verify-pro`. The standalone `<ProSheet>`
  // card in /hub is the hero discoverability surface; both routes hit
  // the same on-chain item.
  { itemId: PRO_ITEM_ID, copyKey: "pro" },
  { itemId: FOUNDER_BADGE_ITEM_ID, copyKey: "founderBadge" },
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
export const SHOP_TILE_ASSETS: Record<ShopCopyKey, { icon?: string; iconSlot?: ThemeAssetKey }> = {
  pro: { icon: "/art/shop/pro" },
  founderBadge: { iconSlot: "account.founder" },
};
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
