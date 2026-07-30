"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
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
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { LeaderboardRow } from "@/lib/server/leaderboard";
import { PlayerIdentityPill } from "@/components/identity/player-identity-pill";
import { PinStatusMarker } from "@/components/redesign/pin-status-marker";
import { useNicknameTokens } from "@/lib/identity/use-nickname-tokens";
import { isWeeklyLeadersEnabled } from "@/lib/feature-flags";
import { useDisplayName } from "@/hooks/use-display-name";
import {
  deriveAvatarVariant,
  deriveRowId,
  formatNickname,
} from "@/lib/identity/identity-lite";

const OPTIMISTIC_TTL_MS = 2 * 60 * 1000;

/** Which ranking is on screen (Slice 2C). */
type LeaderWindow = "weekly" | "alltime";

/** Per-device tab memory. Read AFTER hydration — never during the first paint. */
const TAB_STORAGE_KEY = "chesscito:leaders-tab";

/**
 * One slot per tab.
 *
 * The single `hasFetched` ref this replaced could not express "weekly fetched,
 * all-time not", and reusing it renders one tab's data under the other's header.
 */
type TabState = {
  rows: LeaderboardRow[];
  ownRow: LeaderboardRow | null;
  fetched: boolean;
  /** A save landed while the other tab was active; refetch on activation. */
  stale: boolean;
  /** Ranked POPULATION for this window, from the server's count over the uncut
   *  relation. `undefined` = unknown, and the hero then omits the figure: the
   *  board is a top-10 cut, so deriving it from `rows` is a claim that cannot
   *  exceed 10 (it read "10 players" beside a footer ranked 13th). */
  total?: number;
  /** Weekly only. A CHANGE here is a week rollover: replace, never merge. */
  weekStart?: string;
};

const EMPTY_TAB: TabState = {
  rows: [],
  ownRow: null,
  fetched: false,
  stale: false,
};

/** The weekly envelope (Slice 2B). All-time keeps the two legacy shapes. */
type WeeklyPayload = {
  window: LeaderWindow;
  rows: LeaderboardRow[];
  player: LeaderboardRow | null;
  /** Absent when the server's count failed — see `TabState.total`. */
  total?: number;
  weekStart?: string;
  weekEnd?: string;
  surface?: string;
};

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
  /** Increment to force a silent refetch while the sheet is open.
   *  Wired from exercises-screen after a successful score save so the
   *  leaderboard reflects the new row without requiring close/reopen. */
  refreshTrigger?: number;
  /** Save-On-Chain, surfaced here as the PRIMARY entry point (founder
   *  2026-07-23). When a score is waiting, the own-rank footer becomes a
   *  tappable CTA that runs the same handler as the Missions "Save proof"
   *  button. Absent/false → the footer stays a static rank readout. */
  canSaveOnChain?: boolean;
  onSaveOnChain?: () => void;
  isSavingOnChain?: boolean;
};

