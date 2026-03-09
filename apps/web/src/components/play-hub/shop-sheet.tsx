import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
          aria-label="Tienda"
          className="mission-chip relative flex h-14 flex-1 items-center justify-center overflow-hidden rounded-2xl transition"
        >
          <img src="/art/shop-chesscito.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-1.5" />
          <span className="sr-only">Tienda</span>
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
              <p className="text-sm font-semibold text-slate-100">
                {item.itemId === 1n ? "Founder Badge" : item.label}
              </p>
              <p className="text-xs text-slate-400">
                {item.itemId === 1n
                  ? "Support Chesscito and receive an exclusive founder badge in your wallet."
                  : item.subtitle}
              </p>
              <p className="mt-2 text-sm text-slate-200">
                {item.configured ? `${formatUnits(item.onChainPrice, 6)} USDC` : "Not configured"}
              </p>
              <p className="text-xs text-slate-400">
                {item.configured ? (item.enabled ? "Available" : "Unavailable") : "Unavailable"}
              </p>
              <Button
                className="mt-3 w-full border-cyan-500/40 text-cyan-100 hover:bg-cyan-900/35"
                variant="outline"
                disabled={!item.configured || !item.enabled}
                onClick={() => onSelectItem(item.itemId)}
              >
                {item.itemId === 1n ? "Buy with USDC" : "Buy"}
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
