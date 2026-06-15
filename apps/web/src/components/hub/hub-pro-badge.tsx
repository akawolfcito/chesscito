"use client";

type Props = {
  /** PRO subscription state. The panel art swaps with the state
   *  (purple `bg-suscription` when inactive, all-gold
   *  `bg-suscription-pro` when active) and so does the sub-text below
   *  the "PRO" title:
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
 * Top-right Hub PRO entry point — a crowned subscription panel rendered
 * at HUD-corner scale. The frame art swaps with PRO state (purple
 * `bg-suscription` for the upsell, all-gold `bg-suscription-pro` once
 * active, founder 2026-06-15) and the sub-text below the "PRO" title
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

  // Subscription frame art (founder 2026-06-15): the panel now swaps with
  // PRO state — purple `bg-suscription` for the discovery/upsell state,
  // all-gold `bg-suscription-pro` once the subscription is active.
  const bgAsset = active ? "bg-suscription-pro" : "bg-suscription";

  const content = (
    <>
      <picture className="hub-pro-badge-bg">
        <source srcSet={`/art/hub/${bgAsset}.avif`} type="image/avif" />
        <source srcSet={`/art/hub/${bgAsset}.webp`} type="image/webp" />
        <img src={`/art/hub/${bgAsset}.png`} alt="" width={300} height={289} />
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
