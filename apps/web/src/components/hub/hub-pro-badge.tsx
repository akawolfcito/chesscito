"use client";

type Props = {
  /** PRO subscription state. When active, the badge renders the
   *  days-remaining count below the "PRO" tag in large type. When
   *  inactive, only the "PRO" tag renders — the badge becomes the
   *  promotional discovery CTA at the top-right corner. */
  active: boolean;
  daysRemaining?: number;
  /** Accessible name — supplied by the parent so the copy stays in
   *  editorial.ts (HUD_COPY.proAriaLabel / proInactiveAriaLabel). */
  ariaLabel: string;
  /** Suffix to render under the "PRO" line when `active === true`
   *  (e.g. "7d"). Parent formats via `HUD_COPY.proRemainingFormat`
   *  so the locale rule lives in editorial, not here. */
  daysLabel?: string;
  onClick?: () => void;
};

/**
 * Top-right Hub badge for the PRO entry point. Replaces both:
 *  - the inline `<HudResourceChip tone="pro">` (which collapsed to
 *    `null` when inactive, leaving the corner empty), and
 *  - the wide `<HubProDiscoveryPanel>` that sat above the right-rail
 *    action tiles (Daily / Mate / Coach).
 *
 * Two visual variants, same component contract:
 *   1. `active === false` → compact single-line "PRO" pill, amber.
 *   2. `active === true`  → stacked 2-line badge — "PRO" / "Xd"
 *      with the days count rendered in large type so the value is
 *      legible at a glance.
 *
 * Stays on the right edge of the HUD top row via the
 * `.hub-scaffold-hud-right` flex group (see `globals.css`). The
 * promotional discovery copy from the old wide panel ("Unlock the
 * full experience") moves into the badge's tooltip / aria-label —
 * the corner real estate doesn't fit a sub-line cleanly.
 */
export function HubProBadge({
  active,
  daysRemaining,
  ariaLabel,
  daysLabel,
  onClick,
}: Props) {
  const className = [
    "hub-pro-badge",
    active ? "hub-pro-badge--active" : "hub-pro-badge--inactive",
  ].join(" ");

  const content = active ? (
    <>
      <span className="hub-pro-badge-tag">PRO</span>
      {daysRemaining !== undefined && daysLabel && (
        <span className="hub-pro-badge-days">{daysLabel}</span>
      )}
    </>
  ) : (
    <span className="hub-pro-badge-tag">PRO</span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <span role="status" aria-label={ariaLabel} className={className}>
      {content}
    </span>
  );
}
