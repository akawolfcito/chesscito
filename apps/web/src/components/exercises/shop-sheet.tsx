"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import {
  FOUNDER_BADGE_ITEM_ID,
  PRO_ITEM_ID,
  SHIELD_ITEM_ID,
  SHOP_TILE_ASSETS,
  type ShopCopyKey,
} from "@/lib/contracts/shop-catalog";
import { formatUsd } from "@/lib/contracts/tokens";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";

type CatalogItem = {
  itemId: bigint;
  label: string;
  subtitle: string;
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
  /** Optional companion payment route. When present, the card renders
   *  an extra button below the primary stablecoin buy CTA so the user
   *  can pay the same product with CELO instead. Today this only
   *  fires for the Founder Badge (itemId 1 ↔ 5) when running outside
   *  MiniPay. */
  celoSibling?: { itemId: bigint } | null;
};

type ShopSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CatalogItem[];
  onSelectItem: (itemId: bigint) => void;
  /** Optional success banner — renders above the catalog when set. The
   *  scaffold supplies this after `buyItem` confirms so the user gets a
   *  celebration moment without a global ResultOverlay (legacy uses the
   *  overlay for the same purpose, so it omits this prop). */
  successBanner?: { itemLabel: string; txHashShort: string } | null;
  /** Render the built-in dock-style `<SheetTrigger>`. Default `true`
   *  for legacy compatibility — the scaffold passes `false` so Radix
   *  doesn't leave an orphan `<button>` rendered in the layout tree. */
  showTrigger?: boolean;
};

/** Map an on-chain itemId to its copy key. Drives both the kicker
 *  copy lookup and the tile art lookup in `SHOP_TILE_ASSETS`. New
 *  tiles MUST be added here + in `SHOP_TILE_ASSETS` for art to
 *  resolve. Defaults to "retryShield" so unknown ids fall back to a
 *  safe visual rather than crashing. */
function copyKeyForItem(itemId: bigint): ShopCopyKey {
  if (itemId === PRO_ITEM_ID) return "pro";
  if (itemId === FOUNDER_BADGE_ITEM_ID) return "founderBadge";
  if (itemId === SHIELD_ITEM_ID) return "retryShield";
  return "retryShield";
}

/** Build a CSS `image-set()` resolving to the AVIF/WebP/PNG triplet
 *  for a basename like `/art/shop/pro` (no extension). Browsers pick
 *  the first format they support; PNG is the fallback. */
function tileBgImageSet(basename: string): string {
  return `image-set(url("${basename}.avif") type("image/avif"), url("${basename}.webp") type("image/webp"), url("${basename}.png") type("image/png"))`;
}

