"use client";

import { useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LeaderboardRow } from "@/lib/server/leaderboard";
import { PASSPORT_COPY } from "@/lib/content/editorial";

type LeaderboardSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeaderboardSheet({ open, onOpenChange }: LeaderboardSheetProps) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data: LeaderboardRow[]) => setRows(data))
      .catch(() => setError("Could not load the leaderboard."))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Leaderboard"
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-cyan-100/70 transition"
        >
          <picture className="h-full w-full">
            <source srcSet="/art/ranking-chesscito.avif" type="image/avif" />
            <source srcSet="/art/ranking-chesscito.webp" type="image/webp" />
            <img src="/art/ranking-chesscito.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
          </picture>
          <span className="sr-only">Leaderboard</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell sheet-bg-leaderboard rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">Hall of Rooks</SheetTitle>
          <SheetDescription className="text-cyan-100/75">Check the leaderboard without leaving the board.</SheetDescription>
        </SheetHeader>
        <p className="mt-3 text-center text-xs text-cyan-100/60">
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
        <div className="mt-4 space-y-2">
          {loading && (
            <p className="text-center text-sm text-cyan-100/60">Loading...</p>
          )}
          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="text-center text-sm text-cyan-100/60">No scores recorded yet.</p>
          )}
          {rows.map((row) => (
            <div key={row.rank} className="mission-soft rune-frame grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2">
              <p className="text-sm font-semibold text-cyan-100">#{row.rank}</p>
              <p className="text-sm text-slate-300">
                {row.player}
                {row.isVerified && (
                  <span className="ml-1.5 inline-block text-emerald-400" title={PASSPORT_COPY.verifiedLabel}>
                    ✓
                  </span>
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
