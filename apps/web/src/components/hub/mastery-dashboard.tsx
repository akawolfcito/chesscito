"use client";

import { useTranslations } from "next-intl";
import type { PieceId } from "@/lib/game/types";
import { track } from "@/lib/telemetry";

import { MasteryTile, type MasteryState } from "./mastery-tile";

/** Hub V2 mastery dashboard — 2x3 grid of `<MasteryTile>` per piece in
 *  canonical order R B N P Q K (design-lock §1.3 + §9.3).
 *
 *  This commit ships the container + telemetry + ARIA contract. Wiring to
 *  the real on-chain badges/exercise progress data source happens when
 *  the dashboard mounts inside the hub scaffold (Phase 5 rails reframe).
 *
 *  Telemetry per design-lock §5:
 *    - hub_v2_mastery_tap        { piece, state, starsEarned } — buildable
 *    - hub_v2_mastery_locked_tap { piece }                      — Q/K only */

const PIECE_ORDER: PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
];

export type MasteryTileData = {
  state: MasteryState;
  starsEarned: number;
  starsTotal: number;
};

export type MasteryDashboardProps = {
  tiles: Record<PieceId, MasteryTileData>;
  claimed?: Partial<Record<PieceId, boolean>>;
  streakDays: number;
  onTileTap: (
    piece: PieceId,
    state: MasteryState,
    starsEarned: number,
  ) => void;
};

export function MasteryDashboard({
  tiles,
  claimed,
  streakDays,
  onTileTap,
}: MasteryDashboardProps) {
  const t = useTranslations("HUB_V2_MASTERY_COPY");
  // ICU plural with `=0 {}` resolves to empty when streakDays === 0;
  // we still render the streak row conditionally to keep the previous
  // "absent when days=0" contract (mastery-dashboard.test.tsx §6).
  const streakText = streakDays === 0 ? "" : t("streakLabel", { days: streakDays });

  const handleTap = (
    piece: PieceId,
    state: MasteryState,
    starsEarned: number,
  ) => {
    if (state === "coming-soon") {
      track("hub_v2_mastery_locked_tap", { piece });
    } else {
      track("hub_v2_mastery_tap", { piece, state, starsEarned });
    }
    onTileTap(piece, state, starsEarned);
  };

  return (
    <section
      data-component="mastery-dashboard"
      aria-label={t("masteryDashboardAriaLabel")}
      className="mastery-dashboard"
    >
      {streakText ? (
        <p data-testid="mastery-streak" className="mastery-dashboard-streak">
          {streakText}
        </p>
      ) : null}
      <div className="mastery-dashboard-grid">
        {PIECE_ORDER.map((piece) => {
          const data = tiles[piece];
          return (
            <MasteryTile
              key={piece}
              piece={piece}
              state={data.state}
              starsEarned={data.starsEarned}
              starsTotal={data.starsTotal}
              testId={`hub-v2-mastery-tile-${piece}`}
              claimed={claimed?.[piece] === true}
              onTap={() => handleTap(piece, data.state, data.starsEarned)}
            />
          );
        })}
      </div>
    </section>
  );
}
