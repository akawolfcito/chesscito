/**
 * PinStatusMarker — shared status marker for the action pins and
 * pedestals above the dock (founder check/dot system 2026-06-11).
 *
 * `"done"`    → green check circle (action completed: saved, claimed,
 *               daily played, bridge beaten).
 * `"pending"` → pulsing red notification dot (action waiting for the
 *               player), same art as the kingdom reward rail.
 *
 * Host element must be `position: relative`; the marker anchors to its
 * top-right corner via the `.action-pin-status` geometry.
 */

export type PinStatus = "done" | "pending";

const NOTIF_DOT_SRC = "/art/scene-rooted/punto-alerta-notificacion";

export function PinStatusMarker({ status }: { status: PinStatus | null }) {
  if (status === "done") {
    return (
      <span
        aria-hidden="true"
        className="action-pin-status action-pin-status--done"
      >
        ✓
      </span>
    );
  }
  if (status === "pending") {
    return (
      <picture className="action-pin-notif">
        <source srcSet={`${NOTIF_DOT_SRC}.avif`} type="image/avif" />
        <source srcSet={`${NOTIF_DOT_SRC}.webp`} type="image/webp" />
        <img
          src={`${NOTIF_DOT_SRC}.png`}
          alt=""
          aria-hidden="true"
        />
      </picture>
    );
  }
  return null;
}
