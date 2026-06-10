"use client";

import { useState } from "react";

import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { AddCashCta } from "@/components/minipay/add-cash-cta";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
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

/** Soft amber glow disc behind the reward sprite. Decorative only; sells the
 *  pack as a prize instead of a form field. Pointer-events off so it never
 *  intercepts taps on the sheet. */
function RewardGlow() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(closest-side, rgba(245, 190, 70, 0.45), rgba(245, 190, 70, 0) 72%)",
      }}
    />
  );
}

/** Pawn sprite (Peones currency). Reused from the HUD chip / Training Path so
 *  the reward reads as "Peones" everywhere. */
function PawnSprite({ className }: { className: string }) {
  return (
    <picture className={className}>
      <source srcSet="/art/redesign/pieces/w-pawn.avif" type="image/avif" />
      <source srcSet="/art/redesign/pieces/w-pawn.webp" type="image/webp" />
      <img
        src="/art/redesign/pieces/w-pawn.png"
        alt=""
        aria-hidden="true"
        className="block h-full w-full object-contain drop-shadow-md"
      />
    </picture>
  );
}

/**
 * GetPeonesSheet — buy a Peones pack via the Stablecoin Direct Payment
 * Rail (one tx, no approve; MiniPay AND MetaMask-on-Celo). Auto-selects a
 * payable stablecoin (USDC→USDT→cUSD) and offers a pill picker; never lets
 * pay() fire on an insufficient balance. Builds NO tx, never calls
 * approve/Shop. Isolated rail surface, fail-closed.
 *
 * Visual language: candy/premium, reward-first. Mirrors the celebratory
 * "All Exercises Complete" / arena end-state popups — cream parchment sheet
 * (`sheet-bg-hub` + red `candy-close-button`), big reward title
 * (`arena-result-title`), gold price badge (`candy-stat-pill`), candy CTA
 * (`arena-result-primary-cta--amber`). No raw HTML controls; copy trimmed.
 */
