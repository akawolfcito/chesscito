"use client";

import { Fragment, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";

import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { AddCashCta } from "@/components/minipay/add-cash-cta";
import { SeasonPassCelebration } from "@/components/payments/season-pass-celebration";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { formatUsd } from "@/lib/contracts/tokens";
import { getSeasonPass } from "@/lib/payments/rail-config";
import {
  useStablecoinTokenSelection,
  type PayableToken,
} from "@/lib/payments/use-get-peones-token-selection";
import {
  useSeasonPassRail,
  type SeasonPassRailResult,
} from "@/lib/season-pass/use-season-pass-rail";
import { mapSeasonPassError } from "@/lib/season-pass/map-season-pass-error";
import { useSeasonPassStatus } from "@/lib/season-pass/use-season-pass-status";
import { useThemeBackground } from "@/lib/themes/use-theme-background";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

const SKU = "lite_season_pass_21" as const;
const FALLBACK_TOKEN = "USDC";

/** Narrative row. The order IS the promise's chronology: you get the pass, you
 *  train, the habit sticks. Now labelled (same gift → tactic → habit strip as
 *  the mini-tour's step 1). Every icon resolves through the theme catalog; a raw
 *  path here would leave this sheet unthemed while the same art re-skins
 *  everywhere else. `labelKey` is a key into `CHALLENGE_CARD_COPY`. */
const STORY_STEPS: readonly { slot: ThemeAssetKey; labelKey: string }[] = [
  { slot: "shared.welcome-gift", labelKey: "storyGift" },
  { slot: "hub.train-pieces", labelKey: "storyTactic" },
  { slot: "shared.flame-color", labelKey: "storyHabit" },
];

// Inherited by every text in the sheet; amber/red state copy overrides it.
const SHEET_TEXT_COLOR = "rgba(63, 34, 8, 0.95)";

/** One tile of the 3-up benefit grid: a catalog slot + its resolved label. */
type BenefitTile = { slot: ThemeAssetKey; label: string };

export type SeasonPassSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: SeasonPassRailResult) => void;
};

function fmtBalance(t: PayableToken): string {
  return (Number(t.balance) / 10 ** t.decimals).toFixed(2);
}

function ShieldIcon() {
  return (
    <span
      aria-hidden="true"
      className="text-5xl leading-none"
      style={{ filter: "drop-shadow(0 2px 8px rgba(59,130,246,0.55))" }}
    >
      🛡️
    </span>
  );
}

export function SeasonPassSheet({ open, onOpenChange, onSuccess }: SeasonPassSheetProps) {
  if (!CHESSCITO_LITE_MODE) return null;
  if (!open) return null;

  return <SeasonPassSheetInner onOpenChange={onOpenChange} onSuccess={onSuccess} />;
}

