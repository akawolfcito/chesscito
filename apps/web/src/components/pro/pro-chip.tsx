"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import type { ProStatus } from "@/lib/pro/use-pro-status";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { track } from "@/lib/telemetry";

export type ProChipProps = {
  status: ProStatus | null;
  isLoading: boolean;
  onClick: () => void;
};

/** Floating chip rendered absolute top-right inside the play-hub
 *  `<main>` shell. Always visible — single tap opens <ProSheet>.
 *
 *  - 28px tall, 64–120px wide. Below the dock z-index, above the HUD.
 *  - Skeleton shimmer while loading so the slot footprint is stable.
 *  - Inactive: gold→amber gradient with "PRO" label (intentionally not
 *    "GET PRO" — the chip surfaces the tier, not the sale).
 *  - Active: purple→violet gradient with "PRO • Nd" or "Expires today".
 *
 *  Wired into the play-hub root in commit 6B.2. */
/** M1 funnel (Commit 6, 2026-06-02) — chip uses the same days threshold
 *  as the ProSheet expiring sub-line so both surfaces light up
 *  in lock-step the week before expiry. */
const CHIP_EXPIRING_THRESHOLD_DAYS = 7;

export function ProChip({ status, isLoading, onClick }: ProChipProps) {
  const t = useTranslations("PRO_COPY");
  const label = t("label");

  function formatDaysLeft(expiresAt: number): string {
    const days = daysRemaining(expiresAt, Date.now());
    if (days == null || days <= 1) {
      return t("statusActiveSuffix", { daysLeft: 1 });
    }
    return `${days}d`;
  }

  // Fire pro_card_viewed once per mount, after status has resolved.
  // The ref prevents the throttle from being load-bearing — even if the
  // chip re-renders 50× during a session, the event ships exactly once.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    if (isLoading || status === null) return;
    viewedRef.current = true;
    track("pro_card_viewed", { surface: "chip", active: status.active });
    // M1 funnel (Commit 6) — monetization-namespaced clone with the
    // canonical daysRemaining payload. Same one-per-mount gate.
    const chipDays =
      status.active ? daysRemaining(status.expiresAt, Date.now()) : null;
    track("monetization.pro_chip_view", {
      active: status.active,
      daysRemaining: chipDays,
    });
  }, [isLoading, status]);

  function handleClick() {
    track("pro_cta_clicked", { source: "chip" });
    // M1 funnel (Commit 6) — parallels the legacy event so the funnel
    // sees taps without disturbing existing dashboards.
    const chipDays =
      status?.active ? daysRemaining(status.expiresAt, Date.now()) : null;
    track("monetization.pro_chip_tap", {
      active: Boolean(status?.active),
      daysRemaining: chipDays,
    });
    onClick();
  }

  const isActive = Boolean(status?.active && status.expiresAt && status.expiresAt > Date.now());
  const showLoading = isLoading && status === null;
  const activeDays = isActive
    ? daysRemaining(status?.expiresAt ?? null, Date.now())
    : null;
  const isExpiringSoon =
    activeDays != null && activeDays <= CHIP_EXPIRING_THRESHOLD_DAYS;

  const baseClasses =
    "pointer-events-auto flex h-7 min-w-[64px] max-w-[120px] items-center justify-center gap-1 rounded-full px-2.5 text-xs font-bold uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.35)] transition active:scale-[0.97]";

  if (showLoading) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        aria-label={label}
        className={`${baseClasses} animate-pulse bg-white/30 text-transparent`}
      >
        <span className="opacity-0">PRO</span>
      </button>
    );
  }

  if (isActive && status?.expiresAt) {
    // M1 funnel (Commit 6) — when expiring (≤ 7 days), surface the
    // long-form aria so screen readers hear the timing without
    // requiring the visible "Nd" suffix to spell it out.
    const ariaLabel = isExpiringSoon && activeDays != null
      ? t("chipExpiringAriaLabel", { daysLeft: activeDays })
      : t("chipActiveAriaLabel", { label });
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        className={`${baseClasses} bg-gradient-to-r from-[rgb(120,80,200)] to-[rgb(160,80,220)] text-white`}
        data-expiring={isExpiringSoon ? "true" : undefined}
      >
        <span aria-hidden="true">★</span>
        <span>{t("chip.activePrefix")} • {formatDaysLeft(status.expiresAt)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("chipGetAriaLabel", { label })}
      className={`${baseClasses} bg-gradient-to-r from-[rgb(255,200,80)] to-[rgb(255,160,40)] text-[rgb(80,40,5)]`}
    >
      <span aria-hidden="true">✦</span>
      <span>{t("chip.inactive")}</span>
    </button>
  );
}
