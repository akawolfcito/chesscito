"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  BADGE_THRESHOLD,
  PLAYABLE_PIECES,
} from "@/lib/game/exercises";
import { PIECE_LABELS } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";

export type TierStatus = "done" | "active" | "locked";

type Tier = {
  id: string;
  icon: "trophy" | "crown" | "star";
  label: string;
  progress: string;
  status: TierStatus;
};

type Props = {
  currentPiece: PieceId;
  /** Stars earned on the current piece (0–15). */
  currentStars: number;
  /** Map of pieceId → whether its badge was claimed on-chain. */
  claimedBadges?: Partial<Record<PieceId, boolean>>;
};

function pickNextPiece(currentPiece: PieceId): PieceId | null {
  const idx = PLAYABLE_PIECES.indexOf(currentPiece);
  return idx >= 0 && idx + 1 < PLAYABLE_PIECES.length
    ? PLAYABLE_PIECES[idx + 1]
    : null;
}

function buildTiers(
  currentPiece: PieceId,
  currentStars: number,
  claimedBadges: Partial<Record<PieceId, boolean>>,
): Tier[] {
  const currentBadgeDone = claimedBadges[currentPiece] === true;
  const currentBadgeReached = currentStars >= BADGE_THRESHOLD;
  const nextPiece = pickNextPiece(currentPiece);
  const masteredCount = PLAYABLE_PIECES.filter((p) => claimedBadges[p]).length;

  const tier1: Tier = {
    id: "tier-piece-badge",
    icon: "trophy",
    label: `${PIECE_LABELS[currentPiece]} Badge`,
    progress: currentBadgeDone
      ? "Claimed"
      : currentBadgeReached
        ? "Ready to claim"
        : `${Math.min(currentStars, BADGE_THRESHOLD)} / ${BADGE_THRESHOLD} ★`,
    status: currentBadgeDone ? "done" : "active",
  };

  const tier2: Tier = {
    id: "tier-next-piece",
    icon: "crown",
    label: nextPiece ? `Unlock ${PIECE_LABELS[nextPiece]}` : "No more pieces",
    progress: nextPiece
      ? currentBadgeDone
        ? "Ready"
        : "Claim badge first"
      : "—",
    status: nextPiece
      ? currentBadgeDone
        ? "active"
        : "locked"
      : "done",
  };

  const total = PLAYABLE_PIECES.length;
  const tier3: Tier = {
    id: "tier-all-mastered",
    icon: "star",
    label: "All pieces mastered",
    progress: `${masteredCount} / ${total}`,
    status: masteredCount >= total ? "done" : "locked",
  };

  return [tier1, tier2, tier3];
}

export function JourneyRail({ currentPiece, currentStars, claimedBadges = {} }: Props) {
  const tiers = buildTiers(currentPiece, currentStars, claimedBadges);

  return (
    <div className="paper-tray" aria-label="Your journey">
      {tiers.map((tier) => (
        <div key={tier.id} className="paper-row journey-row" data-status={tier.status}>
          <span className="journey-row-icon">
            <CandyIcon
              name={tier.status === "locked" ? "lock" : tier.icon}
              className="h-5 w-5"
            />
          </span>
          <div className="flex-1 min-w-0">
            <p className="journey-row-label">{tier.label}</p>
          </div>
          <span className="journey-row-progress" data-status={tier.status}>
            {tier.progress}
          </span>
        </div>
      ))}
    </div>
  );
}
