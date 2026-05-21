"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ARENA_COPY, COACH_COPY, COACH_ENTRY_COPY } from "@/lib/content/editorial";
import { CandyChip } from "@/components/redesign/candy-chip";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { track } from "@/lib/telemetry";
import {
  parseAnalyzedHistory,
  parseUnanalyzedGames,
  type AnalyzedEntry,
  type UnanalyzedEntry,
} from "@/lib/coach/coach-history-parse";

type HistoryEntry = AnalyzedEntry | UnanalyzedEntry;

type Props = {
  walletAddress: string;
  credits: number;
  /** Tap an ANALYZED row → opens the existing result panel directly. */
  onSelectEntry: (entry: AnalyzedEntry) => void;
  /** Tap the Analyze chip on an UNANALYZED row → parent owns the
   *  analyze call (source:"history"). Optional so the legacy callers
   *  who don't yet wire it gracefully render the chip as a no-op. */
  onAnalyzeUnanalyzed?: (gameId: string) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resultVariant(result: string): "success" | "danger" | "warm" {
  if (result === "win") return "success";
  if (result === "loss" || result === "lose" || result === "resigned") return "danger";
  return "warm";
}

function resultLabel(result: string): string {
  if (result === "win") return "Win";
  if (result === "loss" || result === "lose") return "Loss";
  if (result === "resigned") return "Resigned";
  if (result === "draw") return "Draw";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatRelativeTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Latest review — large prominent tappable card for ANALYZED entries. */
function LatestReviewCard({
  entry,
  onSelect,
}: {
  entry: AnalyzedEntry;
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

      <div className="mt-2 flex flex-wrap gap-1.5">
        <CandyChip variant={resultVariant(entry.game.result)} tone="subtle">
          {resultLabel(entry.game.result)}
        </CandyChip>
        <CandyChip variant="warm" tone="subtle">{diffLabel}</CandyChip>
        <CandyChip variant="warm" tone="subtle">{entry.game.totalMoves} moves</CandyChip>
        <CandyChip variant="warm" tone="solid">{typeLabel}</CandyChip>
      </div>

      <p className="tj-latest-card-takeaway">{topTakeaway}</p>
    </button>
  );
}

/** Compact row for older analyzed entries. */
function OlderReviewRow({
  entry,
  onSelect,
}: {
  entry: AnalyzedEntry;
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
      role="listitem"
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

/** Cluster E — unanalyzed-entry row with the Analyze ▶ candy chip. Neutral
 *  "Match" title (no FULL/QUICK chip), subtitle = relative timestamp. */
function UnanalyzedReviewRow({
  entry,
  onAnalyze,
}: {
  entry: UnanalyzedEntry;
  onAnalyze: () => void;
}) {
  const diffLabel =
    ARENA_COPY.difficulty[entry.game.difficulty as keyof typeof ARENA_COPY.difficulty] ??
    entry.game.difficulty;
  const relative = formatRelativeTimestamp(entry.game.timestamp);
  const ariaLabel = COACH_ENTRY_COPY.historyAnalyzeAriaLabel(
    relative,
    diffLabel,
    resultLabel(entry.game.result),
  );

  return (
    <button
      type="button"
      onClick={onAnalyze}
      role="listitem"
      aria-label={ariaLabel}
      className="tj-older-row w-full text-left"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <CandyIcon name="time" className="h-3.5 w-3.5 shrink-0 opacity-75" />
        <span className="tj-older-row-label truncate">
          {COACH_ENTRY_COPY.historyMatchLabel} · {diffLabel} · {resultLabel(entry.game.result)} · {relative}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <CandyChip variant="success" tone="solid">
          {COACH_ENTRY_COPY.analyzeChipLabel} ▶
        </CandyChip>
      </div>
    </button>
  );
}

/** Chip-based progress card. Stats derived from analyzed entries only. */
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
        ARENA
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CoachHistory({
  walletAddress,
  credits,
  onSelectEntry,
  onAnalyzeUnanalyzed,
}: Props) {
  const [analyzed, setAnalyzed] = useState<AnalyzedEntry[]>([]);
  const [unanalyzed, setUnanalyzed] = useState<UnanalyzedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/coach/history?wallet=${walletAddress}`)
        .then((r) => r.json())
        .catch(() => []),
      fetch(`/api/games?wallet=${walletAddress}`)
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([historyData, gamesData]) => {
        if (cancelled) return;
        // Defensive parsing — rate-limit / forbidden responses come back
        // as `{ error: "..." }` objects, not arrays. Cluster E defer #4
        // also enforces UUID shape so corrupt ids never reach the
        // Analyze endpoint (where they 400 silently). See
        // `lib/coach/coach-history-parse.ts`.
        const historyArr = parseAnalyzedHistory(historyData);
        const analyzedIds = new Set(historyArr.map((e) => e.gameId));
        const unanalyzedArr = parseUnanalyzedGames(gamesData, analyzedIds);
        setAnalyzed(historyArr);
        setUnanalyzed(unanalyzedArr);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // Telemetry — fire exactly once per mount with the unanalyzed bucket
  // size. Spec §2.4.10: `coach_history_unanalyzed_view{count}`. The ref
  // latch protects against the `loading: true → false → true → false`
  // wallet-switch cycle re-firing the event.
  const viewEmittedRef = useRef(false);
  useEffect(() => {
    if (loading || viewEmittedRef.current) return;
    viewEmittedRef.current = true;
    track("coach_history_unanalyzed_view", { count: unanalyzed.length });
  }, [loading, unanalyzed.length]);

  // Mixed chronological — newest first by game.timestamp. No Analyzed /
  // Pending section split per spec §2.4.9.
  const mergedSorted: HistoryEntry[] = useMemo(() => {
    return [...analyzed, ...unanalyzed].sort(
      (a, b) => b.game.timestamp - a.game.timestamp,
    );
  }, [analyzed, unanalyzed]);

  // Derived stats (analyzed-only — Reviewed/Highest/Streak)
  const gamesAnalyzed = analyzed.length;
  const highestDiff = analyzed.reduce((max, e) => {
    const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    return (order[e.game.difficulty] ?? 0) > (order[max] ?? 0)
      ? e.game.difficulty
      : max;
  }, "easy");
  let streak = 0;
  for (let i = 0; i < analyzed.length; i += 1) {
    if (analyzed[i].game.result === "win") streak += 1;
    else break;
  }

  // Header — surface the latest analyzed entry as a prominent card if it
  // also happens to be the newest entry overall. Otherwise the merged
  // list takes over the visual hierarchy.
  const headEntry = mergedSorted[0];
  const restEntries = mergedSorted.slice(1);
  const headIsAnalyzed = headEntry?.kind === "analyzed";

  const handleAnalyzeTap = (gameId: string) => {
    track("coach_history_analyze_tap", { game_id: gameId });
    onAnalyzeUnanalyzed?.(gameId);
  };

  if (loading) {
    return (
      <div className="tj-loading">
        <CandyIcon name="loading" className="h-5 w-5 animate-spin opacity-60" />
        <p className="tj-loading-text">{COACH_COPY.loading}</p>
      </div>
    );
  }

  if (mergedSorted.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      {credits > 0 && (
        <div className="flex justify-end">
          <CandyChip variant="warm" tone="subtle">
            {credits} credits
          </CandyChip>
        </div>
      )}

      {headIsAnalyzed && (
        <LatestReviewCard
          entry={headEntry as AnalyzedEntry}
          onSelect={() => onSelectEntry(headEntry as AnalyzedEntry)}
        />
      )}

      {/* When the head is analyzed it is rendered above via the
          LatestReviewCard; only `restEntries` flow through the list.
          When the head is unanalyzed we render it inside this list so
          the role="list" container groups every chip together. */}
      {(headIsAnalyzed ? restEntries.length > 0 : mergedSorted.length > 0) && (
        <div className="tj-older-list" role="list">
          {(headIsAnalyzed ? restEntries : mergedSorted).map((entry) =>
            entry.kind === "analyzed" ? (
              <OlderReviewRow
                key={entry.gameId}
                entry={entry}
                onSelect={() => onSelectEntry(entry)}
              />
            ) : (
              <UnanalyzedReviewRow
                key={entry.gameId}
                entry={entry}
                onAnalyze={() => handleAnalyzeTap(entry.gameId)}
              />
            ),
          )}
        </div>
      )}

      {gamesAnalyzed > 0 && (
        <ProgressCard
          gamesAnalyzed={gamesAnalyzed}
          highestDiff={highestDiff}
          streak={streak}
        />
      )}
    </div>
  );
}
