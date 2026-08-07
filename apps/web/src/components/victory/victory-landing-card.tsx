"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { formatTime } from "@/lib/game/arena-utils";
import { useThemeBackground } from "@/lib/themes/use-theme-background";

import { AcceptChallengeButton } from "@/app/[locale]/victory/[id]/accept-challenge-button";

const ARENA_DIFFICULTIES = new Set([1, 2, 3]);

export type VictoryLandingInfo = {
  id: string;
  moves: number;
  timeMs: number;
  difficulty: string;
  difficultyRaw: number;
};

/**
 * Presentational shell for `/victory/[id]`. Server page builds the
 * `VictoryLandingInfo` from the chain read and renders this component.
 * The `/dev/victory-landing` VR fixture builds the same payload from
 * static data so the layout has CI regression coverage without
 * requiring a live token ID.
 */
export function VictoryLandingCard({ v }: { v: VictoryLandingInfo }) {
  const t = useTranslations("VICTORY_PAGE_COPY");
  const isCheckmate = ARENA_DIFFICULTIES.has(v.difficultyRaw);
  const panelBackground = useThemeBackground("shared.panel-bg");
  const headline = isCheckmate
    ? t("metaCheckmate", { moves: v.moves })
    : t("metaComplete", { moves: v.moves });

  return (
    <div
      className="arena-bg flex min-h-[100dvh] items-center justify-center px-4 py-6 animate-in fade-in duration-500"
    >
      <div
        className="relative w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain"
        style={{
          backgroundImage: panelBackground,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div
          className="arena-result-popup-content"
          style={{ paddingTop: "12%" }}
        >
          <h1
            className="arena-result-title text-center"
            style={{ fontSize: "clamp(24px, 5dvh, 32px)" }}
          >
            {headline}
          </h1>

          <div className="arena-result-stats-row arena-result-stats-row--missionpills mt-2">
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <CandyIcon name="star" className="h-4 w-4" />
              </span>
              {v.difficulty}
            </span>
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <ThemeAssetPicture
                  slot="board.piece.white.pawn"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="block h-full w-full object-contain"
                />
              </span>
              {String(v.moves)}
            </span>
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <CandyIcon name="time" className="h-4 w-4" />
              </span>
              {formatTime(v.timeMs)}
            </span>
          </div>

          <div className="arena-result-coach-section mt-4">
            <div className="arena-result-coach-body">
              <div className="arena-result-coach-text">
                <h2 className="arena-result-coach-headline">
                  {t("challengeLine")}
                </h2>
                <p className="arena-result-coach-body-text">{t("tagline")}</p>
              </div>
              <ThemeAssetPicture slot="shared.feedback-confident" pictureClassName="arena-result-coach-avatar" alt="" aria-hidden="true" draggable={false} />
            </div>
          </div>

          <div className="mt-4 flex w-full justify-center">
            <AcceptChallengeButton />
          </div>

          <Link
            href="/"
            className="arena-result-back-link mt-3 inline-flex min-h-[44px] items-center justify-center"
          >
            {t("backToHub")}
          </Link>
        </div>
      </div>
    </div>
  );
}
