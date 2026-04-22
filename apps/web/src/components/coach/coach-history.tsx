"use client";

import { useEffect, useState } from "react";
import { ARENA_COPY, COACH_COPY } from "@/lib/content/editorial";
import type { CoachAnalysisRecord, GameRecord } from "@/lib/coach/types";

type HistoryEntry = CoachAnalysisRecord & { game: GameRecord };

type Props = {
  walletAddress: string;
  credits: number;
  onSelectEntry: (entry: HistoryEntry) => void;
};

export function CoachHistory({ walletAddress, credits, onSelectEntry }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/coach/history?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data: HistoryEntry[]) => setEntries(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  const gamesAnalyzed = entries.length;
  const highestDiff = entries.reduce((max, e) => {
    const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    return (order[e.game.difficulty] ?? 0) > (order[max] ?? 0) ? e.game.difficulty : max;
  }, "easy");

  let streak = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].game.result === "win") streak++;
    else break;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="fantasy-title text-xl font-bold" style={{ color: "var(--paper-text)" }}>
          {COACH_COPY.yourSessions}
        </h2>
        <span className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>{credits} credits</span>
      </div>

      {loading && (
        <p className="text-center text-sm" style={{ color: "var(--paper-text-muted)" }}>
          {COACH_COPY.loading}
        </p>
      )}

      {!loading && entries.map((entry) => {
        const diffLabel = ARENA_COPY.difficulty[entry.game.difficulty as keyof typeof ARENA_COPY.difficulty] ?? entry.game.difficulty;
        const topTakeaway = entry.response.kind === "full"
          ? entry.response.lessons[0] ?? entry.response.summary
          : entry.response.tips[0] ?? entry.response.summary;
        const momentCount = entry.response.kind === "full" ? entry.response.mistakes.length : 0;
        const typeLabel = entry.response.kind === "full" ? COACH_COPY.full : COACH_COPY.quick;

        return (
          <button
            key={entry.gameId}
            type="button"
            onClick={() => onSelectEntry(entry)}
            className="paper-tray w-full text-left transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--paper-text)" }}>
                {entry.game.result.charAt(0).toUpperCase() + entry.game.result.slice(1)} - {diffLabel} - {entry.game.totalMoves} moves
              </p>
              <span className="text-xs font-semibold" style={{ color: "var(--paper-text-muted)" }}>
                {typeLabel}
              </span>
            </div>
            <p className="mt-1 truncate text-xs italic" style={{ color: "var(--paper-text-muted)" }}>
              {`"${topTakeaway}"`}
            </p>
            {momentCount > 0 && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--paper-text-subtle)" }}>
                {COACH_COPY.keyMomentsCount(momentCount)}
              </p>
            )}
          </button>
        );
      })}

      {!loading && entries.length > 0 && (
        <div className="paper-tray">
          <h3
            className="mb-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {COACH_COPY.yourProgress}
          </h3>
          <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
            {COACH_COPY.gamesAnalyzed(gamesAnalyzed)}
          </p>
          <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
            {COACH_COPY.highestDifficulty(ARENA_COPY.difficulty[highestDiff as keyof typeof ARENA_COPY.difficulty] ?? highestDiff)}
          </p>
          {streak > 0 && (
            <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
              {COACH_COPY.currentStreak(streak)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
