"use client";

import { useEffect, useRef } from "react";

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

/** Bottom sheet that surfaces Chesscito PRO copy + the single CTA.
 *  All copy is driven by PRO_COPY in editorial.ts so QA can iterate
 *  strings without touching this component.
 *
 *  Wired into play-hub-root in commit 6B.2. The purchase handler is
 *  passed in via `onPurchase` prop and is also the test injection
 *  point. */
export function ProSheet(props: ProSheetProps) {
  const { open, onOpenChange, status, errorMessage, isConnected, isCorrectChain } = props;
  const cta = resolveCta(props);

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
            ({PRO_COPY.durationLabel}, {PRO_COPY.subtitle.toLowerCase()})
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
            {errorMessage}
          </div>
        )}

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
