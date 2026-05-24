"use client";

import { useTranslations } from "next-intl";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRING_THRESHOLD_DAYS = 3;

export interface ProActiveBadgeProps {
  /** ISO ms timestamp when PRO entitlement expires. */
  expiresAtMs: number;
  /** Reference timestamp. Defaults to `Date.now()`. Injected by tests. */
  nowMs?: number;
}

function computeDaysLeft(expiresAtMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((expiresAtMs - nowMs) / MS_PER_DAY));
}

/**
 * Compact CSS-only badge that surfaces the PRO entitlement state inside
 * the candy panel. Replaces the legacy `<GemBadge>` asset variant so the
 * pill stays small (no chunky teal stone) and proportional to the
 * "days left" suffix. Tone flips amber when ≤ 3 days remain.
 */
export function ProActiveBadge({
  expiresAtMs,
  nowMs = Date.now(),
}: ProActiveBadgeProps) {
  const t = useTranslations("PRO_COPY");
  const daysLeft = computeDaysLeft(expiresAtMs, nowMs);
  const isExpiring = daysLeft <= EXPIRING_THRESHOLD_DAYS;

  const pillLabel = isExpiring
    ? t("statusBadgeExpiring")
    : t("statusBadgeActive");

  const pillGradient = isExpiring
    ? "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)"
    : "linear-gradient(180deg, #22c55e 0%, #15803d 100%)";

  return (
    <div className="flex items-center gap-2">
      <span
        data-testid="pro-active-badge-pill"
        data-state={isExpiring ? "expiring" : "active"}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider"
        style={{
          background: pillGradient,
          color: "#ffffff",
          boxShadow:
            "0 1px 2px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
          textShadow: "0 1px 1px rgba(0, 0, 0, 0.25)",
        }}
      >
        <span aria-hidden="true">★</span>
        <span>{pillLabel}</span>
      </span>
      <span
        data-testid="pro-active-badge-counter"
        className={`text-sm ${isExpiring ? "font-bold" : "font-semibold"}`}
        style={{ color: "rgba(110, 65, 15, 0.95)" }}
      >
        {t("statusActiveSuffix", { daysLeft })}
      </span>
    </div>
  );
}