/** Compact shop item card — premium game-shop tile. */
function ShopItemCard({
  item,
  isFeatured,
  onSelectItem,
}: {
  item: CatalogItem;
  isFeatured: boolean;
  onSelectItem: (itemId: bigint) => void;
}) {
  const t = useTranslations("SHOP_SHEET_COPY");
  const copyKey = copyKeyForItem(item.itemId);
  const kickerKey = copyKey === "founderBadge" ? "support" : "training";
  const kicker = t(`kicker.${kickerKey}` as const);
  const assets = SHOP_TILE_ASSETS[copyKey];
  const priceLabel = item.configured
    ? formatUsd(item.onChainPrice)
    : t("status.notConfigured");

  const buyLabel = !item.configured
    ? t("buyButtonComingSoon")
    : !item.enabled
      ? t("buyButtonUnavailable")
      : priceLabel; // Show price on the button for better conversion feel

  return (
    <div
      className={[
        "shop-item-tile",
        isFeatured ? "shop-item-tile--featured" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundImage: tileBgImageSet(assets.bg),
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
      data-copy-key={copyKey}
    >
      {/* Tile top: icon + identity column. The icon is rendered
       *  full-bleed (no chrome wrap) so the bespoke art reads at
       *  card scale. The container reserves a fixed slot so the
       *  identity column doesn't reflow when art aspect ratios
       *  differ between PRO / Founder / Shield. */}
      <div className="shop-item-tile-content">
        <picture className="shop-item-tile-icon-figure">
          <source srcSet={`${assets.icon}.avif`} type="image/avif" />
          <source srcSet={`${assets.icon}.webp`} type="image/webp" />
          <img
            src={`${assets.icon}.png`}
            alt=""
            aria-hidden="true"
            className="shop-item-tile-icon-img"
            draggable={false}
          />
        </picture>

        {/* Name + kicker + short copy */}
        <div className="shop-item-tile-identity">
          <div className="flex items-center justify-between">
            <p className="shop-item-tile-kicker">{kicker}</p>
            {isFeatured && <span className="shop-item-tile-featured-label">{t("featured")}</span>}
          </div>
          <p className="shop-item-tile-name">{item.label}</p>
          <p className="shop-item-tile-subtitle">{item.subtitle}</p>
        </div>
      </div>

      {/* Footer — right-aligned button stack. Optional CELO twin sits
       *  to the left of the primary buy button; both share the same
       *  PrincipalButton shape so the user reads them as siblings
       *  rather than a button + link. */}
      <div className="shop-item-tile-footer">
        {item.celoSibling && (
          <button
            type="button"
            className="candy-tray-pill shop-item-tile-celo-pill"
            onClick={() => onSelectItem(item.celoSibling!.itemId)}
            aria-label={t("buyWithCelo")}
          >
            {t("payWithCeloShort")}
          </button>
        )}
        <PrincipalButton
          size="medium"
          className="shop-item-tile-buy-btn"
          disabled={!item.configured || !item.enabled}
          onClick={() => onSelectItem(item.itemId)}
          aria-label={t("buyButtonAriaFormat", { action: t("buyButton"), item: item.label, price: priceLabel })}
        >
          {buyLabel}
        </PrincipalButton>
      </div>
    </div>
  );
}

export function ShopSheet({
  open,
  onOpenChange,
  items,
  onSelectItem,
  successBanner = null,
  showTrigger = true,
}: ShopSheetProps) {
  const t = useTranslations("SHOP_SHEET_COPY");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={t("ariaLabel")}
            className="relative flex shrink-0 items-center justify-center"
          >
            <img
              src="/art/shop-menu.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
            />
            <span className="sr-only">{t("ariaLabel")}</span>
          </button>
        </SheetTrigger>
      ) : null}
      <SheetContent
        side="bottom"
        hideClose
        title={t("title")}
        description={t("description")}
        className="mission-shell sheet-bg-shop flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        {/* Sheet header — canary adopter of <ContextualHeader close-control>.
         *  Replaces the legacy `-mx-6 -mt-6 px-6 pb-5 pt-…` recipe + the
         *  floating absolute close from sheet.tsx. See
         *  docs/reviews/2026-05-20-header-consistency-audit.md §3. */}
        <div
          className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]"
        >
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/shop-menu" />}
            title={t("title")}
            subtitle={t("description")}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        {/* Success banner */}
        {successBanner ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-2xl px-4 py-3"
            role="status"
            style={{
              background: "rgba(16, 185, 129, 0.18)",
              boxShadow: "inset 0 0 0 1px rgba(16, 185, 129, 0.45)",
            }}
          >
            <CandyIcon name="check" className="h-5 w-5 shrink-0" />
            <div className="flex flex-col">
              <p
                className="text-sm font-extrabold"
                style={{ color: "rgba(6, 78, 59, 0.95)" }}
              >
                {t("successBannerFormat", { item: successBanner.itemLabel })}
              </p>
              <p
                className="font-mono text-xs"
                style={{ color: "rgba(6, 78, 59, 0.70)" }}
              >
                {t("successBannerTxFormat", { hash: successBanner.txHashShort })}
              </p>
            </div>
          </div>
        ) : null}

        {/* Catalog — flat list rendered in SHOP_ITEMS order
         *  (PRO → Founder → Shield). Section grouping removed: the
         *  per-tile bg textures + bespoke art provide enough visual
         *  separation that the SUPPORT/TRAINING headers no longer earn
         *  their vertical real-estate. Founder Badge keeps the
         *  "Featured" ribbon since it's the canonical featured SKU. */}
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-6">
          {items.length === 0 && (
            <p
              className="text-center text-sm"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              {t("empty")}
            </p>
          )}

          {items.map((item) => (
            <ShopItemCard
              key={item.itemId.toString()}
              item={item}
              isFeatured={
                item.itemId === FOUNDER_BADGE_ITEM_ID &&
                item.configured &&
                item.enabled
              }
              onSelectItem={onSelectItem}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
