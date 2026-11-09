"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { REWARD_COPY } from "@/lib/content/editorial";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

export type RewardTileId = keyof typeof REWARD_COPY;
export type RewardTileState = "claimed" | "claimable" | "progress" | "locked";

/** How far the player is toward this piece's badge.
 *
 *  ⚠️ `required` is the GATE — `badgeRequiredCount(poolSize)`, 80% rounded up —
 *  NOT the pool size. A pool of 10 gates at 8: showing "8/10" while the badge
 *  is already earned is a number the player cannot reconcile with anything.
 *
 *  ⚠️ `completed` counts only exercises that exist in the CURRENT catalog
 *  (`completedExerciseCount`), which is what the drawer lets the player count
 *  with their finger. The badge gate deliberately counts wider — retired ids
 *  never revoke mastery — and that gap is never visible: once the wide count
 *  crosses the gate the tile is `claimable` and this chip is gone. */
export type RewardTileProgress = {
  completed: number;
  required: number;
};

export type RewardTile = {
  id: RewardTileId;
  state: RewardTileState;
  /** Fires on tile tap regardless of state. The parent decides what to do
   *  per state (claim flow for `claimable`, unlock-hint sheet for `locked`). */
  onTap?: () => void;
  /** ⚠️ Named `progress` like the STATE of the same name, and like the
   *  `ariaState` that `claimed` maps to below. They coexist on purpose: this
   *  is present ONLY when `state === "progress"` and the source data has
   *  hydrated. `undefined` means there is nothing honest to say yet. */
  progress?: RewardTileProgress;
};

type Props = {
  tiles: RewardTile[];
  className?: string;
  /** Optional tile that the mini-tour spotlights. */
  tourTargetId?: RewardTileId;
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
export function RewardColumn({
  tiles,
  className = "",
  compact = false,
  tourTargetId,
}: Props) {
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
        <RewardTileButton
          key={tile.id}
          tile={tile}
          compact={compact}
          tourTarget={tile.id === tourTargetId ? tile.id : undefined}
        />
      ))}
    </div>
  );
}

function RewardTileButton({
  tile,
  compact,
  tourTarget,
}: {
  tile: RewardTile;
  compact: boolean;
  tourTarget?: RewardTileId;
}) {
  const tReward = useTranslations("REWARD_COPY");
  const tPieces = useTranslations("PIECE_LABELS");
  const tProgress = useTranslations("REWARD_PROGRESS_COPY");
  const label = isPieceTile(tile.id)
    ? tPieces(tile.id)
    : tReward(`${tile.id}.label`);
  const ariaState: Exclude<RewardTileState, "claimed"> =
    tile.state === "claimed" ? "progress" : tile.state;
  // A separate message, not a new argument on the shared `ariaLabel`: that
  // one is consumed by 6 pieces across 4 states, and `tsc` does not see ICU
  // arguments — adding one there compiles green and degrades at runtime.
  const ariaLabel = tile.progress
    ? tProgress("ariaLabel", {
        piece: label,
        completed: tile.progress.completed,
        required: tile.progress.required,
      })
    : tReward(`${tile.id}.ariaLabel`, { state: ariaState });
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
      aria-label={ariaLabel}
      className={classes}
      data-tour-target={tourTarget}
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
      {tile.progress ? (
        // Absolutely positioned so a late-arriving counter (it waits for
        // hydration) never changes the tile's height.
        <span
          aria-hidden="true"
          data-testid="reward-tile-progress"
          className="progress-count-chip reward-tile-progress"
        >
          {tile.progress.completed}/{tile.progress.required}
        </span>
      ) : null}
    </button>
  );
}
