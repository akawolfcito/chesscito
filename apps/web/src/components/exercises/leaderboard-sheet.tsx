"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LeaderboardRow } from "@/lib/server/leaderboard";
import { LEADERBOARD_SHEET_COPY, PASSPORT_COPY } from "@/lib/content/editorial";

const OPTIMISTIC_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getOptimisticScore(): { player: string; score: number } | null {
  try {
    const raw = sessionStorage.getItem("chesscito:optimistic-score");
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > OPTIMISTIC_TTL_MS) {
      sessionStorage.removeItem("chesscito:optimistic-score");
      return null;
    }
    return { player: entry.player, score: entry.score };
  } catch {
    return null;
  }
}

function clearOptimisticScore() {
  try { sessionStorage.removeItem("chesscito:optimistic-score"); } catch { /* ignore */ }
}

// Module-level prefetch: warms the serverless function during page load
// (fires before React mounts any component — cold start happens during splash)
let prefetchedRows: LeaderboardRow[] | null = null;
if (typeof window !== "undefined") {
  fetch("/api/leaderboard")
    .then((r) => r.ok ? r.json() : null)
    .then((data) => { if (Array.isArray(data)) prefetchedRows = data; })
    .catch(() => {});
}

type LeaderboardSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeaderboardSheet({ open, onOpenChange }: LeaderboardSheetProps) {
  const [rows, setRows] = useState<LeaderboardRow[]>(prefetchedRows ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(prefetchedRows !== null);

  const applyRows = useCallback((data: unknown) => {
    const apiRows = Array.isArray(data) ? (data as LeaderboardRow[]) : [];
    const optimistic = getOptimisticScore();
    if (optimistic) {
      const found = apiRows.some(
        (r) => r.player.includes(optimistic.player.slice(2, 6)),
      );
      if (found) {
        clearOptimisticScore();
        setRows(apiRows);
        return;
      }
      const truncated = optimistic.player.slice(0, 6) + "..." + optimistic.player.slice(-4);
      setRows([
        ...apiRows,
        { rank: apiRows.length + 1, player: truncated, score: optimistic.score, isVerified: false },
      ]);
    } else {
      setRows(apiRows);
    }
  }, []);

  const fetchLeaderboard = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    fetch("/api/leaderboard")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then(applyRows)
      .catch(() => setError(LEADERBOARD_SHEET_COPY.error))
      .finally(() => setLoading(false));
  }, [applyRows]);

  // Prefetch on mount — data ready before user opens the sheet
  useEffect(() => {
    fetchLeaderboard();
    hasFetched.current = true;
  }, [fetchLeaderboard]);

  // On open: show cached data immediately, refresh in background
  useEffect(() => {
    if (!open || !hasFetched.current) return;
    fetchLeaderboard(false); // silent refresh, no loading flash
  }, [open, fetchLeaderboard]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Leaderboard"
          className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
        >
          <img
            src="/art/leaderboard-menu.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
          <span className="sr-only">Leaderboard</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell sheet-bg-leaderboard flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]">
        <div className="shrink-0 border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-none px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title flex items-center gap-2"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              <CandyIcon name="crown" className="h-5 w-5" />
              {LEADERBOARD_SHEET_COPY.title}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {LEADERBOARD_SHEET_COPY.description}
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="shrink-0 mt-3 flex flex-col items-center gap-2">
          <p
            className="text-center text-xs"
            style={{ color: "rgba(110, 65, 15, 0.70)" }}
          >
            {PASSPORT_COPY.infoBanner}
          </p>
          <a
            href={PASSPORT_COPY.passportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold transition-all active:scale-[0.97]"
            style={{
              background: "rgba(139, 92, 246, 0.28)",
              boxShadow: "inset 0 0 0 1px rgba(139, 92, 246, 0.55)",
              color: "rgba(55, 16, 120, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            <CandyIcon name="shield" className="h-3 w-3" />
            {PASSPORT_COPY.ctaLabel}
          </a>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-4 space-y-2">
          {!loading && !error && rows.length > 0 && (
            <div
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 pb-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              <p>#</p>
              <p>{LEADERBOARD_SHEET_COPY.columnPlayer}</p>
              <p>{LEADERBOARD_SHEET_COPY.columnScore}</p>
            </div>
          )}
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.45)] bg-white/15 px-3 py-2.5"
                >
                  <div className="h-4 w-6 animate-pulse rounded" style={{ background: "rgba(110, 65, 15, 0.15)" }} />
                  <div className="h-4 w-32 animate-pulse rounded" style={{ background: "rgba(110, 65, 15, 0.15)" }} />
                  <div className="h-4 w-10 animate-pulse rounded" style={{ background: "rgba(110, 65, 15, 0.15)" }} />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-sm" style={{ color: "rgba(159, 18, 57, 0.95)" }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => fetchLeaderboard()}
                className="min-h-[44px] text-xs underline transition-colors hover:opacity-80"
                style={{ color: "rgba(110, 65, 15, 0.85)" }}
              >
                {LEADERBOARD_SHEET_COPY.retry}
              </button>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <p
              className="text-center text-sm"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              {LEADERBOARD_SHEET_COPY.empty}
            </p>
          )}
          {rows.map((row) => (
            <div
              key={`${row.rank}-${row.player}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.45)] bg-white/15 px-3 py-2.5"
            >
              <p
                className="text-sm font-extrabold"
                style={{
                  color:
                    row.rank === 1 ? "#b45309"
                    : row.rank === 2 ? "rgba(71, 85, 105, 0.95)"
                    : row.rank === 3 ? "#92400e"
                    : "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                {row.rank <= 3 ? ["🥇","🥈","🥉"][row.rank - 1] : `#${row.rank}`}
              </p>
              <p
                className="truncate text-sm font-semibold"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                {row.player}
                {row.isVerified && (
                  <span title={PASSPORT_COPY.verifiedLabel}>
                    <CandyIcon name="check" className="ml-1.5 inline-block h-3.5 w-3.5" />
                  </span>
                )}
              </p>
              <p
                className="text-sm font-extrabold tabular-nums"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                {row.score}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
