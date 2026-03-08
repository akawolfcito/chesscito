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
          className="mission-chip flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100/80 transition"
        >
          <span className="text-base leading-none">🛒</span>
          <span>Tienda</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">Arcane Store (USDC)</SheetTitle>
          <SheetDescription className="text-cyan-100/75">Selecciona un artefacto para comprar on-chain.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.itemId.toString()} className="mission-soft rune-frame shop-slot-frame rounded-2xl p-3">
              <p className="text-sm font-semibold text-slate-100">{item.label}</p>
              <p className="text-xs text-slate-400">{item.subtitle}</p>
              <p className="mt-2 text-sm text-slate-200">
                {item.configured ? `${formatUnits(item.onChainPrice, 6)} USDC` : "No configurado"}
              </p>
              <p className="text-xs text-slate-400">
                {item.configured ? (item.enabled ? "Disponible" : "Deshabilitado") : "No disponible"}
              </p>
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