function SeasonPassSheetInner({
  onOpenChange,
  onSuccess,
}: Omit<SeasonPassSheetProps, "open">) {
  const t = useTranslations("CHALLENGE_CARD_COPY");
  const router = useRouter();
  const pathname = usePathname();
  const { address } = useAccount();
  const trainingPass = useSeasonPassStatus(address);
  const celebrationPanelBackground = useThemeBackground("payments.celebration-bg");
  // Dedicated offer-state background (panel-bg2). Scoped to THIS sheet so the
  // shared panel-bg (panel-bg1) stays put on every other modal.
  const offerPanelBackground = useThemeBackground("payments.offer-bg");
  const pass = getSeasonPass(SKU);
  const priceLabel = formatUsd(pass.priceUsd6);

  // Auto-select a PAYABLE stablecoin from the user's balances (USDC→USDT→
  // cUSD). Hardcoding USDC reverted the transfer for wallets holding cUSD
  // or USDT — the same smoke bug the Peones rail already solved.
  const selection = useStablecoinTokenSelection(pass.priceUsd6);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tokenSymbol = selection.selectedSymbol ?? FALLBACK_TOKEN;

  const benefits: BenefitTile[] = [
    { slot: "hub.21-day-icon", label: t("offerBenefitDays", { days: pass.durationDays }) },
    { slot: "hub.training-icon", label: t("offerBenefitTrainings") },
    {
      slot: "shared.shield",
      label: t("offerBenefitShields", { count: pass.shieldsOnPurchase }),
    },
  ];

  const rail = useSeasonPassRail({
    sku: SKU,
    tokenSymbol,
    onVerified: onSuccess,
  });

  const busy =
    rail.phase === "preparing" ||
    rail.phase === "awaiting_signature" ||
    rail.phase === "pending_tx" ||
    rail.phase === "verifying";

  const payLabel =
    rail.phase === "awaiting_signature"
      ? "Confirm in wallet"
      : rail.phase === "pending_tx"
        ? "Sending..."
        : rail.phase === "verifying"
          ? "Verifying..."
          : t("offerCta");

  const isSuccess = rail.phase === "success" && rail.result;

  // Start Focus routes to /exercises — the hub's own destination. Buying from
  // the LEARN dock already sits there, where a push would be a no-op that
  // leaves the celebration mounted; close instead.
  const startFocus = () => {
    if (pathname === "/exercises") {
      onOpenChange(false);
      return;
    }
    router.push("/exercises");
  };

  return (
    <VictoryPopupShell
      onClose={() => onOpenChange(false)}
      disableBackdropClose={busy}
      ariaLabel="21-Day Mind Challenge Pass"
      closeLabel="Close"
      panelBackgroundImage={isSuccess ? celebrationPanelBackground : offerPanelBackground}
    >
      <div
        className="flex flex-col items-center gap-4 text-center"
        data-testid="season-pass-sheet"
        style={{ color: SHEET_TEXT_COLOR }}
      >
        {/* The celebration outranks every status branch: once THIS session
            verified a payment, a refreshed entitlement would otherwise flip the
            sheet to "Pass Active" and swallow the celebration the buyer just
            earned. */}
        {isSuccess && rail.result ? (
          <div data-testid="season-pass-success" className="w-full">
            <SeasonPassCelebration
              durationDays={pass.durationDays}
              shieldsCredited={rail.result.shieldsCredited}
              onStartFocus={startFocus}
            />
          </div>
        ) : trainingPass.loading ? (
          <div data-testid="season-pass-status-loading" className="flex flex-col items-center gap-3">
            <p className="arena-result-title">Checking access...</p>
          </div>
        ) : trainingPass.active && trainingPass.source === "pro" ? (
          <div data-testid="season-pass-included-pro" className="flex flex-col items-center gap-3">
            <p className="arena-result-title">{t("proIncludedTitle")}</p>
            <p className="max-w-[220px] text-sm opacity-80">
              {t("trainingPassStat")} · {t("accessActive")}
            </p>
            <PrincipalButton onClick={() => onOpenChange(false)} className="mt-1">
              Done
            </PrincipalButton>
          </div>
        ) : trainingPass.active && trainingPass.source === "season_pass" ? (
          <div data-testid="season-pass-already-active" className="flex flex-col items-center gap-3">
            {/* <ShieldIcon /> */}
            <p className="arena-result-title">Pass Active</p>
            <p className="text-sm opacity-80">
              +{trainingPass.shieldsCredited} shields included with your direct pass
            </p>
            <PrincipalButton onClick={() => onOpenChange(false)} className="mt-1">
              Done
            </PrincipalButton>
          </div>
        ) : (
          <>
            {/* <ShieldIcon /> */}
            <div className="season-pass-title">
              <p className="season-pass-kicker">{t("offerJoinKicker")}</p>
              <TileIconSlot slot="hub.tour-title" className="season-pass-wordmark" />
            </div>
            {/* The habit promise stays in the flow; the two detail paragraphs
                that used to sit under it now hide behind this chip. Reading
                them never touches the rail, so it stays live while paying.
                This block is the popover's positioning context — see the
                floating panel below. */}
            <div className="season-pass-habit" data-testid="season-pass-habit">
              <p className="text-sm opacity-80">
                {t("offerHabit")}{" "}
                <button
                  type="button"
                  data-testid="season-pass-details-toggle"
                  onClick={() => setDetailsOpen((o) => !o)}
                  aria-expanded={detailsOpen}
                  aria-controls="season-pass-details"
                  aria-label={t("offerDetailsLabel")}
                  className="season-pass-help-chip"
                >
                  ?
                </button>
              </p>

              {/* Floating on purpose: laid out in flow it would push the price,
                  the picker and the CTA down by its own height, moving the pay
                  button out from under the reader's thumb mid-read. A popover,
                  NOT a modal — the sheet already owns the only aria-modal. */}
              {detailsOpen ? (
                <div
                  id="season-pass-details"
                  data-testid="season-pass-details"
                  className="season-pass-details"
                  role="note"
                >
                  <p>{t("offerPractice", { days: pass.durationDays })}</p>
                  <p>{t("offerShieldsBonus", { count: pass.shieldsOnPurchase })}</p>
                </div>
              ) : null}
            </div>

            <div className="season-pass-story" data-testid="season-pass-story">
              {STORY_STEPS.map((step, index) => (
                <Fragment key={step.slot}>
                  {index > 0 ? (
                    <TileIconSlot
                      slot="season.story-arrow"
                      className="season-pass-story-arrow"
                    />
                  ) : null}
                  <div className="season-pass-story-step">
                    <TileIconSlot slot={step.slot} className="season-pass-story-icon" />
                    <span className="season-pass-story-label">{t(step.labelKey)}</span>
                  </div>
                </Fragment>
              ))}
            </div>

            <div className="season-pass-benefits" data-testid="season-pass-benefits">
              {benefits.map((tile) => (
                <div key={tile.slot} className="season-pass-benefit">
                  <TileIconSlot slot={tile.slot} className="season-pass-benefit-icon" />
                  <span className="season-pass-benefit-label">{tile.label}</span>
                </div>
              ))}
            </div>

            <span className="candy-stat-pill text-base font-bold">{priceLabel}</span>

            {!rail.available ? (
              /* ---- UNAVAILABLE (no wallet / wrong chain) ---- */
              <p
                data-testid="season-pass-unavailable"
                className="text-xs text-amber-400 max-w-[220px]"
              >
                Connect your wallet on Celo to purchase
              </p>
            ) : selection.noPayableToken ? (
              /* ---- INSUFFICIENT BALANCE ---- */
              <div
                data-testid="season-pass-insufficient"
                className="flex flex-col items-center gap-2"
              >
                <p className="text-sm font-bold text-amber-400">Not enough funds</p>
                <p className="max-w-[220px] text-xs opacity-70">
                  Add some USD stablecoin (USDC, USDT or cUSD) to get your pass.
                </p>
                <AddCashCta source="season-pass" className="mt-1" />
              </div>
            ) : (
              /* ---- PAY ---- */
              <div className="flex w-full flex-col items-center gap-3">
                <div className="season-pass-paywith" data-testid="season-pass-paywith">
                  <span className="season-pass-paywith-label">{t("offerPayWith")}</span>
                  <span className="season-pass-paywith-rule">
                    <TileIconSlot
                      slot="shared.mission-adorno"
                      className="season-pass-paywith-ornament"
                    />
                  </span>
                </div>

                {/* Token picker — auto-selects the payable token; user can
                 *  switch among the stablecoins they hold. */}
                <div data-testid="season-pass-token-picker" className="w-full">
                  <button
                    type="button"
                    data-testid="season-pass-token-trigger"
                    onClick={() => setPickerOpen((o) => !o)}
                    disabled={busy}
                    aria-haspopup="listbox"
                    aria-expanded={pickerOpen}
                    className="candy-tray-pill justify-between px-4 disabled:opacity-60 w-full"
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
                      {selection.tokens.map((tok) => {
                        const selected = tok.symbol === tokenSymbol;
                        return (
                          <button
                            key={tok.symbol}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            data-testid={`season-pass-token-${tok.symbol}`}
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
                                <span className="rounded-md border border-amber-500/50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-400/90">
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

                {rail.phase === "error" && rail.errorReason ? (
                  <p className="text-xs text-red-400" data-testid="season-pass-error">
                    {mapSeasonPassError(rail.errorReason)}
                  </p>
                ) : null}

                <PrincipalButton
                  onClick={rail.pay}
                  disabled={busy}
                  className="mt-1"
                  data-testid="season-pass-pay"
                >
                  {payLabel}
                </PrincipalButton>

                {/* The picker right above already names the token, so the note
                    spends its line on what the buyer cannot see: this is a
                    one-off charge, not a subscription. */}
                <p className="text-[0.7rem] opacity-60" data-testid="season-pass-note">
                  {t("offerPriceNote")}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </VictoryPopupShell>
  );
}
