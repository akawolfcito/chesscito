import { CheckCircle2, XCircle, CircleDashed, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatUnits } from "viem";
import { SHOP_SHEET_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";

type CatalogItem = {
  itemId: bigint;
  label: string;
  subtitle: string;
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
};

type ShopSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CatalogItem[];
  onSelectItem: (itemId: bigint) => void;
};

export function ShopSheet({ open, onOpenChange, items, onSelectItem }: ShopSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Shop"
          className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
        >
          <picture>
            <source srcSet="/art/shop-menu.webp" type="image/webp" />
            <img src="/art/shop-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
          </picture>
          <span className="sr-only">Shop</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell sheet-bg-shop rounded-t-3xl border-white/[0.10]">
        <div className="border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle className="fantasy-title flex items-center gap-2 text-slate-100"><ShoppingBag size={20} className="text-amber-400/60" />{SHOP_SHEET_COPY.title}</SheetTitle>
            <SheetDescription className="text-cyan-100/75">{SHOP_SHEET_COPY.description}</SheetDescription>
          </SheetHeader>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.length === 0 && (
            <p className="col-span-full text-center text-sm text-cyan-100/50">{SHOP_SHEET_COPY.empty}</p>
          )}
          {items.map((item, index) => {
            const isFeatured = index === 0 && item.configured && item.enabled;
            return (
            <div key={item.itemId.toString()} className={`rounded-2xl p-3 relative ${isFeatured ? "" : "border border-white/[0.05] bg-white/[0.02] opacity-75"}`} style={isFeatured ? { background: "linear-gradient(180deg, rgba(18,14,8,0.95) 0%, rgba(10,8,6,0.90) 100%)", border: "1.5px solid rgba(200,170,100,0.30)", boxShadow: "inset 0 1px 3px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 20px rgba(200,170,100,0.10), 0 4px 12px rgba(0,0,0,0.3)" } : undefined}>
              {isFeatured && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[rgba(220,200,140,0.85)]" style={{ background: "rgba(200,170,100,0.15)", border: "1px solid rgba(200,170,100,0.35)" }}>
                  Featured
                </span>
              )}
              <p className={`text-sm font-semibold ${isFeatured ? "text-[rgba(240,230,200,0.95)]" : "text-slate-300"}`}>{item.label}</p>
              <p className={`text-xs ${isFeatured ? "text-[rgba(180,160,120,0.60)]" : "text-slate-500"}`}>{item.subtitle}</p>
              <p className="mt-2 text-sm text-slate-200">
                {item.configured ? `${formatUnits(item.onChainPrice, 6)} USDC` : SHOP_SHEET_COPY.status.notConfigured}
              </p>
              <p className="flex items-center gap-1 text-xs">
                {item.configured && item.enabled ? (
                  <><CheckCircle2 className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">{SHOP_SHEET_COPY.status.available}</span></>
                ) : item.configured ? (
                  <><XCircle className="h-3 w-3 text-rose-400" /><span className="text-rose-400">{SHOP_SHEET_COPY.status.unavailable}</span></>
                ) : (
                  <><CircleDashed className="h-3 w-3 text-slate-500" /><span className="text-slate-500">{SHOP_SHEET_COPY.status.unavailable}</span></>
                )}
              </p>
              <Button
                type="button"
                variant="game-solid"
                size="game"
                className={`mt-3 ${isFeatured ? "shadow-[0_0_12px_rgba(245,158,11,0.15)]" : ""}`}
                disabled={!item.configured || !item.enabled}
                onClick={() => onSelectItem(item.itemId)}
              >
                {SHOP_SHEET_COPY.buyButton}
              </Button>
            </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
