import { PRO_COPY } from "@/lib/content/editorial";

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

export function ProActiveBadge({
  expiresAtMs,
  nowMs = Date.now(),
}: ProActiveBadgeProps) {
  const daysLeft = computeDaysLeft(expiresAtMs, nowMs);
  const isExpiring = daysLeft <= EXPIRING_THRESHOLD_DAYS;

  const pillLabel = isExpiring
    ? PRO_COPY.statusBadgeExpiring
    : PRO_COPY.statusBadgeActive;
  const pillClasses = isExpiring
    ? "bg-amber-500 text-white"
    : "bg-emerald-500 text-white";

  return (
    <div className="flex items-center gap-2">
      <span
        data-testid="pro-active-badge-pill"
        className={`rounded-full px-2 py-0.5 text-nano font-bold uppercase tracking-wider ${pillClasses}`}
      >
        {pillLabel}
      </span>
      <span aria-hidden="true" className="text-foreground/40">
        ·
      </span>
      <span
        data-testid="pro-active-badge-counter"
        className={`text-sm ${isExpiring ? "font-bold" : ""}`}
        style={{ color: "rgba(110, 65, 15, 0.95)" }}
      >
        {PRO_COPY.statusActiveSuffix(daysLeft)}
      </span>
    </div>
  );
}
