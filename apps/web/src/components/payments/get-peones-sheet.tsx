"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatUsd } from "@/lib/contracts/tokens";
import { getPeonesPack } from "@/lib/payments/rail-config";
import {
  usePaymentRail,
  type PaymentRailResult,
} from "@/lib/payments/use-payment-rail";
import {
  useGetPeonesTokenSelection,
  type PayableToken,
} from "@/lib/payments/use-get-peones-token-selection";

const SKU = "peones_pack_50" as const;
const FALLBACK_TOKEN = "USDC";

export type GetPeonesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: PaymentRailResult) => void;
};

function fmtBalance(t: PayableToken): string {
  return (Number(t.balance) / 10 ** t.decimals).toFixed(2);
}

/**
 * GetPeonesSheet — buy a Peones pack via the Stablecoin Direct Payment
 * Rail (one tx, no approve; MiniPay AND MetaMask-on-Celo). Auto-selects a
 * payable stablecoin (USDC→USDT→cUSD) and offers a picker; never lets pay()
 * fire on an insufficient balance. Builds NO tx, never calls approve/Shop.
 * Isolated: not wired to any public entry point yet. Fail-closed.
 */
export function GetPeonesSheet({ open, onOpenChange, onSuccess }: GetPeonesSheetProps) {
  const selection = useGetPeonesTokenSelection(SKU);
  const tokenSymbol = selection.selectedSymbol ?? FALLBACK_TOKEN;
  const rail = usePaymentRail({ sku: SKU, tokenSymbol, onVerified: onSuccess });
  const pack = getPeonesPack(SKU);
  const priceLabel = formatUsd(pack.priceUsd6); // "$0.50"

  const payable = selection.selected?.payable ?? false;
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
          ) : selection.noPayableToken ? (
            <p data-testid="get-peones-insufficient" className="text-sm text-amber-700">
              Not enough stablecoin balance to buy this pack.
            </p>
          ) : (
            <>
              <label className="text-xs opacity-70">
                Pay with{" "}
                <select
                  data-testid="get-peones-token-picker"
                  value={tokenSymbol}
                  onChange={(e) => selection.setSelectedSymbol(e.target.value)}
                  disabled={busy}
                >
                  {selection.tokens.map((t) => (
                    <option key={t.symbol} value={t.symbol}>
                      {t.symbol} ({fmtBalance(t)}){t.payable ? "" : " — low"}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void rail.pay()}
                disabled={busy || !payable}
                className="cta-principal"
                data-testid="get-peones-pay"
              >
                {payLabel}
              </button>
              {!payable ? (
                <p className="text-center text-xs text-amber-700" data-testid="get-peones-token-low">
                  Not enough {tokenSymbol} balance.
                </p>
              ) : (
                <p className="text-center text-xs opacity-60">1 transaction, no approve</p>
              )}

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
