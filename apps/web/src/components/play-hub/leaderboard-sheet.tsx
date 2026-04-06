"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Crown } from "lucide-react";

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

type LeaderboardSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeaderboardSheet({ open, onOpenChange }: LeaderboardSheetProps) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/leaderboard")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data: unknown) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError(LEADERBOARD_SHEET_COPY.error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchLeaderboard();
  }, [open, fetchLeaderboard]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Leaderboard"
          className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
        >
          <picture>
            <source srcSet="/art/leaderboard-menu.webp" type="image/webp" />
            <img src="/art/leaderboard-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5 dock-treat-base" />
          </picture>
          <span className="sr-only">Leaderboard</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell sheet-bg-leaderboard flex max-h-[85dvh] flex-col rounded-t-3xl border-white/[0.10]">
        <div className="shrink-0 border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle className="fantasy-title flex items-center gap-2 text-slate-100"><Crown size={20} className="text-purple-400/60" />{LEADERBOARD_SHEET_COPY.title}</SheetTitle>
            <SheetDescription className="text-cyan-100/75">{LEADERBOARD_SHEET_COPY.description}</SheetDescription>
          </SheetHeader>
        </div>
        <p className="shrink-0 mt-3 text-center text-xs text-cyan-100/60">
          {PASSPORT_COPY.infoBanner}{" "}
          <a
            href={PASSPORT_COPY.passportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-cyan-300/80 hover:text-cyan-200"
          >
            {PASSPORT_COPY.ctaLabel}
          </a>
        </p>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-4 space-y-2">
          {!loading && !error && rows.length > 0 && (
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-cyan-100/50">
              <p>#</p>
              <p>{LEADERBOARD_SHEET_COPY.columnPlayer}</p>
              <p>{LEADERBOARD_SHEET_COPY.columnScore}</p>
            </div>
          )}
          {loading && (
            <p className="text-center text-sm text-cyan-100/60">{LEADERBOARD_SHEET_COPY.loading}</p>
          )}
          {error && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-sm text-rose-400">{error}</p>
              <button
                type="button"
                onClick={fetchLeaderboard}
                className="min-h-[44px] text-xs text-cyan-300/70 underline transition-colors hover:text-cyan-200"
              >
                {LEADERBOARD_SHEET_COPY.retry}
              </button>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="text-center text-sm text-cyan-100/60">{LEADERBOARD_SHEET_COPY.empty}</p>
          )}
          {rows.map((row) => (
            <div key={row.rank} className="panel-base grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
              <p className="text-sm font-semibold text-cyan-100">
                {row.rank <= 3 ? ["🥇","🥈","🥉"][row.rank - 1] : `#${row.rank}`}
              </p>
              <p className="truncate text-sm text-slate-300">
                {`${row.player.slice(0, 6)}...${row.player.slice(-4)}`}
                {row.isVerified && (
                  <span title={PASSPORT_COPY.verifiedLabel}><BadgeCheck className="ml-1.5 inline-block h-3.5 w-3.5 text-emerald-400" /></span>
                )}
              </p>
              <p className="text-sm font-semibold text-cyan-100">{row.score}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
