"use client";
import { useTranslations } from "next-intl";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

type Props = {
  piecesMastered: number;
  piecesTotal: number;
  dailyStreak: number;
  puzzlesSolved: number;
  arenaWins: number;
  trophies: number;
  nftsMinted: number;
};

export function GeneralStats(p: Props) {
  const t = useTranslations("PROFILE_COPY");
  const allCells = [
    { ico: "♟️", label: t("statLabels.piecesMastered"), value: `${p.piecesMastered} / ${p.piecesTotal}`, fullOnly: false },
    { ico: "🔥", label: t("statLabels.dailyStreak"), value: String(p.dailyStreak), fullOnly: false },
    { ico: "🧩", label: t("statLabels.puzzlesSolved"), value: String(p.puzzlesSolved), fullOnly: false },
    { ico: "⚔️", label: t("statLabels.arenaWins"), value: String(p.arenaWins), fullOnly: true },
    { ico: "🏆", label: t("statLabels.trophies"), value: String(p.trophies), fullOnly: false },
    { ico: "💎", label: t("statLabels.nftsMinted"), value: String(p.nftsMinted), fullOnly: true },
  ];
  const cells = CHESSCITO_LITE_MODE ? allCells.filter((c) => !c.fullOnly) : allCells;

  return (
    <section className="profile-stats" aria-label={t("generalStatsHeader")}>
      <h3 className="profile-stats-header">{t("generalStatsHeader")}</h3>
      <ul className="profile-stats-grid">
        {cells.map((c) => (
          <li key={c.label} className="profile-stat-cell">
            <span aria-hidden="true">{c.ico}</span>
            <span className="profile-stat-cell-label">{c.label}</span>
            <strong className="profile-stat-cell-value">{c.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
