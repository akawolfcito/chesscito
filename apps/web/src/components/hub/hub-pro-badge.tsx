"use client";

type Props = {
  /** PRO subscription state. Both variants render the SAME panel
   *  art (purple frame + crown from `panel-pro.png`) — only the
   *  layered sub-text below the "PRO" title swaps:
   *    - inactive: short promotional kicker ("Unlock the full
   *      experience"-style, supplied by `sublineInactive`).
   *    - active:   the days-remaining label in large type so the
   *      remaining-time value is legible at a glance. */
  active: boolean;
  daysRemaining?: number;
  /** Accessible name — supplied by the parent so the copy stays in
   *  editorial.ts (HUD_COPY.proAriaLabel / proInactiveAriaLabel). */
  ariaLabel: string;
  /** Formatted days suffix for the active state (e.g. "7d"). Parent
   *  derives via `HUD_COPY.proRemainingFormat`. */
  daysLabel?: string;
  /** Inactive-state promo subline. Parent supplies via
   *  `HUB_ACTION_RAIL_COPY.proDiscoverySubtitle` so the copy stays in
   *  editorial. */
  sublineInactive?: string;
  onClick?: () => void;
};

/**
 * Top-right Hub PRO entry point — same purple panel art (`panel-pro.png`,
 * frame + crown) the old wide right-rail discovery panel used, just
 * rendered at HUD-corner scale. The art stays consistent across states
 * so PRO is recognizable; only the sub-text below the "PRO" title
 * swaps between the inactive promo kicker and the active days-remaining
 * count.
 *
 * Replaces:
 *   - the inline `<HudResourceChip tone="pro">` in the HUD top row
 *     (collapsed to null when inactive, leaving the corner empty), and
 *   - the wide `<HubProDiscoveryPanel>` above the right-rail action
 *     tiles (Daily / Mate / Coach).
 *
 * Both variants render as a single tappable surface (button) when
 * `onClick` is wired; otherwise it renders as a non-interactive
 * `role="status"` element.
 */
export function HubProBadge({
  active,
  daysRemaining,
  ariaLabel,
  daysLabel,
  sublineInactive,
  onClick,
}: Props) {
  const className = [
    "hub-pro-badge",
    active ? "hub-pro-badge--active" : "hub-pro-badge--inactive",
  ].join(" ");

  const subline =
    active && daysRemaining !== undefined && daysLabel
      ? daysLabel
      : sublineInactive;

  const content = (
    <>
      <picture className="hub-pro-badge-bg" aria-hidden="true">
        <source srcSet="/art/hub/panel-pro.avif" type="image/avif" />
        <source srcSet="/art/hub/panel-pro.webp" type="image/webp" />
        <img src="/art/hub/panel-pro.png" alt="" />
      </picture>
      <span className="hub-pro-badge-content" aria-hidden="true">
        <span className="hub-pro-badge-title">PRO</span>
        {subline && <span className="hub-pro-badge-sub">{subline}</span>}
      </span>
    </>
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
