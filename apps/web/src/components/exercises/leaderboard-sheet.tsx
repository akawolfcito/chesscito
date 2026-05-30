"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import type { LeaderboardRow } from "@/lib/server/leaderboard";

const OPTIMISTIC_TTL_MS = 2 * 60 * 1000;

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
  /** Render the built-in `<SheetTrigger>` dock button. Default `true`
   *  for legacy callers. Pass `false` from surfaces that control open
   *  state externally (e.g. /arena via `?sheet=leaderboard`) and never
   *  want the orphan trigger floating in the layout tree — without
   *  this gate, Radix renders the button as a real DOM node sibling
   *  of the host and its `h-full w-full` image invades the layout. */
  showTrigger?: boolean;
};

export function LeaderboardSheet({ open, onOpenChange, showTrigger = true }: LeaderboardSheetProps) {
  const t = useTranslations("LEADERBOARD_SHEET_COPY");
  // Passport verify banner is hidden until we ship Celo-native verification.
  // See the disabled JSX block below for the revival point.
  // const tPassport = useTranslations("PASSPORT_COPY");
  const tDock = useTranslations("DOCK_LABELS");
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
      .catch(() => setError(t("error")))
      .finally(() => setLoading(false));
  }, [applyRows, t]);

  useEffect(() => {
    fetchLeaderboard();
    hasFetched.current = true;
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!open || !hasFetched.current) return;
    fetchLeaderboard(false);
  }, [open, fetchLeaderboard]);

  const champion = rows.find(r => r.rank === 1);
  const competitors = rows.filter(r => r.rank > 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={tDock("leaderboard")}
            className="relative flex shrink-0 items-center justify-center"
          >
            <img
              src="/art/leaderboard-menu.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
            />
          </button>
        </SheetTrigger>
      ) : null}
      <SheetContent
        side="bottom"
        hideClose
        title={t("title")}
        description={t("description")}
        className="mission-shell sheet-bg-leaderboard flex h-[100dvh] flex-col rounded-none border-0 pb-0"
      >
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/leaderboard-menu" />}
            title={t("title")}
            subtitle={t("description")}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        {/* HERO BAND — overview anchor that mirrors badge + trophy
         *  vitrines. Golden crown character anchors the cream-amber
         *  panel; the right column carries the champion summary +
         *  total players, or an empty hint when the board is fresh.
         *  2026-05-30: rendered as a sibling OUTSIDE the scroll
         *  container (mirror Badges + Trophies). The scroll's
         *  `overflow-y-auto` per CSS spec promotes overflow-x to auto
         *  and was clipping the anchor's `left: -1.25rem` overhang.
         *  Hoisting keeps the corona-pro visibly escaping the panel
         *  + makes the band a persistent overview header that doesn't
         *  scroll off with the competitors list. */}
        <div className="shrink-0 mt-4">
          <div className="leaderboard-vitrine-hero">
            <picture className="leaderboard-vitrine-hero-anchor">
              <source srcSet="/art/screen-mission/corona-pro.avif" type="image/avif" />
              <source srcSet="/art/screen-mission/corona-pro.webp" type="image/webp" />
              <img
                src="/art/screen-mission/corona-pro.png"
                alt=""
                aria-hidden="true"
                draggable={false}
              />
            </picture>
            <div className="leaderboard-vitrine-hero-content">
              <p className="leaderboard-vitrine-hero-eyebrow">{t("heroEyebrow")}</p>
              {champion ? (
                <>
                  <p className="leaderboard-vitrine-hero-stats">
                    {t("heroChampionLabelFormat", { player: champion.player })}
                  </p>
                  <p className="leaderboard-vitrine-hero-sub">
                    {t("heroChampionStatsFormat", { score: champion.score, count: rows.length })}
                  </p>
                </>
              ) : (
                <>
                  <p className="leaderboard-vitrine-hero-stats">
                    {t("heroEmptyHeadline")}
                  </p>
                  <p className="leaderboard-vitrine-hero-sub">
                    {t("heroEmptyHint")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-6 space-y-6 pb-[8rem]">
          {/* Verification Banner — DISABLED 2026-05-25.
           *
           *  Passport (Gitcoin) verification lives on a different chain
           *  than Celo. Until we ship Celo-native score verification,
           *  exposing this CTA in the Leaderboard sheet adds friction
           *  + cross-chain confusion without any payoff. Re-enable when
           *  the Celo verifier is in place; the translations + CSS
           *  (leaderboard-verify-banner) stay intact for the revival.
           *
           *  Also restore the `tPassport` translations hook at the top
           *  of this component when un-commenting.
           */}
          {/*
          <div className="leaderboard-verify-banner">
            <div className="flex items-center gap-2">
              <CandyIcon name="shield" className="h-4 w-4 text-violet-600" />
              <p className="text-xs font-bold text-violet-900/70">
                {tPassport("infoBanner")}
              </p>
            </div>
            <a
              href={tPassport("passportUrl")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 items-center justify-center rounded-lg bg-violet-600 px-3 text-xs font-black uppercase tracking-wider text-white transition active:scale-95"
            >
              {tPassport("ctaLabel")}
            </a>
          </div>
          */}

          {loading && rows.length === 0 && (
            <div className="space-y-3">
              <div className="h-40 animate-pulse rounded-[28px] bg-white/20" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/20" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 py-10">
              <p className="text-sm font-bold text-rose-800">
                {error}
              </p>
              <button
                type="button"
                onClick={() => fetchLeaderboard()}
                className="flex h-11 items-center justify-center px-6 rounded-xl bg-rose-600/10 text-xs font-black uppercase tracking-wider transition active:scale-95 text-rose-800"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 opacity-30">
                <CandyIcon name="crown" className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium opacity-60 leading-relaxed px-8">
                {t("empty")}
              </p>
              <Link href="/arena?fresh=1" onClick={() => onOpenChange(false)}>
                <button type="button" className="flex h-11 items-center justify-center px-8 rounded-xl bg-amber-500 font-black text-white uppercase text-xs tracking-widest transition active:scale-95 shadow-lg shadow-amber-500/20">
                  {t("emptyArenaLink")}
                </button>
              </Link>
            </div>
          )}

          {/* Champion duplicate card removed 2026-05-29 — the hero
              "THE RANKING" band above already surfaces champion +
              score; the duplicate card was visual noise that ate
              vertical space without adding new info. */}

          {competitors.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-nano font-black uppercase tracking-[0.2em] opacity-30">
                  {t("topCompetitors")}
                </span>
                <span className="text-nano font-black opacity-30">
                  {t("columnScore")}
                </span>
              </div>
              {competitors.map((row) => (
                <div
                  key={`${row.rank}-${row.player}`}
                  className={`leaderboard-row-compact ${
                    row.rank === 2 ? "leaderboard-row-compact--top2"
                    : row.rank === 3 ? "leaderboard-row-compact--top3"
                    : ""
                  }`}
                >
                  <div className="leaderboard-rank-pill">
                    {row.rank}
                  </div>
                  <div className="flex-1 min-width-0">
                    <p className="truncate text-xs font-black text-[rgba(63,34,8,0.90)]">
                      {row.player}
                      {row.isVerified && (
                        <CandyIcon name="check" className="ml-1.5 inline-block h-3 w-3 text-emerald-600" />
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-black tabular-nums text-[rgba(63,34,8,0.95)]">
                    {row.score}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
