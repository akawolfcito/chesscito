import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SHOP_SHEET_COPY } from "@/lib/content/editorial";
import { formatUsd } from "@/lib/contracts/tokens";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { GemButton } from "@/components/scene-rooted/gem";

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
function getKicker(label: string): string {
  if (label.toLowerCase().includes("badge")) return SHOP_SHEET_COPY.kicker.support;
  return SHOP_SHEET_COPY.kicker.training;
}

/** Derives the icon name for an item. */
function getIcon(label: string): "trophy" | "shield" {
  return label.toLowerCase().includes("badge") ? "trophy" : "shield";
}

/** Availability chip for an item. */
function AvailabilityChip({ configured, enabled }: { configured: boolean; enabled: boolean }) {
  if (configured && enabled) {
    return (
      <CandyChip variant="success" tone="subtle">
        <CandyIcon name="check" className="mr-0.5 inline h-2.5 w-2.5" />
        {SHOP_SHEET_COPY.status.available}
      </CandyChip>
    );
  }
  if (configured) {
    return (
      <CandyChip variant="danger" tone="subtle">
        {SHOP_SHEET_COPY.status.unavailable}
      </CandyChip>
    );
  }
  return (
    <CandyChip variant="warm" tone="subtle">
      {SHOP_SHEET_COPY.status.notConfigured}
    </CandyChip>
  );
}

/** Individual shop item card — game-native visual first layout. */
function ShopItemCard({
  item,
  isFeatured,
  onSelectItem,
}: {
  item: CatalogItem;
  isFeatured: boolean;
  onSelectItem: (itemId: bigint) => void;
}) {
  const kicker = getKicker(item.label);
  const icon = getIcon(item.label);
  const priceLabel = item.configured
    ? formatUsd(item.onChainPrice)
    : SHOP_SHEET_COPY.status.notConfigured;

  const buyLabel = !item.configured
    ? SHOP_SHEET_COPY.buyButtonComingSoon
    : !item.enabled
      ? SHOP_SHEET_COPY.buyButtonUnavailable
      : SHOP_SHEET_COPY.buyButton;

  return (
    <div
      className={[
        "shop-item-card",
        isFeatured ? "shop-item-card--featured" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Featured badge */}
      {isFeatured && (
        <span className="shop-item-card-featured-badge">
          {SHOP_SHEET_COPY.featured}
        </span>
      )}

      {/* Card top: icon + identity */}
      <div className="shop-item-card-top">
        {/* Large item icon */}
        <div className="shop-item-card-icon-wrap">
          <CandyIcon name={icon} className="shop-item-card-icon" />
        </div>

        {/* Name + kicker + availability + price row */}
        <div className="shop-item-card-identity">
          <p className="shop-item-card-kicker">{kicker}</p>
          <p className="shop-item-card-name">{item.label}</p>
          <div className="shop-item-card-meta-row">
            <span className="shop-item-card-price">{priceLabel}</span>
            <AvailabilityChip configured={item.configured} enabled={item.enabled} />
          </div>
        </div>
      </div>

      {/* Short value line */}
      <p className="shop-item-card-subtitle">{item.subtitle}</p>

      {/* Primary buy CTA */}
      <PrincipalButton
        size="medium"
        className="mt-3 w-full"
        disabled={!item.configured || !item.enabled}
        onClick={() => onSelectItem(item.itemId)}
        aria-label={!item.configured
          ? SHOP_SHEET_COPY.buyButtonComingSoon
          : !item.enabled
            ? SHOP_SHEET_COPY.buyButtonUnavailable
            : SHOP_SHEET_COPY.buyButton}
      >
        {buyLabel}
      </PrincipalButton>

      {/* CELO alternative — visually secondary, only if available */}
      {item.celoSibling ? (
        <div className="shop-item-card-celo-row">
          <GemButton
            icon={<CandyIcon name="wallet" className="h-3 w-3" />}
            value={SHOP_SHEET_COPY.buyWithCelo}
            onClick={() => onSelectItem(item.celoSibling!.itemId)}
            aria-label={SHOP_SHEET_COPY.buyWithCelo}
          />
        </div>
      ) : null}
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Shop"
            className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
          >
            <img
              src="/art/shop-menu.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
            />
            <span className="sr-only">Shop</span>
          </button>
        </SheetTrigger>
      ) : null}
      <SheetContent side="bottom" className="mission-shell sheet-bg-shop flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]">
        {/* Sheet header */}
        <div className="shrink-0 border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-none px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title flex items-center gap-2"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              <CandyIcon name="shop" className="h-5 w-5" />
              {SHOP_SHEET_COPY.title}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {SHOP_SHEET_COPY.description}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* `flex-1 min-h-0 overflow-y-auto` so the catalog scrolls
            inside the sheet on mobile. `pb-[5rem]` on the shell
            reserves the dock-clearance gutter. */}

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
                {successBanner.itemLabel} secured!
              </p>
              <p
                className="font-mono text-xs"
                style={{ color: "rgba(6, 78, 59, 0.70)" }}
              >
                tx {successBanner.txHashShort}
              </p>
            </div>
          </div>
        ) : null}

        {/* Catalog */}
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
          {items.length === 0 && (
            <p
              className="text-center text-sm"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              {SHOP_SHEET_COPY.empty}
            </p>
          )}

          {items.map((item, index) => {
            const isFeatured = index === 0 && item.configured && item.enabled;
            return (
              <ShopItemCard
                key={item.itemId.toString()}
                item={item}
                isFeatured={isFeatured}
                onSelectItem={onSelectItem}
              />
            );
          })}

          {/* "More soon" ambient hint — only when catalog has fewer than 3 items */}
          {items.length > 0 && items.length < 3 && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(245, 158, 11, 0.22)",
                boxShadow: "inset 0 0 0 1px rgba(245, 158, 11, 0.45)",
              }}
            >
              <CandyIcon name="shop" className="h-6 w-6 shrink-0 opacity-85" />
              <div className="flex flex-col">
                <p
                  className="text-sm font-extrabold"
                  style={{
                    color: "rgba(120, 65, 5, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                  }}
                >
                  {SHOP_SHEET_COPY.moreSoonTitle}
                </p>
                <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
                  {SHOP_SHEET_COPY.moreSoonHint}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
