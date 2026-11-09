"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { AddCashCta } from "@/components/minipay/add-cash-cta";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { formatUsd } from "@/lib/contracts/tokens";
import {
  clampPeonesAmount,
  getPeonesPack,
  getPeonesPackSku,
  PEONES_AMOUNT_STEP,
  PEONES_DEFAULT_AMOUNT,
  PEONES_MAX_AMOUNT,
  PEONES_MIN_AMOUNT,
  type PeonesAmount,
} from "@/lib/payments/rail-config";
import {
  usePaymentRail,
  type PaymentRailResult,
} from "@/lib/payments/use-payment-rail";
import {
  useGetPeonesTokenSelection,
  type PayableToken,
} from "@/lib/payments/use-get-peones-token-selection";

const FALLBACK_TOKEN = "USDC";

export type GetPeonesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: PaymentRailResult) => void;
  /** Opening amount for the stepper. Snapped onto the buyable ladder rather
   *  than rejected, so a caller asking for "about 40" gets 40 and a caller
   *  asking for nonsense gets the default instead of a broken sheet. */
  initialAmount?: number;
  /** Scrim z-index for the portalled shell. Defaults to `z-[55]` (Account aux
   *  sheet: above the z-50 sheet, under the z-60 dock). Callers layered higher
   *  — e.g. the Peones chip's z-70 Chesito Card modal — pass a taller class so
   *  the sheet stacks ABOVE the opener instead of behind it. */
  scrimZClassName?: string;
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
    <ThemeAssetPicture slot="board.piece.white.pawn" pictureClassName={className} alt="" aria-hidden="true" className="block h-full w-full object-contain drop-shadow-md" />
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
export function GetPeonesSheet({
  open,
  onOpenChange,
  onSuccess,
  scrimZClassName = "z-[55]",
  initialAmount,
}: GetPeonesSheetProps) {
  const t = useTranslations("GET_PEONES_COPY");
  const [amount, setAmount] = useState<PeonesAmount>(() =>
    initialAmount === undefined ? PEONES_DEFAULT_AMOUNT : clampPeonesAmount(initialAmount),
  );
  const sku = getPeonesPackSku(amount);
  const selection = useGetPeonesTokenSelection(sku);
  const [pickerOpen, setPickerOpen] = useState(false);
  const tokenSymbol = selection.selectedSymbol ?? FALLBACK_TOKEN;
  const rail = usePaymentRail({ sku, tokenSymbol, onVerified: onSuccess });
  const pack = getPeonesPack(sku);
  // Every number on this sheet — reward, price, and the amount the request
  // carries — comes off this one pack. The client never carries a reward that
  // the SKU does not imply.
  const priceLabel = formatUsd(pack.priceUsd6);

  const payable = selection.selected?.payable ?? false;
  const busy =
    rail.phase === "preparing" ||
    rail.phase === "awaiting_signature" ||
    rail.phase === "pending_tx" ||
    rail.phase === "verifying";

  const payLabel =
    rail.phase === "awaiting_signature"
      ? t("confirmInWallet")
      : rail.phase === "pending_tx"
        ? t("sending")
        : rail.phase === "verifying"
          ? t("verifying")
          : t("pay", { price: priceLabel });

  const unavailableCopy: Record<string, string> = {
    no_treasury: t("unavailable"),
    wrong_chain: t("wrongChain"),
    unsupported_token: t("unsupportedToken"),
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
      ariaLabel={t("title")}
      closeLabel={t("close")}
      // Opened from inside the Account aux sheet (Chesito Card → Top up), whose
      // Radix slide-in transform would otherwise trap this `fixed` modal inside
      // the sheet. Portal to <body> so it covers the whole sheet. Default z-[55]
      // sits ABOVE the z-50 sheet but UNDER the z-60 dock; callers layered higher
      // (chip's z-70 card modal) pass a taller scrimZClassName.
      portal
      scrimZClassName={scrimZClassName}
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
                {t("credited", { count: rail.result.peonesCredited })}
              </p>
              {/* New balance — closes the loop the credit line opens.
               *  "50 Peones received" answers what arrived; without this
               *  the player still has to leave and hunt for what they now
               *  hold. Read from the verified receipt, so it is the
               *  server's number, not a local sum. Omitted when the
               *  receipt does not carry one rather than computing a
               *  plausible-looking total. */}
              {typeof rail.result.newBalance === "number" ? (
                <span
                  className="candy-stat-pill text-[0.85rem] font-extrabold"
                  data-testid="get-peones-new-balance"
                >
                  {t("newBalance", { balance: rail.result.newBalance })}
                </span>
              ) : null}
              {/* What the currency is FOR. A player who just bought their
               *  first pack has no model of where Peones go; naming the
               *  three sinks is the cheapest way to make the purchase
               *  legible. Static copy — no new infrastructure. */}
              <p
                className="text-[0.78rem] opacity-80"
                data-testid="get-peones-usage"
              >
                {t("usage")}
              </p>
              {rail.result.duplicate ? (
                <span className="candy-stat-pill text-[0.78rem]">
                  {t("duplicate")}
                </span>
              ) : null}
              <PrincipalButton
                onClick={() => onOpenChange(false)}
                className="mt-1"
                data-testid="get-peones-done"
              >
                {t("done")}
              </PrincipalButton>
            </div>
          ) : (
            <>
              {/* ---- REWARD HERO (always reward-first) ----
                  Founder composition pass 2026-06-11: pawn + title share
                  one row, price below — tighter vertical rhythm than the
                  former full-height pawn stack. */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center gap-2">
                  <span className="relative inline-flex h-16 w-16 items-center justify-center">
                    <RewardGlow />
                    <PawnSprite className="h-14 w-14" />
                  </span>
                  <p className="arena-result-title leading-none">
                    {t("reward", { count: pack.peonesReward })}
                  </p>
                </div>
                {/* Amount stepper. The price pill sits BETWEEN the two
                 *  controls so the thing being changed and the thing being
                 *  paid read as one object. Locked while a transfer is in
                 *  flight: the SKU is what the signed transfer commits to,
                 *  so changing it mid-payment would desync amount from money. */}
                <div
                  className="flex items-center justify-center gap-3"
                  data-testid="get-peones-stepper"
                  data-amount={amount}
                >
                  <button
                    type="button"
                    aria-label={t("decreaseAmount")}
                    data-testid="get-peones-decrease"
                    disabled={busy || amount <= PEONES_MIN_AMOUNT}
                    onClick={() => setAmount((a) => clampPeonesAmount(a - PEONES_AMOUNT_STEP))}
                    className="h-9 w-9 shrink-0 rounded-full border-2 border-amber-600/60 bg-amber-100 text-lg font-black leading-none text-amber-800 disabled:opacity-40"
                  >
                    &#8722;
                  </button>
                  <span
                    className="candy-stat-pill min-w-[4.5rem] text-[0.92rem] font-extrabold"
                    data-testid="get-peones-price"
                  >
                    {priceLabel}
                  </span>
                  <button
                    type="button"
                    aria-label={t("increaseAmount")}
                    data-testid="get-peones-increase"
                    disabled={busy || amount >= PEONES_MAX_AMOUNT}
                    onClick={() => setAmount((a) => clampPeonesAmount(a + PEONES_AMOUNT_STEP))}
                    className="h-9 w-9 shrink-0 rounded-full border-2 border-amber-600/60 bg-amber-100 text-lg font-black leading-none text-amber-800 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              {!rail.available ? (
                /* ---- UNAVAILABLE ---- */
                <p
                  data-testid="get-peones-unavailable"
                  className="max-w-[16rem] text-sm font-semibold text-amber-800"
                >
                  {unavailableCopy[rail.unavailableReason ?? ""] ?? t("unavailable")}
                </p>
              ) : selection.noPayableToken ? (
                /* ---- INSUFFICIENT (empty-state) ---- */
                <div
                  data-testid="get-peones-insufficient"
                  className="flex flex-col items-center gap-2"
                >
                  {/* Founder composition pass 2026-06-11: message and
                      avatar share one row instead of a vertical stack. */}
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <p className="text-sm font-bold text-amber-800">
                        {t("insufficientTitle")}
                      </p>
                      <p className="max-w-[12rem] text-xs text-amber-700/90">
                        {t("insufficientBody")}
                      </p>
                    </div>
                    <ThemeAssetPicture slot="shared.feedback-surprised" pictureClassName="h-16 w-16 shrink-0 opacity-90" alt="" aria-hidden="true" className="block h-full w-full object-contain" />
                  </div>
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
                      {t("payWith")}
                    </span>
                    <ThemeAssetPicture slot="shared.mission-adorno" alt="" aria-hidden="true" className="h-2.5 w-24 object-contain" draggable={false} />
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
                        aria-label={t("payWith")}
                        className="mt-1.5 flex w-full flex-col gap-1.5"
                      >
                        {selection.tokens.map((tok) => {
                          const selected = tok.symbol === tokenSymbol;
                          return (
                            <button
                              key={tok.symbol}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              data-testid={`get-peones-token-${tok.symbol}`}
                              data-selected={selected ? "true" : "false"}
                              onClick={() => {
                                selection.setSelectedSymbol(tok.symbol);
                                setPickerOpen(false);
                              }}
                              disabled={busy}
                              className={`candy-tray-pill justify-between px-4 disabled:opacity-60 ${
                                selected ? "ring-2 ring-amber-500/80" : ""
                              }`}
                            >
                              <span className="font-extrabold">{tok.symbol}</span>
                              <span className="flex items-center gap-2">
                                <span className="tabular-nums text-[0.78rem] opacity-70">
                                  {fmtBalance(tok)}
                                </span>
                                {selected ? (
                                  <CandyIcon name="check" aria-hidden="true" className="h-4 w-4" />
                                ) : !tok.payable ? (
                                  <span className="rounded-md border border-amber-500/50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-700/90">
                                    {t("lowBadge")}
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
                    disabled={busy || !payable || rail.paymentRetryBlocked}
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
                      {t("lowBalance", { token: tokenSymbol })}
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
                          {t("cancelled")}
                        </p>
                      ) : (
                        /* Generic failure — the raw `rail.errorReason` is NEVER
                         *  rendered (it can be a revert/RPC string). It stays in
                         *  telemetry only; the user sees a fixed friendly line. */
                        <>
                          <p className="max-w-[16rem] text-xs font-semibold text-red-700">
                            {t("errorGeneric")}
                          </p>
                          {rail.txHash ? (
                            <button
                              type="button"
                              onClick={() => void rail.verifyAgain()}
                              className="arena-result-secondary-action"
                              data-testid="get-peones-verify-again"
                            >
                              {t("verifyAgain")}
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
