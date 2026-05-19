"use client";
import { PROFILE_COPY } from "@/lib/content/editorial";

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
  const cells = [
    { ico: "♟️", label: "Pieces Mastered", value: `${p.piecesMastered} / ${p.piecesTotal}` },
    { ico: "🔥", label: "Daily Streak", value: String(p.dailyStreak) },
    { ico: "🧩", label: "Puzzles Solved", value: String(p.puzzlesSolved) },
    { ico: "⚔️", label: "Arena Wins", value: String(p.arenaWins) },
    { ico: "🏆", label: "Trophies", value: String(p.trophies) },
    { ico: "💎", label: "NFTs Minted", value: String(p.nftsMinted) },
  ];

  return (
    <section className="profile-stats" aria-label={PROFILE_COPY.generalStatsHeader}>
      <h3 className="profile-stats-header">{PROFILE_COPY.generalStatsHeader}</h3>
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
