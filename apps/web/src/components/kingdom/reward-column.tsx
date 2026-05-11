import { CandyIcon } from "@/components/redesign/candy-icon";
import { PIECE_LABELS, REWARD_COPY } from "@/lib/content/editorial";

export type RewardTileId = keyof typeof REWARD_COPY;
export type RewardTileState = "claimed" | "claimable" | "progress" | "locked";

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

const PIECE_TILE_IDS = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;

function isPieceTile(id: RewardTileId): id is (typeof PIECE_TILE_IDS)[number] {
  return (PIECE_TILE_IDS as readonly string[]).includes(id);
}

/** Vertical reward stack rendered on the Hub left edge. Adventure primitive
 *  showing reward tiles (claimable / progress / locked). Tiles are presentational buttons —
 *  copy + aria-labels live in `editorial.ts.REWARD_COPY` (single-source). */
export function RewardColumn({ tiles, className = "" }: Props) {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <div className={`reward-column ${className}`.trim()}>
      {tiles.map((tile) => (
        <RewardTileButton key={tile.id} tile={tile} />
      ))}
    </div>
  );
}

function RewardTileButton({ tile }: { tile: RewardTile }) {
  const copy = REWARD_COPY[tile.id];
  const label = isPieceTile(tile.id) ? PIECE_LABELS[tile.id] : copy.label;
  const ariaState: Exclude<RewardTileState, "claimed"> =
    tile.state === "claimed" ? "progress" : tile.state;
  const classes = [
    "reward-tile",
    `is-${tile.state}`,
    tile.state === "progress" || tile.state === "claimable"
      ? "is-active-piece"
      : "",
  ].join(" ");

  return (
    <button
      type="button"
      onClick={tile.onTap}
      aria-label={copy.ariaLabel(ariaState)}
      className={classes}
    >
      <span className="reward-tile-label">{label}</span>
      {isPieceTile(tile.id) ? (
        <picture className="reward-tile-piece" aria-hidden="true">
          <source srcSet={`/art/redesign/pieces/w-${tile.id}.avif`} type="image/avif" />
          <source srcSet={`/art/redesign/pieces/w-${tile.id}.webp`} type="image/webp" />
          <img src={`/art/redesign/pieces/w-${tile.id}.png`} alt="" />
        </picture>
      ) : (
        <CandyIcon name="trophy" className="reward-tile-piece reward-tile-piece--icon" />
      )}
      {tile.state === "claimed" ? (
        <CandyIcon name="check" className="reward-tile-status reward-tile-status--claimed" />
      ) : null}
      {tile.state === "claimable" ? (
        <img
          src="/art/scene-rooted/punto-alerta-notificacion.png"
          alt=""
          aria-hidden="true"
          data-testid="reward-tile-notif"
          className="reward-tile-notif"
        />
      ) : null}
      {tile.state === "locked" ? (
        <CandyIcon name="lock" className="reward-tile-lock" />
      ) : null}
    </button>
  );
}
