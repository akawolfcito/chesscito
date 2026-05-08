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
      <SheetContent side="bottom" className="mission-shell sheet-bg-shop rounded-t-3xl border-0">
        <div className="border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              {PURCHASE_CONFIRM_COPY.title}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {PURCHASE_CONFIRM_COPY.description}
            </SheetDescription>
          </SheetHeader>
        </div>
        {selectedItem ? (
          <div
            className="mt-4 space-y-2 rounded-2xl border p-3 text-sm"
            style={{
              borderColor: "rgba(255, 255, 255, 0.45)",
              background: "rgba(255, 255, 255, 0.15)",
              color: "rgba(63, 34, 8, 0.95)",
            }}
          >
            {/* Hero: item name */}
            <p
              className="text-base font-extrabold"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
              }}
            >
              {selectedItem.label}
            </p>
            {/* Prominent price */}
            <p
              className="text-lg font-extrabold"
              style={{
                color: "rgba(120, 65, 5, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
              }}
            >
              {formatUsd(selectedItem.onChainPrice)}
            </p>
            <div className="my-1 border-t" style={{ borderColor: "rgba(110, 65, 15, 0.18)" }} />
            {/* Secondary details */}
            {paymentTokenSymbol ? (
              <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
                {PURCHASE_FIELD_LABELS.payingWith}:{" "}
                <span className="font-bold" style={{ color: "rgba(63, 34, 8, 0.95)" }}>
                  {paymentTokenSymbol}
                </span>
              </p>
            ) : null}
            <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {PURCHASE_FIELD_LABELS.status}:{" "}
              <span className="font-bold" style={{ color: "rgba(63, 34, 8, 0.95)" }}>
                {selectedItem.configured ? (selectedItem.enabled ? SHOP_SHEET_COPY.status.available : SHOP_SHEET_COPY.status.unavailable) : SHOP_SHEET_COPY.status.notConfigured}
              </span>
            </p>
            <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {PURCHASE_FIELD_LABELS.network}:{" "}
              <span className="font-bold" style={{ color: "rgba(63, 34, 8, 0.95)" }}>
                {chainId ? (CHAIN_NAMES[chainId] ?? "Unknown network") : "—"}
              </span>
            </p>
            <p
              className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{
                background: "rgba(245, 158, 11, 0.22)",
                boxShadow: "inset 0 0 0 1px rgba(245, 158, 11, 0.55)",
                color: "rgba(120, 65, 5, 0.95)",
              }}
            >
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
              className="mt-2 min-h-[44px] w-full py-3 text-center text-sm font-semibold transition-colors hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
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
