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
  if (itemId === 3n) return "coachPack5";
  if (itemId === 4n) return "coachPack20";
  return "retryShield";
}

/** Map a shop card's `copyKey` to a tone slug that drives the
 *  `data-tone` attribute on `.shop-item-tile`. The tile CSS reads
 *  the attribute to swap its `--shop-tile-accent-*` custom
 *  properties (gradient base + mid + border) per-card. Centralized
 *  here so a new SKU only needs one entry to inherit the panel
 *  treatment from Badges/Trophies/Leaderboard with its own accent. */
type ShopTileTone = "purple" | "orange" | "blue";

function toneForCopyKey(copyKey: ShopCopyKey): ShopTileTone {
  switch (copyKey) {
    case "pro":
    case "coachPack20":
      return "purple";
    case "founderBadge":
      return "orange";
    case "retryShield":
    case "coachPack5":
      return "blue";
  }
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
      data-copy-key={copyKey}
      data-tone={toneForCopyKey(copyKey)}
    >
      {/* 2-column grid: icon spans both rows on the left (vertically
       *  centered + free to overflow the tile bounds via grid +
       *  overflow:visible on the picture). Text identity sits on the
       *  right row 1, footer pills on row 2 right. The bespoke art
       *  reads at card scale without leaving empty space below it. */}
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

      {/* Featured ribbon — absolute-positioned over the top-right
       *  corner of the tile so it reads as an honest badge instead
       *  of a meta-label fighting the kicker hierarchy. Only the
       *  designated SKU gets one. */}
      {isFeatured && (
        <span className="shop-item-tile-featured-ribbon" aria-hidden="true">
          ★ {t("featured")}
        </span>
      )}

      {/* Identity — name + subtitle. Kicker dropped: the bg color,
       *  bespoke art, and name already disambiguate each SKU; an
       *  extra "TRAINING ITEM" / "SUPPORT CHESSCITO" line above
       *  was redundant meta-noise that diluted the visual
       *  hierarchy in a 390px viewport. */}
      <div className="shop-item-tile-identity">
        <p className="shop-item-tile-name">{item.label}</p>
        <p className="shop-item-tile-subtitle">{item.subtitle}</p>
      </div>

      {/* Footer — right-aligned button stack. Both the CELO twin and
       *  the primary buy CTA share the `.candy-tray-pill` HUD chip
       *  family (same shape as the Hub Connect / trophy chips). The
       *  `--green` / `--yellow` modifiers tint them so the user can
       *  scan the row as "yellow = CELO route, green = USD route"
       *  without leaving the candy vocabulary. */}
      <div className="shop-item-tile-footer">
        {item.celoSibling && (
          <button
            type="button"
            className="candy-tray-pill shop-item-tile-buy-pill shop-item-tile-buy-pill--yellow"
            onClick={() => onSelectItem(item.celoSibling!.itemId)}
            aria-label={t("buyWithCelo")}
          >
            {t("payWithCeloShort")}
          </button>
        )}
        <button
          type="button"
          className="candy-tray-pill shop-item-tile-buy-pill shop-item-tile-buy-pill--green"
          disabled={!item.configured || !item.enabled}
          onClick={() => onSelectItem(item.itemId)}
          aria-label={t("buyButtonAriaFormat", { action: t("buyButton"), item: item.label, price: priceLabel })}
        >
          {buyLabel}
        </button>
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
         *  "Featured" ribbon since it's the canonical featured SKU.
         *
         *  Cards stay symmetric within the sheet padding — the
         *  bespoke icon overhang escapes left via the parent
         *  `.sheet-bg-shop` opening up `overflow-x: visible`
         *  (overriding the shared `.mission-shell` clip), not via
         *  asymmetric catalog padding. */}
        {/* 2026-05-30 (shop icon overhang fix): bleed horizontally
         *  with `-mx-6 px-6` so the scroll container's clip box (which
         *  per CSS spec collapses overflow-x to auto when overflow-y
         *  is auto) extends past the card edges. Without this the
         *  card icons' `left: -24px` overhang was being clipped by
         *  the scroll div even though `.sheet-bg-shop` was set up to
         *  allow it. Cards re-pad inward via `px-6` so layout looks
         *  identical — the only difference is icons can now visibly
         *  float past the card's left edge. */}
        <div className="mt-4 -mx-6 px-6 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-6">
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

          {/* Ghost "more coming" placeholder — closes the visual gap
           *  between the last live tile and the bottom of the sheet
           *  with INTENT instead of accidental whitespace. Dashed
           *  outline + muted tones telegraph "in development, not
           *  yet available", so users read it as a roadmap promise
           *  rather than a broken/disabled SKU. Renders only when
           *  the live catalog has at least one item (no point
           *  promising more if nothing is configured). */}
          {items.length > 0 && (
            <div
              className="shop-item-tile-coming"
              role="presentation"
              aria-hidden="true"
            >
              <span className="shop-item-tile-coming-glyph">✦</span>
              <div className="shop-item-tile-coming-text">
                <p className="shop-item-tile-coming-title">
                  {t("moreSoonTitle")}
                </p>
                <p className="shop-item-tile-coming-hint">
                  {t("moreSoonHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
