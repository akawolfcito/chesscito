/**
 * HubTileStatusChip — compact availability signal for the hub
 * right-rail tiles (founder micro-block 2026-06-11).
 *
 * STATIC by contract: rendered once from mount-time state, no timers,
 * no live countdown, no costly animation. Three forms:
 *  - dot ("ready") → tiny green sphere, "this is ready for you".
 *  - dot ("new")   → same visual token, reused for "you have not
 *                    opened this since it unlocked" (milestone-driven).
 *  - label         → one short word/phrase pill ("Next 6h", "Tomorrow",
 *                    "PRO", "Ask").
 */

type Props =
  | { kind: "ready" }
  | { kind: "new" }
  | { kind: "label"; text: string };

export function HubTileStatusChip(props: Props) {
  if (props.kind === "ready") {
    return (
      <span
        aria-hidden="true"
        data-testid="hub-tile-status"
        data-status="ready"
        className="hub-tile-status-dot"
      />
    );
  }
  if (props.kind === "new") {
    // Reuses the SAME dot token as `ready` — this is not a new visual
    // family, just a different meaning gated by milestone `openedAt`
    // instead of a static "this exists" flag. Own testid because it
    // answers a different question than `hub-tile-status` ("has this
    // never been opened") and callers need to assert it independently.
    return (
      <span
        aria-hidden="true"
        data-testid="hub-tile-new"
        data-status="new"
        className="hub-tile-status-dot"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-testid="hub-tile-status"
      data-status="label"
      className="hub-tile-status-chip"
    >
      {props.text}
    </span>
  );
}
