import { CandyIcon } from "@/components/redesign/candy-icon";
import { REWARD_COPY } from "@/lib/content/editorial";

export type RewardTileId = keyof typeof REWARD_COPY;
export type RewardTileState = "claimable" | "progress" | "locked";

export type RewardTile = {
  id: RewardTileId;
  state: RewardTileState;
  /** Fires on tile tap regardless of state. The parent decides what to do
   *  per state (claim flow for `claimable`, unlock-hint sheet for `locked`). */
  onTap?: () => void;
};

type Props = {
  tiles: RewardTile[];
  className?: string;
};

const VISIBLE_LIMIT = 3;

/** Vertical reward stack rendered on the Hub left edge. Adventure primitive
 *  showing up to 3 reward tiles (claimable / progress / locked) plus an
 *  overflow indicator when more exist. Tiles are presentational buttons —
 *  copy + aria-labels live in `editorial.ts.REWARD_COPY` (single-source). */
export function RewardColumn({ tiles, className = "" }: Props) {
  if (tiles.length === 0) {
    return null;
  }

  const visible = tiles.slice(0, VISIBLE_LIMIT);
  const hasOverflow = tiles.length > VISIBLE_LIMIT;

  return (
    <div className={`reward-column ${className}`.trim()}>
      {visible.map((tile) => (
        <RewardTileButton key={tile.id} tile={tile} />
      ))}
      {hasOverflow ? (
        <span
          data-testid="reward-column-overflow"
          aria-hidden="true"
          className="reward-column-overflow"
        >
          …
        </span>
      ) : null}
    </div>
  );
}

function RewardTileButton({ tile }: { tile: RewardTile }) {
  const copy = REWARD_COPY[tile.id];
  const classes = [
    "reward-tile",
    `is-${tile.state}`,
  ].join(" ");

  return (
    <button
      type="button"
      onClick={tile.onTap}
      aria-label={copy.ariaLabel(tile.state)}
      className={classes}
    >
      <span className="reward-tile-label">{copy.label}</span>
      {tile.state === "claimable" ? (
        <span
          data-testid="reward-tile-notif"
          aria-hidden="true"
          className="reward-tile-notif"
        />
      ) : null}
      {tile.state === "locked" ? (
        <CandyIcon name="lock" className="reward-tile-lock" />
      ) : null}
    </button>
  );
}
