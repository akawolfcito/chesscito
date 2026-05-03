"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PRO_COPY } from "@/lib/content/editorial";
import type { ProStatus } from "@/lib/pro/use-pro-status";
import { track } from "@/lib/telemetry";

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
  variant: "game-primary" | "game-ghost";
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
    return { label: "Processing…", variant: "game-primary", disabled: true, onClick: undefined };
  }
  if (isVerifying) {
    return { label: "Verifying…", variant: "game-primary", disabled: true, onClick: undefined };
  }
  if (!isConnected) {
    return {
      label: PRO_COPY.errors.walletRequired,
      variant: "game-ghost",
      disabled: false,
      onClick: onConnectWallet,
    };
  }
  if (!isCorrectChain) {
    return {
      label: "Switch Network",
      variant: "game-ghost",
      disabled: false,
      onClick: onSwitchNetwork,
    };
  }
  if (status?.active) {
    return {
      label: PRO_COPY.ctaRenew,
      variant: "game-ghost",
      disabled: false,
      onClick: onPurchase,
    };
  }
  return {
    label: PRO_COPY.ctaBuy,
    variant: "game-primary",
    disabled: false,
    onClick: onPurchase,
  };
}

/** Returns true unless the env var is explicitly "false". Mirrors the
 *  arena/page.tsx pattern. Read at render time (not module load) so
 *  vi.stubEnv can flip it per test. */
function isCoachEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_COACH !== "false";
}

/** Bottom sheet that surfaces Chesscito PRO copy + the single CTA.
 *  All copy is driven by PRO_COPY in editorial.ts so QA can iterate
 *  strings without touching this component.
 *
 *  Wired into play-hub-root in commit 6B.2. The purchase handler is
 *  passed in via `onPurchase` prop and is also the test injection
 *  point.
 *
 *  Active-state post-purchase CTA (commit 1 of stabilization sprint
 *  2026-05-02): when PRO is currently active, surfaces a "Play Arena"
 *  button + helper copy so the user has a concrete next action. The
 *  helper copy adapts to NEXT_PUBLIC_ENABLE_COACH so we never promise
 *  Coach access we cannot deliver. */
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mission-shell sheet-bg-shop flex max-h-[90dvh] flex-col rounded-t-2xl border-0 pb-[5rem]"
      >
        <SheetHeader className="text-left">
          <SheetTitle
            className="fantasy-title flex items-center gap-2"
            style={{ color: "rgba(110, 65, 15, 0.95)" }}
          >
            {PRO_COPY.label}
          </SheetTitle>
          <SheetDescription style={{ color: "rgba(110, 65, 15, 0.70)" }}>
            {PRO_COPY.tagline}
          </SheetDescription>
        </SheetHeader>

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

        {showActiveBanner && days !== null && (
          <div
            data-testid="pro-active-banner"
            className="mt-3 rounded-xl bg-emerald-100/80 px-3 py-2 text-sm font-semibold text-emerald-900"
          >
            {PRO_COPY.ctaActive} — {PRO_COPY.statusActiveSuffix(days)}
          </div>
        )}

        {showActiveBanner && (
          <div
            data-testid="pro-active-cta"
            className="mt-3 flex flex-col gap-2 rounded-xl bg-white/55 px-3 py-3"
          >
            <Button
              type="button"
              variant="game-primary"
              size="game"
              onClick={() => router.push("/arena")}
            >
              {PRO_COPY.activeStateCta}
            </Button>
            <p
              className="text-xs leading-snug"
              style={{ color: "rgba(110, 65, 15, 0.80)" }}
            >
              {isCoachEnabled()
                ? PRO_COPY.activeStateCopyEnabled
                : PRO_COPY.activeStateCopyDisabled}
            </p>
          </div>
        )}

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

        <div className="mt-3" data-testid="pro-roadmap">
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: "rgba(110, 65, 15, 0.55)" }}
          >
            Coming later
          </p>
          <ul className="mt-1 space-y-1 text-sm opacity-60" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
            {PRO_COPY.perksRoadmap.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <span aria-hidden="true">·</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>

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

        <p
          data-testid="pro-mission-note"
          className="mt-4 text-xs leading-relaxed"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          {PRO_COPY.missionNote}
        </p>

        <div className="mt-auto pt-4">
          <Button
            type="button"
            variant={cta.variant}
            size="game"
            disabled={cta.disabled}
            onClick={handleCtaClick}
          >
            {cta.label}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
