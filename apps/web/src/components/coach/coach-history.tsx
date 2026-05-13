"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ARENA_COPY, COACH_COPY } from "@/lib/content/editorial";
import { CandyChip } from "@/components/redesign/candy-chip";
import { CandyIcon } from "@/components/redesign/candy-icon";
import type { CoachAnalysisRecord, GameRecord } from "@/lib/coach/types";

type HistoryEntry = CoachAnalysisRecord & { game: GameRecord };

type Props = {
  walletAddress: string;
  credits: number;
  onSelectEntry: (entry: HistoryEntry) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resultVariant(result: string): "success" | "danger" | "warm" {
  if (result === "win") return "success";
  if (result === "loss" || result === "resigned") return "danger";
  return "warm";
}

function resultLabel(result: string): string {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  if (result === "resigned") return "Resigned";
  if (result === "draw") return "Draw";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Latest review — large prominent tappable card. */
function LatestReviewCard({
  entry,
  onSelect,
}: {
  entry: HistoryEntry;
  onSelect: () => void;
}) {
  const diffLabel =
    ARENA_COPY.difficulty[entry.game.difficulty as keyof typeof ARENA_COPY.difficulty] ??
    entry.game.difficulty;
  const topTakeaway =
    entry.response.kind === "full"
      ? entry.response.lessons[0] ?? entry.response.summary
      : entry.response.tips[0] ?? entry.response.summary;
  const typeLabel =
    entry.response.kind === "full" ? COACH_COPY.full : COACH_COPY.quick;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="tj-latest-card w-full text-left"
      aria-label={`Open ${typeLabel} Coach Review — ${resultLabel(entry.game.result)}, ${diffLabel}, ${entry.game.totalMoves} moves`}
    >
      {/* Card header row */}
      <div className="tj-latest-card-header">
        <div className="flex min-w-0 items-center gap-2">
          <CandyIcon
            name={entry.game.result === "win" ? "trophy" : entry.game.result === "draw" ? "star" : "close"}
            className="h-5 w-5 shrink-0"
          />
          <span className="tj-latest-card-title">Latest Review</span>
        </div>
        <span className="tj-latest-card-open-label">Review →</span>
      </div>

      {/* Chip row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <CandyChip variant={resultVariant(entry.game.result)} tone="subtle">
          {resultLabel(entry.game.result)}
        </CandyChip>
        <CandyChip variant="warm" tone="subtle">{diffLabel}</CandyChip>
        <CandyChip variant="warm" tone="subtle">{entry.game.totalMoves} moves</CandyChip>
        <CandyChip variant="warm" tone="solid">{typeLabel}</CandyChip>
      </div>

      {/* Takeaway */}
      <p className="tj-latest-card-takeaway">{topTakeaway}</p>
    </button>
  );
}

/** Compact row for older entries (2nd entry onwards). */
function OlderReviewRow({
  entry,
  onSelect,
}: {
  entry: HistoryEntry;
  onSelect: () => void;
}) {
  const diffLabel =
    ARENA_COPY.difficulty[entry.game.difficulty as keyof typeof ARENA_COPY.difficulty] ??
    entry.game.difficulty;
  const typeLabel =
    entry.response.kind === "full" ? COACH_COPY.full : COACH_COPY.quick;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="tj-older-row w-full text-left"
      aria-label={`Open ${typeLabel} Coach Review — ${resultLabel(entry.game.result)}, ${diffLabel}, ${entry.game.totalMoves} moves`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <CandyIcon
          name={entry.game.result === "win" ? "trophy" : "close"}
          className="h-3.5 w-3.5 shrink-0 opacity-75"
        />
        <span className="tj-older-row-label truncate">
          {resultLabel(entry.game.result)} · {diffLabel} · {entry.game.totalMoves} moves
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <CandyChip variant="warm" tone="subtle">{typeLabel}</CandyChip>
        <span className="tj-older-row-open">→</span>
      </div>
    </button>
  );
}

/** Chip-based progress card. */
function ProgressCard({
  gamesAnalyzed,
  highestDiff,
  streak,
}: {
  gamesAnalyzed: number;
  highestDiff: string;
  streak: number;
}) {
  const highestDiffLabel =
    ARENA_COPY.difficulty[highestDiff as keyof typeof ARENA_COPY.difficulty] ?? highestDiff;

  return (
    <div className="tj-progress-card">
      <div className="tj-progress-card-header">
        <CandyIcon name="star" className="h-3.5 w-3.5" />
        <span className="tj-progress-card-title">{COACH_COPY.yourProgress}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <div className="tj-stat-block">
          <span className="tj-stat-value">{gamesAnalyzed}</span>
          <span className="tj-stat-label">Reviewed</span>
        </div>
        <div className="tj-stat-block">
          <span className="tj-stat-value">{highestDiffLabel}</span>
          <span className="tj-stat-label">Highest</span>
        </div>
        {streak > 0 && (
          <div className="tj-stat-block">
            <span className="tj-stat-value">{streak}</span>
            <span className="tj-stat-label">Win streak</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Game-native empty state. */
function EmptyState() {
  return (
    <div className="tj-empty-state">
      <CandyIcon name="coach" className="tj-empty-state-icon" />
      <h2 className="tj-empty-state-title">No reviews yet</h2>
      <p className="tj-empty-state-body">
        Play an Arena match and ask Coach after the game.
      </p>
      <Link
        href="/arena?fresh=1"
        className="tj-empty-state-cta"
        aria-label="Go to Arena and play a match"
      >
        Play Arena
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // Derived stats (computed from existing data — no new fields)
  const gamesAnalyzed = entries.length;
  const highestDiff = entries.reduce((max, e) => {
    const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    return (order[e.game.difficulty] ?? 0) > (order[max] ?? 0)
      ? e.game.difficulty
      : max;
  }, "easy");
  let streak = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].game.result === "win") streak++;
    else break;
  }

  const [latestEntry, ...olderEntries] = entries;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="tj-loading">
        <CandyIcon name="loading" className="h-5 w-5 animate-spin opacity-60" />
        <p className="tj-loading-text">{COACH_COPY.loading}</p>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (entries.length === 0) {
    return <EmptyState />;
  }

  // ── Session list ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Credits chip — top right, compact */}
      {credits > 0 && (
        <div className="flex justify-end">
          <CandyChip variant="warm" tone="subtle">
            {credits} credits
          </CandyChip>
        </div>
      )}

      {/* Latest review — primary large card */}
      <LatestReviewCard entry={latestEntry} onSelect={() => onSelectEntry(latestEntry)} />

      {/* Older reviews — compact rows */}
      {olderEntries.length > 0 && (
        <div className="tj-older-list">
          <p className="tj-older-list-header">Earlier reviews</p>
          {olderEntries.map((entry) => (
            <OlderReviewRow
              key={entry.gameId}
              entry={entry}
              onSelect={() => onSelectEntry(entry)}
            />
          ))}
        </div>
      )}

      {/* Progress card */}
      <ProgressCard
        gamesAnalyzed={gamesAnalyzed}
        highestDiff={highestDiff}
        streak={streak}
      />
    </div>
  );
}
