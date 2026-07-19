"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { REWARD_COPY } from "@/lib/content/editorial";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

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
  /** Compact variant — smaller tiles (48px) and mini-labels (0.55rem)
   *  with a tighter gap. Same DOM, opt-in via class modifier so the
   *  default rail keeps its current spacing. */
  compact?: boolean;
};

const PIECE_TILE_IDS = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
const PIECE_TILE_SLOTS = Object.fromEntries(
  PIECE_TILE_IDS.map((piece) => [piece, `board.piece.white.${piece}`]),
) as Record<(typeof PIECE_TILE_IDS)[number], ThemeAssetKey>;

function isPieceTile(id: RewardTileId): id is (typeof PIECE_TILE_IDS)[number] {
  return (PIECE_TILE_IDS as readonly string[]).includes(id);
}

/** Vertical reward stack rendered on the Hub left edge. Adventure primitive
 *  showing reward tiles (claimable / progress / locked). Tiles are presentational buttons —
 *  copy + aria-labels live in `editorial.ts.REWARD_COPY` (single-source). */
export function RewardColumn({ tiles, className = "", compact = false }: Props) {
  if (tiles.length === 0) {
    return null;
  }

  const wrapperClass = [
    "reward-column",
    compact ? "is-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      {tiles.map((tile) => (
        <RewardTileButton key={tile.id} tile={tile} compact={compact} />
      ))}
    </div>
  );
}

function RewardTileButton({
  tile,
  compact,
}: {
  tile: RewardTile;
  compact: boolean;
}) {
  const tReward = useTranslations("REWARD_COPY");
  const tPieces = useTranslations("PIECE_LABELS");
  const label = isPieceTile(tile.id)
    ? tPieces(tile.id)
    : tReward(`${tile.id}.label`);
  const ariaState: Exclude<RewardTileState, "claimed"> =
    tile.state === "claimed" ? "progress" : tile.state;
  const classes = [
    "reward-tile",
    `is-${tile.state}`,
    tile.state === "progress" || tile.state === "claimable"
      ? "is-active-piece"
      : "",
    compact ? "is-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={tile.onTap}
      aria-label={tReward(`${tile.id}.ariaLabel`, { state: ariaState })}
      className={classes}
    >
      <span className="reward-tile-label">{label}</span>
      {isPieceTile(tile.id) ? (
        <ThemeAssetPicture
          slot={PIECE_TILE_SLOTS[tile.id]}
          pictureClassName="reward-tile-piece"
          alt=""
        />
      ) : (
        <CandyIcon name="trophy" className="reward-tile-piece reward-tile-piece--icon" />
      )}
      {tile.state === "claimed" ? (
        <span
          aria-hidden="true"
          className="reward-tile-status reward-tile-status--claimed"
        >
          ✓
        </span>
      ) : null}
      {tile.state === "claimable" ? (
        // Pure-CSS dot (founder 2026-06-11): same glossy sphere as the
        // action-row markers — the punto-alerta-notificacion PNG is no
        // longer fetched here.
        <span
          aria-hidden="true"
          data-testid="reward-tile-notif"
          className="reward-tile-notif action-pin-notif"
        />
      ) : null}
      {tile.state === "locked" ? (
        <CandyIcon name="lock" className="reward-tile-lock" />
      ) : null}
    </button>
  );
}