export function GetPeonesSheet({ open, onOpenChange, onSuccess }: GetPeonesSheetProps) {
  const selection = useGetPeonesTokenSelection(SKU);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const isSuccess = rail.phase === "success" && rail.result;

  if (!open) return null;

  return (
    /* Centered forest-frame popup (panel-bg1 + green border + red X close),
     *  the canonical celebratory modal shell shared with the arena end-state
     *  and "All Exercises Complete". Backdrop dismissal is blocked while a tx
     *  is in flight so an accidental tap cannot drop the verify state. */
    <VictoryPopupShell
      onClose={() => onOpenChange(false)}
      disableBackdropClose={busy}
      ariaLabel="Get Peones"
      closeLabel="Close"
    >
      <div
        className="flex flex-col items-center gap-4 text-center"
        data-testid="get-peones-sheet"
      >
        {isSuccess && rail.result ? (
          /* ---- SUCCESS: celebratory credit ---- */
            <div
              data-testid="get-peones-success"
              className="flex flex-col items-center gap-3"
            >
              <span className="relative inline-flex h-24 w-24 items-center justify-center">
                <RewardGlow />
                <PawnSprite className="h-20 w-20" />
              </span>
              <p className="arena-result-title">
                +{rail.result.peonesCredited} Peones credited
              </p>
              {rail.result.duplicate ? (
                <span className="candy-stat-pill text-[0.78rem]">
                  Already credited (no double charge)
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="arena-result-secondary-action mt-1"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* ---- REWARD HERO (always reward-first) ---- */}
              <span className="relative inline-flex h-24 w-24 items-center justify-center">
                <RewardGlow />
                <PawnSprite className="h-[5.5rem] w-[5.5rem]" />
              </span>
              <div className="flex flex-col items-center gap-1.5">
                <p className="arena-result-title leading-none">
                  {pack.peonesReward} Peones
                </p>
                <span className="candy-stat-pill text-[0.92rem] font-extrabold">
                  {priceLabel}
                </span>
              </div>

              {!rail.available ? (
                /* ---- UNAVAILABLE ---- */
                <p
                  data-testid="get-peones-unavailable"
                  className="max-w-[16rem] text-sm font-semibold text-amber-800"
                >
                  {unavailableCopy[rail.unavailableReason ?? ""] ??
                    "Payments are not available right now."}
                </p>
              ) : selection.noPayableToken ? (
                /* ---- INSUFFICIENT (empty-state) ---- */
                <div
                  data-testid="get-peones-insufficient"
                  className="flex flex-col items-center gap-2"
                >
                  <picture className="h-16 w-16 opacity-90">
                    <source
                      srcSet="/art/new-assets-chesscito/fun/avatar-asombrado.avif"
                      type="image/avif"
                    />
                    <source
                      srcSet="/art/new-assets-chesscito/fun/avatar-asombrado.webp"
                      type="image/webp"
                    />
                    <img
                      src="/art/new-assets-chesscito/fun/avatar-asombrado.png"
                      alt=""
                      aria-hidden="true"
                      className="block h-full w-full object-contain"
                    />
                  </picture>
                  <p className="text-sm font-bold text-amber-800">
                    Not enough balance
                  </p>
                  <p className="max-w-[15rem] text-xs text-amber-700/90">
                    Add some stablecoins to your wallet, then try again.
                  </p>
                  {/* MiniPay-only deeplink to add cash (renders null on web). */}
                  <AddCashCta source="get-peones" className="mt-1" />
                </div>
              ) : (
                /* ---- PAY ---- */
                <div className="flex w-full flex-col items-center gap-3">
                  {/* "Pay with" header + adorno flourish (reused from the
                   *  purchase-confirm sheet). */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-bold uppercase tracking-wide text-amber-800/80">
                      Pay with
                    </span>
                    <picture>
                      <source srcSet="/art/screen-mission/adorno-icon.avif" type="image/avif" />
                      <source srcSet="/art/screen-mission/adorno-icon.webp" type="image/webp" />
                      <img
                        src="/art/screen-mission/adorno-icon.png"
                        alt=""
                        aria-hidden="true"
                        className="h-2.5 w-24 object-contain"
                        draggable={false}
                      />
                    </picture>
                  </div>

                  {/* Token selector — collapsible candy dropdown. Collapsed:
                   *  selected token + balance + chevron. Expanded: a list of
                   *  candy-tray-pill rows with a check on the selected one and
                   *  a Low badge on insufficient balances. */}
                  <div data-testid="get-peones-token-picker" className="w-full">
                    <button
                      type="button"
                      data-testid="get-peones-token-trigger"
                      onClick={() => setPickerOpen((o) => !o)}
                      disabled={busy}
                      aria-haspopup="listbox"
                      aria-expanded={pickerOpen}
                      className="candy-tray-pill justify-between px-4 disabled:opacity-60"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="font-extrabold">{tokenSymbol}</span>
                        {selection.selected ? (
                          <span className="tabular-nums text-[0.78rem] opacity-70">
                            {fmtBalance(selection.selected)}
                          </span>
                        ) : null}
                      </span>
                      <CandyIcon
                        name="chevron-down"
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 transition-transform ${pickerOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {pickerOpen ? (
                      <div
                        role="listbox"
                        aria-label="Pay with"
                        className="mt-1.5 flex w-full flex-col gap-1.5"
                      >
                        {selection.tokens.map((t) => {
                          const selected = t.symbol === tokenSymbol;
                          return (
                            <button
                              key={t.symbol}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              data-testid={`get-peones-token-${t.symbol}`}
                              data-selected={selected ? "true" : "false"}
                              onClick={() => {
                                selection.setSelectedSymbol(t.symbol);
                                setPickerOpen(false);
                              }}
                              disabled={busy}
                              className={`candy-tray-pill justify-between px-4 disabled:opacity-60 ${
                                selected ? "ring-2 ring-amber-500/80" : ""
                              }`}
                            >
                              <span className="font-extrabold">{t.symbol}</span>
                              <span className="flex items-center gap-2">
                                <span className="tabular-nums text-[0.78rem] opacity-70">
                                  {fmtBalance(t)}
                                </span>
                                {selected ? (
                                  <CandyIcon name="check" aria-hidden="true" className="h-4 w-4" />
                                ) : !t.payable ? (
                                  <span className="rounded-md border border-amber-500/50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-700/90">
                                    Low
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <PrincipalButton
                    onClick={() => void rail.pay()}
                    disabled={busy || !payable}
                    loading={busy}
                    data-testid="get-peones-pay"
                  >
                    {payLabel}
                  </PrincipalButton>

                  {!payable ? (
                    <p
                      className="text-xs font-semibold text-amber-700"
                      data-testid="get-peones-token-low"
                    >
                      Not enough {tokenSymbol} balance.
                    </p>
                  ) : null}

                  {rail.phase === "error" ? (
                    <div
                      data-testid="get-peones-error"
                      className="flex flex-col items-center gap-2"
                    >
                      {rail.errorReason === "user_rejected" ? (
                        /* Friendly cancellation — no raw reason, no verify.
                         *  The Pay button above is the retry affordance. */
                        <p className="text-xs font-semibold text-amber-700">
                          Payment cancelled. You can try again.
                        </p>
                      ) : (
                        <>
                          <p className="max-w-[16rem] text-xs font-semibold text-red-700">
                            Something went wrong: {rail.errorReason}
                          </p>
                          {rail.txHash ? (
                            <button
                              type="button"
                              onClick={() => void rail.verifyAgain()}
                              className="arena-result-secondary-action"
                              data-testid="get-peones-verify-again"
                            >
                              Verify again
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
      </div>
    </VictoryPopupShell>
  );
}
