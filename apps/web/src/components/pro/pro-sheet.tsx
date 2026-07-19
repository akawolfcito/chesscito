"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import type { ProStatus } from "@/lib/pro/use-pro-status";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { track } from "@/lib/telemetry";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { useThemeBackground } from "@/lib/themes/use-theme-background";

import { ProActiveBadge } from "./pro-active-badge";
import { ProActiveCTA } from "./pro-active-cta";

export type ProSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ProStatus | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isPurchasing: boolean;
  isVerifying: boolean;
  errorMessage: string | null;
  /** Non-null iff the last failure was a verify-failed (tx confirmed
   *  on-chain but /api/verify-pro returned non-200 or active=false).
   *  When set, the error region renders reassurance copy + a retry CTA
   *  bound to `onRetryVerify`. The hash is what the retry POSTs back to
   *  verify-pro — guarantees the same idempotent result the original
   *  flow would have produced. */
  verifyFailedTxHash?: string | null;
  isRetryingVerify?: boolean;
  onRetryVerify?: () => void;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
  onPurchase: () => void;
};

// Days math lives in @/lib/pro/days-remaining so this surface shares
// the same rounding semantics as the Hub PremiumSlot and Account row.

type CtaConfig = {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: (() => void) | undefined;
};

type ResolveCtaInput = Omit<ProSheetProps, "open" | "onOpenChange" | "errorMessage"> & {
  t: ReturnType<typeof useTranslations>;
};

function resolveCta({
  status,
  isConnected,
  isCorrectChain,
  isPurchasing,
  isVerifying,
  onConnectWallet,
  onSwitchNetwork,
  onPurchase,
  t,
}: ResolveCtaInput): CtaConfig {
  if (isPurchasing) {
    return { label: t("processingLabel"), loading: true, disabled: false, onClick: undefined };
  }
  if (isVerifying) {
    return { label: t("verifyingLabel"), loading: true, disabled: false, onClick: undefined };
  }
  if (!isConnected) {
    return {
      label: t("ctaConnectWallet"),
      loading: false,
      disabled: false,
      onClick: onConnectWallet,
    };
  }
  if (!isCorrectChain) {
    return {
      label: t("switchNetworkLabel"),
      loading: false,
      disabled: false,
      onClick: onSwitchNetwork,
    };
  }
  if (status?.active) {
    return {
      label: t("ctaRenew"),
      loading: false,
      disabled: false,
      onClick: onPurchase,
    };
  }
  return {
    label: t("ctaBuy"),
    loading: false,
    disabled: false,
    onClick: onPurchase,
  };
}

/** Bottom sheet that surfaces Chesscito PRO copy + the single CTA.
 *  All copy is driven by the PRO_COPY namespace via next-intl so QA
 *  can iterate strings without touching this component.
 *
 *  Active-state composition (addendum spec
 *  _bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md
 *  §3): <ProActiveBadge> shows ACTIVE/EXPIRING pill + counter;
 *  <ProActiveCTA source onClose> branches the CTA on the surface
 *  the sheet was opened from (`/arena` → "Got it" close-only,
 *  everywhere else → navigational "Play in Arena"). The sub-line
 *  copy is intentionally fixed; the legacy NEXT_PUBLIC_ENABLE_COACH
 *  branching is gone — Coach is shipped, no fallback copy needed. */
