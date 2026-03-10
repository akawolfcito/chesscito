import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatUnits } from "viem";

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
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-cyan-100/70 transition"
        >
          <picture className="h-full w-full">
            <source srcSet="/art/shop-chesscito.avif" type="image/avif" />
            <source srcSet="/art/shop-chesscito.webp" type="image/webp" />
            <img src="/art/shop-chesscito.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
          </picture>
          <span className="sr-only">Shop</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell sheet-bg-shop rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">Arcane Store</SheetTitle>
          <SheetDescription className="text-cyan-100/75">Choose an item to purchase with USDC.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.itemId.toString()} className="mission-soft rune-frame shop-slot-frame rounded-2xl p-3">
              <p className="text-sm font-semibold text-slate-100">{item.label}</p>
              <p className="text-xs text-slate-400">{item.subtitle}</p>
              <p className="mt-2 text-sm text-slate-200">
                {item.configured ? `${formatUnits(item.onChainPrice, 6)} USDC` : "Not configured"}
              </p>
              <p className="text-xs text-slate-400">
                {item.configured ? (item.enabled ? "Available" : "Unavailable") : "Unavailable"}
              </p>
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
                disabled={!item.configured || !item.enabled}
                onClick={() => onSelectItem(item.itemId)}
              >
                Buy with USDC
              </button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
