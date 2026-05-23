"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  BADGE_THRESHOLD,
  PLAYABLE_PIECES,
} from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

export type TierStatus = "done" | "active" | "locked";
type ProgressVariant = "pill" | "text";
type ProgressTone = "done" | "ready" | "neutral";

type Tier = {
  id: string;
  icon: "trophy" | "crown" | "star";
  label: string;
  progress: string;
  status: TierStatus;
  /** "pill" renders progress as a colored status badge; "text" keeps
   *  the legacy uppercase progress label. Numeric counts always use
   *  "text" so they read as quantitative data, not a status. */
  progressVariant: ProgressVariant;
  /** Pill color when `progressVariant === "pill"`. Ignored for text. */
  progressTone: ProgressTone;
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

export function JourneyRail({ currentPiece, currentStars, claimedBadges = {} }: Props) {
  const t = useTranslations("JOURNEY_RAIL_COPY");
  const tPiece = useTranslations("PIECE_LABELS");

  const currentBadgeDone = claimedBadges[currentPiece] === true;
  const currentBadgeReached = currentStars >= BADGE_THRESHOLD;
  const nextPiece = pickNextPiece(currentPiece);
  const masteredCount = PLAYABLE_PIECES.filter((p) => claimedBadges[p]).length;
  const total = PLAYABLE_PIECES.length;

  const tier1: Tier = {
    id: "tier-piece-badge",
    icon: "trophy",
    label: t("pieceBadgeFormat", { piece: tPiece(currentPiece) }),
    progress: currentBadgeDone
      ? t("claimed")
      : currentBadgeReached
        ? t("readyToClaim")
        : t("starProgressFormat", {
            current: Math.min(currentStars, BADGE_THRESHOLD),
            total: BADGE_THRESHOLD,
          }),
    status: currentBadgeDone ? "done" : "active",
    progressVariant: currentBadgeDone || currentBadgeReached ? "pill" : "text",
    progressTone: currentBadgeDone
      ? "done"
      : currentBadgeReached
        ? "ready"
        : "neutral",
  };

  const tier2: Tier = {
    id: "tier-next-piece",
    icon: "crown",
    label: nextPiece
      ? t("unlockPieceFormat", { piece: tPiece(nextPiece) })
      : t("noMorePieces"),
    progress: nextPiece
      ? currentBadgeDone
        ? t("ready")
        : t("claimBadgeFirst")
      : "—",
    status: nextPiece
      ? currentBadgeDone
        ? "active"
        : "locked"
      : "done",
    progressVariant: nextPiece && currentBadgeDone ? "pill" : "text",
    progressTone: nextPiece && currentBadgeDone ? "ready" : "neutral",
  };

  const tier3: Tier = {
    id: "tier-all-mastered",
    icon: "star",
    label: t("allPiecesMastered"),
    progress: t("masteredCountFormat", { count: masteredCount, total }),
    status: masteredCount >= total ? "done" : "locked",
    progressVariant: "text",
    progressTone: "neutral",
  };

  const tiers = [tier1, tier2, tier3];

  return (
    <div className="paper-tray" aria-label={t("ariaLabel")}>
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
          {tier.progressVariant === "pill" ? (
            <span className="journey-status-pill" data-tone={tier.progressTone}>
              {tier.progress}
            </span>
          ) : (
            <span className="journey-row-progress" data-status={tier.status}>
              {tier.progress}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