export function LeaderboardSheet({ open, onOpenChange, showTrigger = true, refreshTrigger, canSaveOnChain, onSaveOnChain, isSavingOnChain }: LeaderboardSheetProps) {
  const t = useTranslations("LEADERBOARD_SHEET_COPY");
  // Passport verify banner is hidden until we ship Celo-native verification.
  // See the disabled JSX block below for the revival point.
  // const tPassport = useTranslations("PASSPORT_COPY");
  const tDock = useTranslations("DOCK_LABELS");
  const { address } = useAccount();
  const nicknameTokens = useNicknameTokens();
  const { customName } = useDisplayName(address);
  const weeklyEnabled = isWeeklyLeadersEnabled();

  /** First paint is ALWAYS weekly when the flag is on. A stored preference is
   *  applied in an effect below — deciding from unhydrated storage is the exact
   *  shape of an intermittent bug this codebase has already hit three times. */
  const [active, setActive] = useState<LeaderWindow>(
    weeklyEnabled ? "weekly" : "alltime",
  );
  const [tabs, setTabs] = useState<Record<LeaderWindow, TabState>>({
    weekly: EMPTY_TAB,
    alltime: EMPTY_TAB,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = tabs[active].rows;
  const ownRow = tabs[active].ownRow;
  const total = tabs[active].total;

  /** Read at RESOLVE time, so a response for a tab the player already left is
   *  discarded instead of landing in the other tab's slot. */
  const activeRef = useRef(active);
  activeRef.current = active;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  useEffect(() => {
    if (!weeklyEnabled) return;
    try {
      const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (stored === "alltime") setActive("alltime");
    } catch {
      /* storage unavailable — weekly stays the default */
    }
  }, [weeklyEnabled]);

  const selectTab = useCallback((next: LeaderWindow) => {
    setActive(next);
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the choice just does not survive a reload */
    }
  }, []);

  const applyPayload = useCallback((win: LeaderWindow, data: unknown) => {
    // Weekly is the Slice 2B envelope; all-time keeps the two legacy shapes,
    // a bare array or { rows, player }.
    const payload = data as
      | LeaderboardRow[]
      | { rows: LeaderboardRow[]; player: LeaderboardRow | null }
      | WeeklyPayload;
    const apiRows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];
    const player = Array.isArray(payload) ? null : payload?.player ?? null;
    // Only a NUMBER counts as a population. The legacy shapes carry none, and a
    // failed count omits the field; both must leave this undefined so the hero
    // stays silent rather than substituting the row count. `typeof` and not a
    // truthy check, so a real 0 survives.
    const total =
      !Array.isArray(payload) && typeof (payload as WeeklyPayload)?.total === "number"
        ? (payload as WeeklyPayload).total
        : undefined;
    const weekStart =
      !Array.isArray(payload) && "weekStart" in payload
        ? payload.weekStart
        : undefined;

    // The optimistic entry is consumed by PRESENCE of its rowId — the check
    // that already existed here. Comparing optimistic.score (one exercise)
    // against a row's score (a per-player total) would type-check and mean
    // nothing.
    const optimistic = getOptimisticScore();
    const optimisticRowId = optimistic
      ? deriveRowId(optimistic.player.toLowerCase())
      : null;
    const alreadyThere =
      optimisticRowId !== null &&
      (apiRows.some((r) => r.rowId === optimisticRowId) ||
        player?.rowId === optimisticRowId);
    if (alreadyThere) clearOptimisticScore();

    // WEEKLY NEVER APPENDS IT. An absent own row is the EXPECTED state there,
    // so the append heuristic would fabricate a rank; and the entry carries no
    // surface, so a Play score could be painted onto a Learn board.
    const withOptimistic =
      win === "alltime" && optimistic && optimisticRowId && !alreadyThere
        ? [
            ...apiRows,
            {
              rank: apiRows.length + 1,
              rowId: optimisticRowId,
              variant: deriveAvatarVariant(optimistic.player.toLowerCase()),
              score: optimistic.score,
              isVerified: false,
            },
          ]
        : apiRows;

    // Wholesale replacement, never a merge: on a week rollover `weekStart`
    // changes and the previous week's rows must not survive it.
    setTabs((prev) => ({
      ...prev,
      [win]: {
        rows: withOptimistic,
        ownRow: player,
        fetched: true,
        stale: false,
        total,
        weekStart,
      },
    }));
  }, []);

  const fetchWindow = useCallback(
    (win: LeaderWindow, showLoading: boolean) => {
      if (showLoading) setLoading(true);
      setError(null);
      // All-time asks for the WINDOWED shape only when the tabs exist. That
      // envelope is the one that carries `total`; the bare legacy shape is
      // frozen and cannot grow one. With the flag off this stays on the legacy
      // URL — byte-identical to its pre-slice self — and the hero simply shows
      // no player count, which is the honest reading of "we were not told".
      const windowed = win === "weekly" || weeklyEnabled;
      const base = windowed
        ? `/api/leaderboard?window=${win}`
        : "/api/leaderboard";
      const url = address
        ? `${base}${windowed ? "&" : "?"}player=${address}`
        : base;
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("fetch failed");
          return r.json();
        })
        .then((data) => {
          if (activeRef.current !== win) return;
          applyPayload(win, data);
        })
        .catch(() => {
          if (activeRef.current !== win) return;
          setError(t("error"));
        })
        .finally(() => setLoading(false));
    },
    [applyPayload, t, address, weeklyEnabled],
  );

  const refreshRef = useRef(refreshTrigger);

  useEffect(() => {
    if (!open) return;

    const refreshed = refreshRef.current !== refreshTrigger;
    refreshRef.current = refreshTrigger;

    if (refreshed) {
      // The active tab refetches now; the other is marked stale so it refetches
      // when the player next lands on it, rather than firing two requests for a
      // screen showing one board.
      const other: LeaderWindow = active === "weekly" ? "alltime" : "weekly";
      setTabs((prev) => ({ ...prev, [other]: { ...prev[other], stale: true } }));
      fetchWindow(active, false);
      return;
    }

    const state = tabsRef.current[active];
    if (state.fetched && !state.stale) return;
    fetchWindow(active, !state.fetched);
  }, [open, active, refreshTrigger, fetchWindow]);

  const champion = rows.find(r => r.rank === 1);
  // The list is the FULL board — every player including #1 and the caller
  // (founder 2026-06-16). The "THE RANKING" banner is just a podium highlight
  // for the champion, and the pinned YOUR RANK footer is a shortcut so a
  // far-down player (e.g. #1234567) can see their position without an endless
  // scroll. The caller's row is highlighted in-list (see `--own`) AND mirrored
  // in the footer on purpose, so the list no longer mysteriously starts at #3.
  const competitors = rows;

  // Resolve a row's display name from its server-derived variant. The own row
  // is overridden by the user's explicit custom name when set.
  const rowName = (row: LeaderboardRow, isOwn = false): string => {
    if (isOwn) {
      const trimmed = customName?.trim();
      if (trimmed) return trimmed;
    }
    return formatNickname(row.variant, nicknameTokens);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={tDock("leaderboard")}
            className="relative flex shrink-0 items-center justify-center"
          >
            <ThemeAssetPicture slot="exercises.leaderboard-menu" alt="" aria-hidden="true" className="h-full w-full object-contain" />
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
            iconSlot={<TileIconSlot slot="exercises.leaderboard-menu" />}
            title={t("title")}
            subtitle={t("description")}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        {/* WINDOW TABS (Slice 2C). Absent entirely when the flag is off, so the
            sheet is byte-identical to its pre-slice self. */}
        {weeklyEnabled ? (
          <div
            role="tablist"
            aria-label={t("tabsAriaLabel")}
            className="leaderboard-window-tabs shrink-0"
          >
            {(["weekly", "alltime"] as const).map((win) => (
              <button
                key={win}
                type="button"
                role="tab"
                aria-selected={active === win}
                onClick={() => selectTab(win)}
                className={`leaderboard-window-tab${
                  active === win ? " is-active" : ""
                }`}
              >
                {win === "weekly" ? t("tabWeekly") : t("tabAllTime")}
              </button>
            ))}
          </div>
        ) : null}

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
            <ThemeAssetPicture slot="exercises.leaderboard-crown" pictureClassName="leaderboard-vitrine-hero-anchor" alt="" aria-hidden="true" draggable={false} />
            <div className="leaderboard-vitrine-hero-content">
              <p className="leaderboard-vitrine-hero-eyebrow">{t("heroEyebrow")}</p>
              {champion ? (
                <>
                  <p className="leaderboard-vitrine-hero-stats">
                    {t("heroChampionLabelFormat", { player: rowName(champion) })}
                  </p>
                  {/* The count is the server's POPULATION or nothing at all.
                      `rows` is the top-10 cut, so a figure taken from it can
                      never exceed 10 — that is how the hero came to announce
                      "10 players" to a player whose footer read rank 13.
                      Not `total + optimisticRow` either: the optimistic entry
                      is the caller, who is already counted whenever they were
                      ranked before. */}
                  <p className="leaderboard-vitrine-hero-sub">
                    {total === undefined
                      ? t("heroChampionScoreFormat", { score: champion.score })
                      : t("heroChampionStatsFormat", {
                          score: champion.score,
                          count: total,
                        })}
                  </p>
                </>
              ) : (
                <>
                  {/* A fresh Monday is not the same emptiness as "nobody has
                      ever played": the weekly board says so out loud.
                      NOT while `error` is set, though — "the board is just
                      getting started" is a factual claim about the week, and we
                      have no data to make it when the fetch failed. Falling back
                      to the generic copy also leaves all-time's error rendering
                      exactly as it was. */}
                  <p className="leaderboard-vitrine-hero-stats">
                    {active === "weekly" && !error
                      ? t("weeklyEmptyHeadline")
                      : t("heroEmptyHeadline")}
                  </p>
                  <p className="leaderboard-vitrine-hero-sub">
                    {active === "weekly" && !error
                      ? t("weeklyEmptyHint")
                      : t("heroEmptyHint")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pb-6">
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
                // Scoped to the tab that failed: retrying the weekly board must
                // not go and refetch all-time.
                onClick={() => fetchWindow(active, true)}
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
              {competitors.map((row) => {
                const isOwn = !!ownRow && row.rowId === ownRow.rowId;
                return (
                <div
                  key={`${row.rank}-${row.rowId}`}
                  className={`leaderboard-row-compact ${
                    isOwn ? "leaderboard-row-compact--own"
                    : row.rank === 1 ? "leaderboard-row-compact--top1"
                    : row.rank === 2 ? "leaderboard-row-compact--top2"
                    : row.rank === 3 ? "leaderboard-row-compact--top3"
                    : ""
                  }`}
                >
                  <div className="leaderboard-rank-pill">
                    {row.rank}
                  </div>
                  <div className="flex flex-1 min-width-0 items-center gap-1.5">
                    <PlayerIdentityPill
                      variant={row.variant}
                      name={rowName(row, isOwn)}
                      size="sm"
                      className="text-xs font-black text-[rgba(63,34,8,0.90)]"
                    />
                    {row.isVerified && (
                      <CandyIcon name="check" className="inline-block h-3 w-3 text-emerald-600" />
                    )}
                    {row.hasOnchain && (
                      // QA 2026-06-11: on-chain seal — this player has at least
                      // one score written through the Scoreboard contract.
                      <CandyIcon
                        name="fingerprint"
                        label={t("onchainMarkerAria")}
                        className="inline-block h-3 w-3 opacity-80"
                      />
                    )}
                  </div>
                  <p className="text-sm font-black tabular-nums text-[rgba(63,34,8,0.95)]">
                    {row.score}
                  </p>
                </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Your Rank — PINNED footer (founder 2026-06-15). Lives OUTSIDE
            the scroll container so it stays anchored at the bottom and
            is always visible while the Top Competitors list scrolls,
            whenever the caller has a ranked row (QA G4 2026-06-11). */}
        {ownRow ? (() => {
          // Primary Save-On-Chain entry (founder 2026-07-23): when a score
          // is waiting, the own-rank block becomes a tappable CTA. Visual
          // affordance only — a pulsing dot + pressable styling, no added
          // copy (Chesscito communicates visually). Falls back to the
          // static readout once saved or when there's nothing to save.
          const isCta = Boolean(canSaveOnChain && onSaveOnChain);
          const rowInner = (
            <>
              {isCta ? <PinStatusMarker status="pending" /> : null}
              <div className="leaderboard-rank-pill">{ownRow.rank}</div>
              <div className="flex flex-1 min-width-0 items-center gap-1.5">
                <PlayerIdentityPill
                  variant={ownRow.variant}
                  name={rowName(ownRow, true)}
                  size="sm"
                  className="text-xs font-black text-[rgba(63,34,8,0.90)]"
                />
                {ownRow.hasOnchain && (
                  <CandyIcon
                    name="fingerprint"
                    label={t("onchainMarkerAria")}
                    className="inline-block h-3 w-3 opacity-80"
                  />
                )}
              </div>
              <p className="text-sm font-black tabular-nums text-[rgba(63,34,8,0.95)]">
                {ownRow.score}
              </p>
            </>
          );
          return (
            <div className="leaderboard-own-rank-footer shrink-0">
              <div className="flex flex-col gap-2.5">
                {isCta ? (
                  <button
                    type="button"
                    data-testid="leaderboard-own-row"
                    data-cta="save-onchain"
                    aria-label={t("saveOnChainAria")}
                    disabled={isSavingOnChain}
                    aria-busy={isSavingOnChain || undefined}
                    onClick={onSaveOnChain}
                    className="leaderboard-row-compact leaderboard-row-compact--identity leaderboard-own-rank-cta"
                  >
                    {rowInner}
                  </button>
                ) : (
                  <div
                    data-testid="leaderboard-own-row"
                    className="leaderboard-row-compact leaderboard-row-compact--identity"
                  >
                    {rowInner}
                  </div>
                )}
              </div>
            </div>
          );
        })() : null}

        {/* WEEKLY CTA FOOTER (Slice 2C). Replaces the rank footer when the
            player has not played this week — which on the weekly board is the
            ORDINARY state, not an error. Same shell class as the rank footer so
            switching tabs does not jump the layout.
            All-time keeps its own behaviour: no CTA there, since an absent row
            genuinely means "never played". */}
        {weeklyEnabled && active === "weekly" && !ownRow && address ? (
          <div
            data-testid="leaderboard-weekly-cta"
            className="leaderboard-own-rank-footer leaderboard-weekly-cta shrink-0"
          >
            <Link href="/arena?fresh=1" onClick={() => onOpenChange(false)}>
              <div className="leaderboard-row-compact leaderboard-row-compact--identity flex-col items-start gap-0.5">
                <p className="text-xs font-black uppercase tracking-wider text-[rgba(63,34,8,0.95)]">
                  {t("weeklyCtaTitle")}
                </p>
                <p className="text-[0.7rem] font-medium text-[rgba(63,34,8,0.70)]">
                  {t("weeklyCtaHint")}
                </p>
              </div>
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
