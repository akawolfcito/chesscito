type Props = {
  /** When false the slot shows the inactive CTA. When true it shows the
   *  Training Pass progress bar + sessions used. */
  active: boolean;
  usedSessions?: number;
  totalSessions?: number;
  /** Drives the `expiring` modifier when ≤ 3. */
  daysRemaining?: number;
  /** Adds the `recently-renewed` modifier on top of `active` for a 3s
   *  shimmer. The parent owns the timing — the primitive does not
   *  auto-clear. */
  recentlyRenewed?: boolean;
  /** Caller-supplied to keep the primitive decoupled from `editorial.ts`
   *  during the PRO Phase 0 baseline freeze (closes 2026-05-09). Once
   *  Story 4.3 lands `PRO_COPY.trainingPassLabel` post-freeze, the parent
   *  surface (Story 1.12 migration) wires it in. */
  kicker: string;
  inactiveCtaLabel: string;
  progressFormat: (usedSessions: number, totalSessions: number) => string;
  ariaLabel: string;
  onTap?: () => void;
  className?: string;
};

/** Right-edge Training Pass affordance. The home for PRO presence on the
 *  Hub. Adventure primitive — amber-gradient backplate + gold-shadow
 *  border + progress bar. Pure presentational; copy comes from the caller
 *  so the primitive stays out of the PRO Phase 0 measurement freeze. */
export function PremiumSlot({
  active,
  usedSessions = 0,
  totalSessions = 0,
  daysRemaining,
  recentlyRenewed = false,
  kicker,
  inactiveCtaLabel,
  progressFormat,
  ariaLabel,
  onTap,
  className = "",
}: Props) {
  const isExpiring = active && typeof daysRemaining === "number" && daysRemaining <= 3;
  const stateClass = active ? "is-active" : "is-inactive";
  const percent =
    totalSessions > 0
      ? Math.min(100, Math.max(0, (usedSessions / totalSessions) * 100))
      : 0;

  const classes = [
    "premium-slot",
    stateClass,
    isExpiring ? "is-expiring" : "",
    recentlyRenewed && active ? "is-recently-renewed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={ariaLabel}
      className={classes}
    >
      {active ? (
        <>
          <span className="premium-slot-kicker">{kicker}</span>
          <div
            data-testid="premium-slot-progress"
            className="premium-slot-progress"
            aria-hidden="true"
          >
            <div
              data-testid="premium-slot-progress-fill"
              className="premium-slot-progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="premium-slot-progress-label">
            {progressFormat(usedSessions, totalSessions)}
          </span>
        </>
      ) : (
        <span className="premium-slot-cta">{inactiveCtaLabel}</span>
      )}
    </button>
  );
}
