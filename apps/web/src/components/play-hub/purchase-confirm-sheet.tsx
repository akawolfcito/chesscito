import { formatUnits } from "viem";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type SelectedItem = {
  label: string;
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
};

type PurchaseConfirmSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: SelectedItem | null;
  chainId: number | undefined;
  shopAddress: string | null;
  usdcAddress: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isWriting: boolean;
  purchasePhase: "idle" | "approving" | "buying";
  onConfirm: () => void;
};

export function PurchaseConfirmSheet({
  open,
  onOpenChange,
  selectedItem,
  chainId,
  shopAddress,
  usdcAddress,
  isConnected,
  isCorrectChain,
  isWriting,
  purchasePhase,
  onConfirm,
}: PurchaseConfirmSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle>Confirmar compra</SheetTitle>
          <SheetDescription>Revisa detalle antes de enviar la transaccion.</SheetDescription>
        </SheetHeader>
        {selectedItem ? (
          <div className="mt-4 space-y-2 text-sm text-slate-200">
            <p>
              Label: <span className="font-semibold text-slate-100">{selectedItem.label}</span>
            </p>
            <p>
              Precio: <span className="font-semibold text-slate-100">{formatUnits(selectedItem.onChainPrice, 6)} USDC</span>
            </p>
            <p>
              Estado:{" "}
              <span className="font-semibold text-slate-100">
                {selectedItem.configured ? (selectedItem.enabled ? "Disponible" : "Deshabilitado") : "No configurado"}
              </span>
            </p>
            <p>
              Red: <span className="font-semibold text-slate-100">{chainId ?? "n/a"}</span>
            </p>
            <p>
              Shop: <span className="break-all font-mono text-xs">{shopAddress ?? "missing"}</span>
            </p>
            <p>
              USDC: <span className="break-all font-mono text-xs">{usdcAddress ?? "missing"}</span>
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              MiniPay puede mostrar &quot;Unknown transaction&quot;. Este modal describe la accion esperada antes de firmar.
            </p>
            <Button
              className="mt-2 w-full"
              disabled={
                isWriting ||
                purchasePhase !== "idle" ||
                !shopAddress ||
                !usdcAddress ||
                !isConnected ||
                !isCorrectChain ||
                !selectedItem.configured ||
                !selectedItem.enabled
              }
              onClick={onConfirm}
            >
              {purchasePhase === "approving"
                ? "Aprobando USDC..."
                : purchasePhase === "buying"
                  ? "Comprando..."
                  : "Confirmar compra"}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
