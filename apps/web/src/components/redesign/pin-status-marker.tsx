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
    // Pure-CSS dot (founder 2026-06-11): replaces the
    // punto-alerta-notificacion PNG so the marker costs zero network
    // and scales crisply at any DPR. Glossy red + cream ring lives in
    // `.action-pin-notif`.
    return <span aria-hidden="true" className="action-pin-notif" />;
  }
  return null;
}
