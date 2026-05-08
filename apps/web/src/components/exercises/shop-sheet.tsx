import { CandyIcon } from "@/components/redesign/candy-icon";
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
import { Button } from "@/components/ui/button";

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
        {/* `flex-1 min-h-0 overflow-y-auto` so the catalog grid scrolls
            inside the sheet on mobile when items + "More soon" promo
            exceed the visible 100dvh. Without it, the legacy persistent
            dock at the bottom (~80px) clipped the last card and the
            user reported "content cut off below". The `pb-[5rem]` on
            the sheet shell still reserves the dock-clearance gutter. */}
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
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.length === 0 && (
            <p
              className="col-span-full text-center text-sm"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              {SHOP_SHEET_COPY.empty}
            </p>
          )}
          {items.map((item, index) => {
            const isFeatured = index === 0 && item.configured && item.enabled;
            return (
            <div
              key={item.itemId.toString()}
              className={[
                "relative rounded-2xl border p-3",
                isFeatured
                  ? "border-amber-400/70 bg-white/20 shadow-[0_0_0_2px_rgba(251,191,36,0.28)]"
                  : "border-[rgba(255,255,255,0.45)] bg-white/15",
              ].join(" ")}
            >
              {isFeatured && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-widest"
                  style={{
                    background: "rgba(120, 65, 5, 0.90)",
                    color: "rgba(255, 240, 180, 0.98)",
                    border: "1px solid rgba(255, 240, 180, 0.70)",
                  }}
                >
                  {SHOP_SHEET_COPY.featured}
                </span>
              )}
              <p
                className="flex items-center gap-1.5 text-sm font-extrabold"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                }}
              >
                {item.label.toLowerCase().includes("badge") ? (
                  <CandyIcon name="trophy" className="h-4 w-4 shrink-0 opacity-90" />
                ) : (
                  <CandyIcon name="shield" className="h-4 w-4 shrink-0 opacity-90" />
                )}
                {item.label}
              </p>
              <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
                {item.subtitle}
              </p>
              <p
                className="mt-2 text-sm font-extrabold"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                {item.configured ? formatUsd(item.onChainPrice) : SHOP_SHEET_COPY.status.notConfigured}
              </p>
              <p className="flex items-center gap-1 text-xs font-semibold">
                {item.configured && item.enabled ? (
                  <>
                    <CandyIcon name="check" className="h-3 w-3" />
                    <span className="text-emerald-700">{SHOP_SHEET_COPY.status.available}</span>
                  </>
                ) : item.configured ? (
                  <>
                    <CandyIcon name="close" className="h-3 w-3" />
                    <span style={{ color: "rgba(159, 18, 57, 0.95)" }}>
                      {SHOP_SHEET_COPY.status.unavailable}
                    </span>
                  </>
                ) : (
                  <>
                    <CandyIcon name="loading" className="h-3 w-3 opacity-70" />
                    <span style={{ color: "rgba(110, 65, 15, 0.65)" }}>
                      {SHOP_SHEET_COPY.status.unavailable}
                    </span>
                  </>
                )}
              </p>
              <Button
                type="button"
                variant="game-solid"
                size="game"
                className="mt-3"
                disabled={!item.configured || !item.enabled}
                onClick={() => onSelectItem(item.itemId)}
              >
                {!item.configured
                  ? SHOP_SHEET_COPY.buyButtonComingSoon
                  : !item.enabled
                    ? SHOP_SHEET_COPY.buyButtonUnavailable
                    : SHOP_SHEET_COPY.buyButton}
              </Button>
              {item.celoSibling ? (
                <Button
                  type="button"
                  variant="game-ghost"
                  size="game"
                  className="mt-2"
                  onClick={() => onSelectItem(item.celoSibling!.itemId)}
                >
                  {SHOP_SHEET_COPY.buyWithCelo}
                </Button>
              ) : null}
            </div>
            );
          })}
          {items.length > 0 && items.length < 3 && (
            <div
              className="col-span-full mt-1 flex items-center gap-3 rounded-2xl px-4 py-3"
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
