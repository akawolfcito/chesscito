"use client";

type Props = {
  /** PRO subscription state. The chip art swaps with the state (purple
   *  `pro-chip-inactive` when inactive, all-gold `pro-chip-active` when
   *  active) and so does the floating foot label:
   *    - inactive: a one-word upsell kicker ("Unlock", supplied by
   *      `sublineInactive`).
   *    - active:   the days-remaining value ("7d"). */
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
 * Top-right Hub PRO entry point — a crowned subscription chip rendered at
 * HUD-corner scale. The art swaps with PRO state (purple
 * `pro-chip-inactive` for the upsell, all-gold `pro-chip-active` once
 * active) and the copy rides as a floating label pinned to the chip's foot
 * — it overlaps the chip base rather than growing the slot, so the HUD row
 * height is the same in both states.
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

  // Chip art (founder 2026-07-13): the crowned "PRO" wordmark is baked into
  // the sprite — purple `pro-chip-inactive` for the upsell, all-gold
  // `pro-chip-active` once the subscription is live. The DOM carries no "PRO"
  // text of its own; the accessible name comes from `ariaLabel`.
  const bgAsset = active ? "pro-chip-active" : "pro-chip-inactive";

  const content = (
    <>
      <picture className="hub-pro-badge-bg">
        <source srcSet={`/art/hub/${bgAsset}.avif`} type="image/avif" />
        <source srcSet={`/art/hub/${bgAsset}.webp`} type="image/webp" />
        <img src={`/art/hub/${bgAsset}.png`} alt="" width={600} height={351} />
      </picture>
      {subline && (
        <span className="hub-pro-badge-label" aria-hidden="true">
          {subline}
        </span>
      )}
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
