"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ComingSoonChip } from "@/components/ui/coming-soon-chip";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { PRO_COPY } from "@/lib/content/editorial";
import type { ProStatus } from "@/lib/pro/use-pro-status";
import { track } from "@/lib/telemetry";

import { ProActiveBadge } from "./pro-active-badge";
import { ProActiveCTA } from "./pro-active-cta";

const EXPIRING_THRESHOLD_DAYS = 3;

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysLeft(expiresAt: number): number {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / MS_PER_DAY));
}

type CtaConfig = {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: (() => void) | undefined;
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
}: Omit<ProSheetProps, "open" | "onOpenChange" | "errorMessage">): CtaConfig {
  if (isPurchasing) {
    return { label: "Processing…", loading: true, disabled: false, onClick: undefined };
  }
  if (isVerifying) {
    return { label: "Verifying…", loading: true, disabled: false, onClick: undefined };
  }
  if (!isConnected) {
    return {
      label: PRO_COPY.errors.walletRequired,
      loading: false,
      disabled: false,
      onClick: onConnectWallet,
    };
  }
  if (!isCorrectChain) {
    return {
      label: "Switch Network",
      loading: false,
      disabled: false,
      onClick: onSwitchNetwork,
    };
  }
  if (status?.active) {
    return {
      label: PRO_COPY.ctaRenew,
      loading: false,
      disabled: false,
      onClick: onPurchase,
    };
  }
  return {
    label: PRO_COPY.ctaBuy,
    loading: false,
    disabled: false,
    onClick: onPurchase,
  };
}

/** Bottom sheet that surfaces Chesscito PRO copy + the single CTA.
 *  All copy is driven by PRO_COPY in editorial.ts so QA can iterate
 *  strings without touching this component.
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
  const cta = resolveCta(props);
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
  }, [open, status]);

  const showActiveBanner = Boolean(
    status?.active && status.expiresAt && status.expiresAt > Date.now(),
  );
  const days = status?.expiresAt ? daysLeft(status.expiresAt) : null;

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={PRO_COPY.label}
        description={PRO_COPY.tagline}
        className="mission-shell sheet-bg-shop flex max-h-[90dvh] flex-col rounded-t-2xl border-0 pb-[5rem]"
      >
        {/* Header strip — kicker "Training Pass" eyebrow above the
         *  canonical close-control header. The kicker keeps its
         *  data-testid="pro-kicker" and DOM order before the title
         *  (asserted by pro-sheet.test.tsx AC-3.8). The tagline (long,
         *  exceeds the 32-char subtitle cap) moves below the strip as
         *  the first body element. */}
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <p
            data-testid="pro-kicker"
            className="text-nano font-bold uppercase tracking-wider px-4 pt-1"
            style={{ color: "rgba(110, 65, 15, 0.55)" }}
          >
            {PRO_COPY.kicker}
          </p>
          <ContextualHeader
            variant="close-control"
            title={PRO_COPY.label}
            close={{ onClick: () => onOpenChange(false), label: "Close PRO" }}
          />
        </div>

        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-contain pt-3">
        <p
          className="text-sm"
          style={{ color: "rgba(110, 65, 15, 0.70)" }}
        >
          {PRO_COPY.tagline}
        </p>

        {!showActiveBanner && (
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="text-2xl font-bold"
              style={{ color: "rgba(110, 65, 15, 0.95)" }}
            >
              {PRO_COPY.priceLabel}
            </span>
            <span className="text-xs" style={{ color: "rgba(110, 65, 15, 0.65)" }}>
              ({PRO_COPY.durationLabel} · no auto-billing)
            </span>
          </div>
        )}

        {showActiveBanner && days !== null && status?.expiresAt && (
          <div data-testid="pro-active-banner" className="mt-3">
            <ProActiveBadge expiresAtMs={status.expiresAt} />
            {days <= EXPIRING_THRESHOLD_DAYS && (
              <div
                data-testid="pro-expiring-subline"
                className="mt-2 flex items-baseline justify-between gap-2"
              >
                <span
                  className="text-xs leading-snug"
                  style={{ color: "rgba(110, 65, 15, 0.80)" }}
                >
                  {PRO_COPY.expiringMicroCopy}
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
                  {PRO_COPY.ctaRenew}
                </button>
              </div>
            )}
          </div>
        )}

        {showActiveBanner && (
          <div data-testid="pro-active-actions" className="mt-3 space-y-2">
            <div
              className="rounded-xl border px-3 py-3"
              style={{
                borderColor: "rgba(110, 65, 15, 0.18)",
                background: "rgba(255, 245, 205, 0.42)",
              }}
            >
              <button
                type="button"
                data-testid="pro-open-journal"
                onClick={openTrainingJournal}
                className="w-full rounded-xl px-3 py-3 text-sm font-black uppercase tracking-wide"
                style={{
                  color: "#fff2bf",
                  background: "linear-gradient(180deg, #965918 0%, #764207 100%)",
                  textShadow: "0 2px 0 rgba(68, 37, 5, 0.70)",
                }}
              >
                {PRO_COPY.activeActions.journal}
              </button>
              <p
                className="mt-2 text-xs leading-snug"
                style={{ color: "rgba(110, 65, 15, 0.76)" }}
              >
                {PRO_COPY.activeActions.journalSubline}
              </p>
            </div>
            <div data-testid="pro-active-cta">
              <ProActiveCTA
                source={source}
                onClose={() => onOpenChange(false)}
              />
            </div>
          </div>
        )}

        {!showActiveBanner && (
          <div className="mt-4">
            <p
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: "rgba(110, 65, 15, 0.85)" }}
            >
              Active perks
            </p>
            <ul className="mt-1 space-y-1 text-sm" style={{ color: "rgba(110, 65, 15, 0.90)" }}>
              {PRO_COPY.perksActive.map((perk) => (
                <li key={perk} className="flex items-start gap-2">
                  <span aria-hidden="true">✓</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {errorMessage && (
          <div
            data-testid="pro-error"
            role="alert"
            className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900"
          >
            <p>{errorMessage}</p>
            {showVerifyRetry && (
              <>
                <p
                  data-testid="pro-error-reassurance"
                  className="mt-1 text-xs font-medium text-rose-900/80"
                >
                  {PRO_COPY.errors.verifyFailedReassurance}
                </p>
                <button
                  type="button"
                  data-testid="pro-error-retry"
                  onClick={onRetryVerify}
                  disabled={isRetryingVerify}
                  className="mt-2 inline-flex items-center justify-center rounded-lg bg-rose-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-50 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetryingVerify
                    ? PRO_COPY.errors.retryingVerify
                    : PRO_COPY.errors.retryVerifyCta}
                </button>
              </>
            )}
          </div>
        )}
        </div>

        {!showActiveBanner && (
          <div className="mt-auto flex justify-center pt-4">
            <PrincipalButton
              size="large"
              loading={cta.loading}
              disabled={cta.disabled}
              onClick={handleCtaClick}
              aria-label={cta.label}
            >
              {cta.label}
            </PrincipalButton>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
