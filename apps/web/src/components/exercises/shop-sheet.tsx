"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
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

/** Derives the kicker label for an item based on its label content.
 *  Badge = support item, Shield = training utility. */
function getKickerKey(label: string): "support" | "training" {
  if (label.toLowerCase().includes("badge")) return "support";
  return "training";
}

/** Derives the icon name for an item. */
function getIcon(label: string): "trophy" | "shield" {
  return label.toLowerCase().includes("badge") ? "trophy" : "shield";
}

/** Availability chip for an item. */
function AvailabilityChip({ configured, enabled }: { configured: boolean; enabled: boolean }) {
  const t = useTranslations("SHOP_SHEET_COPY");
  if (configured && enabled) {
    return (
      <CandyChip variant="success" tone="subtle">
        <CandyIcon name="check" className="mr-0.5 inline h-2.5 w-2.5" />
        {t("status.available")}
      </CandyChip>
    );
  }
  if (configured) {
    return (
      <CandyChip variant="danger" tone="subtle">
        {t("status.unavailable")}
      </CandyChip>
    );
  }
  return (
    <CandyChip variant="warm" tone="subtle">
      {t("status.notConfigured")}
    </CandyChip>
  );
}

/** Section header component for visual grouping. */
function ShopSectionHeader({ title }: { title: string }) {
  return (
    <div className="shop-section-header">
      <span className="shop-section-title">{title}</span>
      <div className="shop-section-line" />
    </div>
  );
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
  const kicker = t(`kicker.${getKickerKey(item.label)}` as const);
  const icon = getIcon(item.label);
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
    >
      {/* Tile top: icon + identity column */}
      <div className="shop-item-tile-content">
        {/* Large item icon */}
        <div className="shop-item-tile-icon-wrap">
          <CandyIcon name={icon} className="shop-item-tile-icon" />
        </div>

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

      {/* Footer: Meta + Buy button */}
      <div className="shop-item-tile-footer">
        <div className="flex items-center gap-2">
          <AvailabilityChip configured={item.configured} enabled={item.enabled} />
          {item.celoSibling && (
            <button
              type="button"
              onClick={() => onSelectItem(item.celoSibling!.itemId)}
              className="shop-item-tile-celo-link"
              aria-label={t("buyWithCelo")}
            >
              {t("payWithCeloShort")}
            </button>
          )}
        </div>

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
  // Grouping items by category (rough logic based on name)
  const supportItems = items.filter(i => i.label.toLowerCase().includes("badge"));
  const trainingItems = items.filter(i => !i.label.toLowerCase().includes("badge"));

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

        {/* Catalog */}
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 pb-6">
          {items.length === 0 && (
            <p
              className="text-center text-sm"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              {t("empty")}
            </p>
          )}

          {/* Support Section */}
          {supportItems.length > 0 && (
            <div className="flex flex-col gap-3">
              <ShopSectionHeader title={t("sections.support")} />
              {supportItems.map((item, index) => (
                <ShopItemCard
                  key={item.itemId.toString()}
                  item={item}
                  isFeatured={index === 0 && item.configured && item.enabled}
                  onSelectItem={onSelectItem}
                />
              ))}
            </div>
          )}

          {/* Training Section */}
          {trainingItems.length > 0 && (
            <div className="flex flex-col gap-3">
              <ShopSectionHeader title={t("sections.training")} />
              {trainingItems.map((item, index) => (
                <ShopItemCard
                  key={item.itemId.toString()}
                  item={item}
                  isFeatured={index === 0 && item.configured && item.enabled && supportItems.length === 0}
                  onSelectItem={onSelectItem}
                />
              ))}
            </div>
          )}

          {/* "More soon" ambient hint */}
          {items.length > 0 && items.length < 3 && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 opacity-80"
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.30)",
              }}
            >
              <CandyIcon name="shop" className="h-5 w-5 shrink-0 opacity-70" />
              <div className="flex flex-col">
                <p className="text-xs font-bold" style={{ color: "rgba(110, 65, 15, 0.85)" }}>
                  {t("moreSoonTitle")}
                </p>
                <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.60)" }}>
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
