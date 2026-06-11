/**
 * HubTileStatusChip — compact availability signal for the hub
 * right-rail tiles (founder micro-block 2026-06-11).
 *
 * STATIC by contract: rendered once from mount-time state, no timers,
 * no live countdown, no costly animation. Two forms:
 *  - dot   → tiny green sphere, "this is ready for you".
 *  - label → one short word/phrase pill ("Next 6h", "Tomorrow",
 *            "PRO", "Ask").
 */

type Props =
  | { kind: "ready" }
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
