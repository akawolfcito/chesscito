import { PRO_COPY } from "@/lib/content/editorial";
import { GemBadge } from "@/components/scene-rooted/gem";
import { CandyIcon } from "@/components/redesign/candy-icon";

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

  return (
    <div className="flex items-center gap-2">
      {/* Wrapper span carries the testid + decorative state attribute
          per the M3.5 wrapper-span pattern, so test contracts survive
          primitive swaps. The diegetic gem itself doesn't bear the
          testid because it's a shared primitive. */}
      <span
        data-testid="pro-active-badge-pill"
        data-state={isExpiring ? "expiring" : "active"}
        className="inline-flex"
      >
        <GemBadge
          tone={isExpiring ? "warning" : "success"}
          icon={<CandyIcon name="star" className="h-3 w-3" />}
          value={pillLabel}
        />
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
