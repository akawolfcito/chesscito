import { CheckCircle2, XCircle, CircleDashed } from "lucide-react";
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
      <SheetContent side="bottom" className="mission-shell sheet-bg-shop rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">{SHOP_SHEET_COPY.title}</SheetTitle>
          <SheetDescription className="text-cyan-100/75">{SHOP_SHEET_COPY.description}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.length === 0 && (
            <p className="col-span-full text-center text-sm text-cyan-100/50">{SHOP_SHEET_COPY.empty}</p>
          )}
          {items.map((item) => (
            <div key={item.itemId.toString()} className="mission-soft rune-frame shop-slot-frame rounded-2xl p-3">
              <p className="text-sm font-semibold text-slate-100">{item.label}</p>
              <p className="text-xs text-slate-400">{item.subtitle}</p>
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
                className="mt-3"
                disabled={!item.configured || !item.enabled}
                onClick={() => onSelectItem(item.itemId)}
              >
                {SHOP_SHEET_COPY.buyButton}
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
