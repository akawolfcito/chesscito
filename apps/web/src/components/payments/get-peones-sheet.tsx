"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatUsd } from "@/lib/contracts/tokens";
import { getPeonesPack } from "@/lib/payments/rail-config";
import {
  usePaymentRail,
  type PaymentRailResult,
} from "@/lib/payments/use-payment-rail";

const SKU = "peones_pack_50" as const;

export type GetPeonesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stablecoin to pay with (USDC | USDT | cUSD). Balance auto-select is
   *  slice D; for now the caller passes the symbol. */
  tokenSymbol: string;
  onSuccess?: (result: PaymentRailResult) => void;
};

/**
 * GetPeonesSheet — base UI to buy a Peones pack via the Stablecoin Direct
 * Payment Rail (one tx, no approve; works on MiniPay AND MetaMask-on-Celo).
 * Consumes usePaymentRail; builds NO tx itself, never calls approve or the
 * Shop. Isolated: not wired to any public entry point yet. Fail-closed
 * when the rail is unavailable.
 */
export function GetPeonesSheet({
  open,
  onOpenChange,
  tokenSymbol,
  onSuccess,
}: GetPeonesSheetProps) {
  const rail = usePaymentRail({ sku: SKU, tokenSymbol, onVerified: onSuccess });
  const pack = getPeonesPack(SKU);
  const priceLabel = formatUsd(pack.priceUsd6); // "$0.50"

  const busy =
    rail.phase === "preparing" ||
    rail.phase === "awaiting_signature" ||
    rail.phase === "pending_tx" ||
    rail.phase === "verifying";

  const payLabel =
    rail.phase === "awaiting_signature"
      ? "Confirm in your wallet…"
      : rail.phase === "pending_tx"
        ? "Sending…"
        : rail.phase === "verifying"
          ? "Verifying…"
          : `Pay 0.50 ${tokenSymbol}`;

  const unavailableCopy: Record<string, string> = {
    no_treasury: "Payments are not available right now.",
    wrong_chain: "Switch your wallet to Celo to continue.",
    unsupported_token: "This token is not supported.",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        title="Get Peones"
        description={`${pack.peonesReward} Peones for ${priceLabel}`}
        className="sheet-bg-hub rounded-t-3xl border-0"
      >
        <div className="flex flex-col gap-4 py-2" data-testid="get-peones-sheet">
          <div>
            <p className="text-2xl font-extrabold">{pack.peonesReward} Peones</p>
            <p className="text-sm opacity-70">{priceLabel}</p>
            <p className="text-xs opacity-60">Pay with {tokenSymbol}</p>
          </div>

          {rail.phase === "success" && rail.result ? (
            <div data-testid="get-peones-success">
              <p className="text-lg font-bold text-emerald-700">
                +{rail.result.peonesCredited} Peones credited
              </p>
              {rail.result.duplicate ? (
                <p className="text-xs opacity-70">Already credited (no double charge).</p>
              ) : null}
              <button type="button" onClick={() => onOpenChange(false)} className="cta-secondary mt-2">
                Done
              </button>
            </div>
          ) : !rail.available ? (
            <p data-testid="get-peones-unavailable" className="text-sm text-amber-700">
              {unavailableCopy[rail.unavailableReason ?? ""] ?? "Payments are not available right now."}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void rail.pay()}
                disabled={busy}
                className="cta-principal"
                data-testid="get-peones-pay"
              >
                {payLabel}
              </button>
              <p className="text-center text-xs opacity-60">1 transaction, no approve</p>

              {rail.phase === "error" ? (
                <div data-testid="get-peones-error">
                  <p className="text-sm text-red-700">
                    Something went wrong: {rail.errorReason}
                  </p>
                  {rail.txHash ? (
                    <button
                      type="button"
                      onClick={() => void rail.verifyAgain()}
                      className="cta-secondary mt-2"
                      data-testid="get-peones-verify-again"
                    >
                      Verify again
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
