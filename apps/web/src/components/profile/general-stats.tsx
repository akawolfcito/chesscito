"use client";
import { useTranslations } from "next-intl";

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
  const cells = [
    { ico: "♟️", label: t("statLabels.piecesMastered"), value: `${p.piecesMastered} / ${p.piecesTotal}` },
    { ico: "🔥", label: t("statLabels.dailyStreak"), value: String(p.dailyStreak) },
    { ico: "🧩", label: t("statLabels.puzzlesSolved"), value: String(p.puzzlesSolved) },
    { ico: "⚔️", label: t("statLabels.arenaWins"), value: String(p.arenaWins) },
    { ico: "🏆", label: t("statLabels.trophies"), value: String(p.trophies) },
    { ico: "💎", label: t("statLabels.nftsMinted"), value: String(p.nftsMinted) },
  ];

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
