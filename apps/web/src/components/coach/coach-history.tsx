"use client";

import { useEffect, useState } from "react";
import { ARENA_COPY, COACH_COPY } from "@/lib/content/editorial";
import { CandyIcon } from "@/components/redesign/candy-icon";
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
      .then((data) => {
        // Defensive: rate-limit / forbidden responses come back as
        // `{ error: "..." }` objects, not arrays. Without this guard
        // the next render would crash on `entries.reduce(...)` —
        // user-visible "Board crashed" trap that needed a full page
        // reload (real incident 2026-05-07).
        setEntries(Array.isArray(data) ? data : []);
      })
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

  const warmText = "rgba(63, 34, 8, 0.95)";
  const warmMuted = "rgba(110, 65, 15, 0.75)";
  const warmSubtle = "rgba(110, 65, 15, 0.55)";
  const cream = "0 1px 0 rgba(255, 245, 215, 0.55)";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <span className="text-xs font-semibold" style={{ color: warmSubtle }}>
          {credits} credits
        </span>
      </div>

      {loading && (
        <p className="text-center text-sm" style={{ color: warmMuted }}>
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
            className="candy-tray w-full text-left transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <CandyIcon
                  name={entry.game.result === "win" ? "trophy" : "close"}
                  className="h-4 w-4 shrink-0"
                />
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: warmText, textShadow: cream }}
                >
                  {entry.game.result.charAt(0).toUpperCase() + entry.game.result.slice(1)} · {diffLabel} · {entry.game.totalMoves} moves
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold" style={{ color: warmMuted }}>
                {typeLabel}
              </span>
            </div>
            <p className="mt-1 truncate text-xs italic" style={{ color: warmMuted }}>
              {`"${topTakeaway}"`}
            </p>
            {momentCount > 0 && (
              <p className="mt-0.5 text-xs" style={{ color: warmSubtle }}>
                {COACH_COPY.keyMomentsCount(momentCount)}
              </p>
            )}
          </button>
        );
      })}

      {!loading && entries.length > 0 && (
        <div className="candy-tray">
          <div className="mb-1 flex items-center gap-1.5">
            <CandyIcon name="star" className="h-3.5 w-3.5" />
            <h3
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: warmMuted }}
            >
              {COACH_COPY.yourProgress}
            </h3>
          </div>
          <p className="text-xs" style={{ color: warmMuted }}>
            {COACH_COPY.gamesAnalyzed(gamesAnalyzed)}
          </p>
          <p className="text-xs" style={{ color: warmMuted }}>
            {COACH_COPY.highestDifficulty(ARENA_COPY.difficulty[highestDiff as keyof typeof ARENA_COPY.difficulty] ?? highestDiff)}
          </p>
          {streak > 0 && (
            <p className="flex items-center gap-1 text-xs" style={{ color: warmMuted }}>
              <CandyIcon name="crown" className="h-3 w-3" />
              {COACH_COPY.currentStreak(streak)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
