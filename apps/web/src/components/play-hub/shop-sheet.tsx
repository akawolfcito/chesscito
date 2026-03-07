import { Button } from "@/components/ui/button";
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
        <Button className="border-cyan-500/40 text-cyan-100 hover:bg-cyan-900/35" variant="outline">Store</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">Arcane Store (USDC)</SheetTitle>
          <SheetDescription className="text-cyan-100/75">Selecciona un artefacto para comprar on-chain.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
          {items.map((item) => (
            <div key={item.itemId.toString()} className="mission-soft rune-frame min-w-[74%] snap-center rounded-2xl p-3 sm:min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.subtitle}</p>
                </div>
                <div className="h-10 w-10 rounded-xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.18)]" />
              </div>
              <p className="mt-2 text-sm text-slate-200">
                {item.configured ? `${formatUnits(item.onChainPrice, 6)} USDC` : "No configurado"}
              </p>
              <div className="mt-1">
                <span className="rounded-full border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {item.configured ? (item.enabled ? "Ready" : "Locked") : "Missing"}
                </span>
              </div>
              <Button
                className="mt-3 w-full border-cyan-500/40 text-cyan-100 hover:bg-cyan-900/35"
                variant="outline"
                disabled={!item.configured || !item.enabled}
                onClick={() => onSelectItem(item.itemId)}
              >
                Comprar
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
