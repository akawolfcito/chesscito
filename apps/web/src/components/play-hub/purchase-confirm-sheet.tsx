import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatUsd } from "@/lib/contracts/tokens";
import { PURCHASE_CONFIRM_COPY, PURCHASE_FIELD_LABELS, CHAIN_NAMES, SHOP_SHEET_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";

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
  paymentTokenSymbol: string | null;
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
  paymentTokenSymbol,
  isConnected,
  isCorrectChain,
  isWriting,
  purchasePhase,
  onConfirm,
}: PurchaseConfirmSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mission-shell sheet-bg-shop rounded-t-3xl border-white/[0.10]">
        <div className="border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle className="fantasy-title text-cyan-50">{PURCHASE_CONFIRM_COPY.title}</SheetTitle>
            <SheetDescription className="text-cyan-100/75">{PURCHASE_CONFIRM_COPY.description}</SheetDescription>
          </SheetHeader>
        </div>
        {selectedItem ? (
          <div className="mission-soft rune-frame mt-4 space-y-2 rounded-2xl p-3 text-sm text-slate-200">
            {/* Hero: item name */}
            <p className="text-base font-bold text-white">{selectedItem.label}</p>
            {/* Prominent price */}
            <p className="text-lg font-extrabold text-amber-300">{formatUsd(selectedItem.onChainPrice)}</p>
            <div className="my-1 border-t border-white/[0.06]" />
            {/* Secondary details */}
            {paymentTokenSymbol ? (
              <p className="text-xs text-slate-400">
                {PURCHASE_FIELD_LABELS.payingWith}: <span className="font-semibold text-slate-300">{paymentTokenSymbol}</span>
              </p>
            ) : null}
            <p className="text-xs text-slate-400">
              {PURCHASE_FIELD_LABELS.status}:{" "}
              <span className="font-semibold text-slate-300">
                {selectedItem.configured ? (selectedItem.enabled ? SHOP_SHEET_COPY.status.available : SHOP_SHEET_COPY.status.unavailable) : SHOP_SHEET_COPY.status.notConfigured}
              </span>
            </p>
            <p className="text-xs text-slate-400">
              {PURCHASE_FIELD_LABELS.network}: <span className="font-semibold text-slate-300">{chainId ? (CHAIN_NAMES[chainId] ?? "Unknown network") : "—"}</span>
            </p>
            <p className="rounded-xl border border-amber-400/45 bg-amber-900/30 px-3 py-2 text-xs text-amber-100">
              {PURCHASE_CONFIRM_COPY.miniPayWarning}
            </p>
            <Button
              type="button"
              variant="game-solid"
              size="game"
              className="mt-2"
              disabled={
                isWriting ||
                purchasePhase !== "idle" ||
                !shopAddress ||
                !paymentTokenSymbol ||
                !isConnected ||
                !isCorrectChain ||
                !selectedItem.configured ||
                !selectedItem.enabled
              }
              onClick={onConfirm}
            >
              {(isWriting || purchasePhase !== "idle") && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {purchasePhase === "approving"
                ? PURCHASE_CONFIRM_COPY.approving(paymentTokenSymbol ?? "")
                : purchasePhase === "buying"
                  ? PURCHASE_CONFIRM_COPY.buying
                  : PURCHASE_CONFIRM_COPY.confirmButton}
            </Button>
            <button
              type="button"
              className="mt-2 w-full py-2 text-center text-sm font-medium text-cyan-100/60 hover:text-cyan-100/80 transition-colors min-h-[44px]"
              onClick={() => onOpenChange(false)}
              disabled={isWriting || purchasePhase !== "idle"}
            >
              {PURCHASE_CONFIRM_COPY.cancel}
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