export function ProSheet(props: ProSheetProps) {
  const {
    open,
    onOpenChange,
    status,
    errorMessage,
    isConnected,
    isCorrectChain,
    verifyFailedTxHash = null,
    isRetryingVerify = false,
    onRetryVerify,
  } = props;
  const t = useTranslations("PRO_COPY");
  const subscriptionPanelBackground = useThemeBackground("pro-sheet.subscription-panel");
  const cta = resolveCta({ ...props, t });
  const router = useRouter();
  const showVerifyRetry = Boolean(errorMessage && verifyFailedTxHash && onRetryVerify);

  // Capture the surface that opened the sheet exactly once. Frozen for
  // the sheet's lifetime so a route change mid-sheet doesn't reshape
  // the active-state CTA underfoot. Falls back to "/" when no path is
  // available (e.g. tests rendering outside a router context).
  const livePathname = usePathname();
  const [source] = useState<string>(() => livePathname ?? "/");

  // Fire pro_card_viewed once per open. Reset the gate when the sheet
  // closes so the next open in the same session ships another event —
  // a user who opens the sheet, dismisses, and re-opens later is two
  // distinct view intents.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      viewedRef.current = false;
      return;
    }
    if (viewedRef.current) return;
    viewedRef.current = true;
    track("pro_card_viewed", { surface: "sheet", active: status?.active ?? false });
    // M1 funnel (Commit 5, 2026-06-01) — monetization-namespaced view
    // event so the PRO funnel rolls up alongside coach_paywall_view /
    // save_victory_* without disturbing the legacy pro_card_viewed
    // dashboards. Same one-per-open gate.
    track("monetization.pro_sheet_view", { active: status?.active ?? false });
  }, [open, status]);

  const showActiveBanner = Boolean(
    status?.active && status.expiresAt && status.expiresAt > Date.now(),
  );
  const days = daysRemaining(status?.expiresAt, Date.now());

  function handleCtaClick() {
    if (!cta.onClick) return;
    // Only buy/renew CTAs are commercial intent. Connect Wallet and
    // Switch Network are protocol prerequisites — not part of the PRO
    // funnel, so they don't ship pro_cta_clicked.
    if (isConnected && isCorrectChain && !props.isPurchasing && !props.isVerifying) {
      track("pro_cta_clicked", {
        source: status?.active ? "sheet_renew" : "sheet_buy",
      });
    }
    cta.onClick();
  }

  function openTrainingJournal() {
    track("pro_training_card_cta_tap", {
      surface: "pro_sheet",
      pro_active: Boolean(status?.active),
      wallet_connected: isConnected,
      cta: "training_journal",
    });
    onOpenChange(false);
    router.push("/coach/history");
  }

  const label = t("label");
  const journalLabel = t("activeActions.journal");
  const journalSubline = t("activeActions.journalSubline");
  const perks = t.raw("perksActive") as readonly string[];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={label}
        description={t("tagline")}
        /* border-t-0 suppresses the border-t the side="bottom" variant adds —
           it tints a stray blue-grey --border line over the transparent PRO
           panel; tailwind-merge keeps border-0 and border-t in separate groups
           so border-0 alone does not cancel it.
           z-[70] on both this panel and the overlay below: a purchase
           decision sheet must render ABOVE the persistent dock (z-60),
           unlike destination panels (badge/shop/trophies/leaderboard)
           that intentionally stay under it. Matches the z-[70]
           FailRescueModal already uses for the same reason. */
        className="z-[70] flex max-h-[95dvh] flex-col overflow-visible rounded-none border-0 border-t-0 bg-transparent p-0 pb-0 shadow-none"
        overlayClassName="z-[70]"
      >
        {/* Candy hero panel — bottom-sheet container becomes a
         *  transparent shell so the panel-suscription-pro.png asset
         *  paints the entire visual. Banner overflows above the panel's
         *  top edge via absolute positioning + overflow-visible on the
         *  sheet content. Shell is shared between active and non-active
         *  states — only the central card + CTA block branch on
         *  `showActiveBanner`. */}
        <div className="relative mx-auto flex w-full max-w-[var(--app-max-width)] flex-col overflow-y-auto overflow-x-visible overscroll-contain pt-[12%]">
          {/* Floating banner */}
          <ThemeAssetPicture slot="pro-sheet.header-icon" pictureClassName="pointer-events-none absolute left-1/2 top-0 z-20 w-[62%] -translate-x-1/2" alt="" aria-hidden="true" className="w-full" draggable={false} />

          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("closeLabel")}
            className="candy-close-asset-button absolute right-4 z-30"
            style={{ top: "8%" }}
            data-testid="pro-close"
          >
            <ThemeAssetPicture slot="shared.close" alt="" aria-hidden="true" className="h-10 w-10 object-contain" draggable={false} />
          </button>

          {/* Panel asset */}
          <div
            className="relative w-full"
            style={{
              backgroundImage: subscriptionPanelBackground,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="flex flex-col items-stretch px-[8%] pt-[16%] pb-[4%]">
              {/* TRAINING PASS pill */}
              <span
                data-testid="pro-kicker"
                className="self-start rounded-full px-3 py-1 text-nano font-extrabold uppercase tracking-wider"
                style={{
                  background:
                    "linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)",
                  color: "#fef3c7",
                  boxShadow: "0 2px 4px var(--shadow-warm-wood)",
                }}
              >
                {t("trainingPassLabel")}
              </span>

              {/* Title */}
              <h2
                className="mt-2 text-2xl font-extrabold leading-tight"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
                }}
              >
                {label}
              </h2>

              {/* Thin gold divider */}
              <div
                aria-hidden="true"
                className="mt-1.5 h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(217, 180, 74, 0.7) 20%, rgba(217, 180, 74, 0.7) 80%, transparent 100%)",
                }}
              />

              {/* Tagline (V1 brand headline) + subline */}
              <p
                className="mt-2 text-sm font-bold leading-snug"
                style={{ color: "rgba(110, 65, 15, 0.92)" }}
              >
                {t("tagline")}
              </p>
              <p
                className="mt-1 text-xs leading-snug"
                style={{ color: "rgba(110, 65, 15, 0.72)" }}
              >
                {t("taglineSub")}
              </p>

              {/* M1 funnel (Commit 5, 2026-06-01) — value-before-price.
               *  Perks pill + perks list render BEFORE the center card
               *  (price for inactive / ProActiveBadge for active) so the
               *  user sees what PRO delivers before what it costs.
               *  Buyers in the inactive state get the canonical M1 frame;
               *  active users see their PRO benefits anchored above the
               *  expiration badge. */}
              <span
                className="mt-3 self-start rounded-full px-2.5 py-0.5 text-nano font-extrabold uppercase tracking-wider"
                style={{
                  background:
                    "linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)",
                  color: "#fef3c7",
                  boxShadow: "0 2px 4px var(--shadow-warm-wood)",
                }}
              >
                {t("activePerksLabel")}
              </span>

              <ul
                className="mt-2 space-y-1 text-xs"
                style={{ color: "rgba(63, 34, 8, 0.90)" }}
              >
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold leading-none text-white"
                      style={{
                        background:
                          "linear-gradient(180deg, #22c55e 0%, #15803d 100%)",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.20)",
                      }}
                    >
                      ✓
                    </span>
                    <span className="leading-snug">{perk}</span>
                  </li>
                ))}
              </ul>

              {/* Center card — branches by subscription state.
               *  Non-active: the price card. The per-day equivalent that used
               *  to sit under it is gone (2026-07-13): it was clutter, and it
               *  was a hand-written derivative of $1.99/30 — the day PRO's
               *  price moves, a baked string like that lies without turning a
               *  single test red. `noAutoBillingLine` stays: it says something
               *  the price cannot.
               *  Active: ProActiveBadge + the extend/renew sub-line. */}
              {showActiveBanner && days !== null && status?.expiresAt ? (
                <div
                  data-testid="pro-active-banner"
                  className="mt-4 rounded-2xl border px-3 py-2"
                  style={{
                    background: "rgba(255, 245, 205, 0.55)",
                    borderColor: "rgba(110, 65, 15, 0.18)",
                  }}
                >
                  <div className="flex justify-center">
                    <ProActiveBadge expiresAtMs={status.expiresAt} />
                  </div>
                  {/* Always available while active — not gated by days
                   *  remaining. Regression fix 2026-07-02: the Shop's
                   *  old approve+buyItem PRO tile let a user top up at
                   *  ANY remaining balance; redirecting that tile to
                   *  this sheet (instead of retiring it outright) lost
                   *  that flexibility while this link was still gated
                   *  to daysLeft ≤ 7. PRO_COPY.expiringMicroCopy itself
                   *  was always calm/non-urgent copy ("Renew anytime to
                   *  keep training", Canon §11: no FOMO framing), so
                   *  showing it regardless of days left matches the
                   *  copy's own intent rather than fighting it. */}
                  <div
                    data-testid="pro-expiring-subline"
                    className="mt-2 flex items-baseline justify-between gap-2"
                  >
                    <span
                      className="text-xs leading-snug"
                      style={{ color: "rgba(110, 65, 15, 0.80)" }}
                    >
                      {t("expiringMicroCopy")}
                    </span>
                    <button
                      type="button"
                      data-testid="pro-extend-link"
                      onClick={() => {
                        track("pro_extend_tap", { source });
                        props.onPurchase();
                      }}
                      className="text-xs font-semibold underline underline-offset-2"
                      style={{ color: "rgba(110, 65, 15, 0.95)" }}
                    >
                      {t("ctaRenew")}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-4 rounded-2xl border px-3 py-2 text-center"
                  style={{
                    background: "rgba(255, 245, 205, 0.55)",
                    borderColor: "rgba(110, 65, 15, 0.18)",
                  }}
                >
                  <p
                    className="text-xl font-extrabold leading-tight"
                    style={{ color: "rgb(91, 33, 182)" }}
                  >
                    {t("priceLabel")}
                  </p>
                  <p
                    className="mt-0.5 text-nano"
                    style={{ color: "rgba(110, 65, 15, 0.65)" }}
                  >
                    {t("noAutoBillingLine", { duration: t("durationLabel") })}
                  </p>
                </div>
              )}

              {/* Error region (purchase / verify failures) */}
              {errorMessage && (
                <div
                  data-testid="pro-error"
                  role="alert"
                  className="mt-4 rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900"
                >
                  <p>{errorMessage}</p>
                  {showVerifyRetry && (
                    <>
                      <p
                        data-testid="pro-error-reassurance"
                        className="mt-1 text-xs font-medium text-rose-900/80"
                      >
                        {t("errors.verifyFailedReassurance")}
                      </p>
                      <button
                        type="button"
                        data-testid="pro-error-retry"
                        onClick={onRetryVerify}
                        disabled={isRetryingVerify}
                        className="mt-2 inline-flex items-center justify-center rounded-lg bg-rose-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-50 transition disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRetryingVerify
                          ? t("errors.retryingVerify")
                          : t("errors.retryVerifyCta")}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* CTA block — branches by state.
               *  Active: Journal card row (cream tile with book asset +
               *  title + subline + chevron) as the lesson re-entry,
               *  then ProActiveCTA (green PrincipalButton: Play in
               *  Arena / Got it) as the dominant green action.
               *  Non-active: single PrincipalButton "Unlock PRO" /
               *  "Connect wallet". */}
              {showActiveBanner ? (
                <div data-testid="pro-active-actions" className="mt-4 flex flex-col items-stretch gap-2">
                  <button
                    type="button"
                    onClick={openTrainingJournal}
                    aria-label={`${journalLabel} — ${journalSubline}`}
                    data-testid="pro-open-journal"
                    className="flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98]"
                    style={{
                      background: "rgba(255, 245, 205, 0.85)",
                      borderColor: "rgba(110, 65, 15, 0.18)",
                      boxShadow: "0 2px 6px rgba(63, 34, 8, 0.10)",
                    }}
                  >
                    <ThemeAssetPicture slot="pro-sheet.journal" pictureClassName="shrink-0" alt="" aria-hidden="true" className="h-14 w-14 object-contain" draggable={false} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-base font-extrabold leading-tight"
                        style={{ color: "rgba(63, 34, 8, 0.95)" }}
                      >
                        {journalLabel}
                      </p>
                      <p
                        className="mt-0.5 text-xs leading-snug"
                        style={{ color: "rgba(110, 65, 15, 0.78)" }}
                      >
                        {journalSubline}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-xl font-bold leading-none"
                      style={{ color: "rgba(110, 65, 15, 0.55)" }}
                    >
                      ›
                    </span>
                  </button>
                  <div data-testid="pro-active-cta">
                    <ProActiveCTA
                      source={source}
                      onClose={() => onOpenChange(false)}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex justify-center">
                  <PrincipalButton
                    size="medium"
                    loading={cta.loading}
                    disabled={cta.disabled}
                    onClick={handleCtaClick}
                    aria-label={cta.label}
                  >
                    {cta.label}
                  </PrincipalButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
