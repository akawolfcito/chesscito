"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { CoachResponse } from "@/lib/coach/types";
import { formatTime } from "@/lib/game/arena-utils";

type Props = {
  response: CoachResponse;
  difficulty: string;
  totalMoves: number;
  elapsedMs: number;
  credits: number;
  onPlayAgain: () => void;
  /** Hub back affordance — kept on the prop interface so callers
   *  needn't be updated, but no longer rendered as a footer link.
   *  The host shell (CandyGlassShell) already exposes a top-right
   *  close control that fires this handler, so the duplicate link
   *  read as visual clutter without adding any new exit path. */
  onBackToHub: () => void;
  onViewHistory?: () => void;
  /** PR 4: surfaces PRO-only history footer when truthy alongside historyMeta. */
  proActive?: boolean;
  /** PR 4: drives the footer's "Building your history…" / "Reviewing N past games" wording. */
  historyMeta?: { gamesPlayed: number };
  /** 2026-05-24: locale of the cached analysis (drives the EN/ES badge).
   *  Falls back to the active UI locale when the server didn't echo it
   *  back — only relevant for legacy records that pre-date the
   *  per-locale cache key. */
  analysisLocale?: "en" | "es";
  /** 2026-05-24: parent-owned reanalyze handler. When provided, the
   *  panel shows a "Reanalyze" text-link CTA next to the secondary
   *  history button; tapping it opens an inline confirm sheet. The
   *  handler is responsible for the credit-check + fresh fetch. */
  onReanalyze?: () => Promise<void>;
  /** Parent-driven "Generating new analysis…" state — drives the
   *  CTA's disabled state and the confirm sheet's working flag. */
  isReanalyzing?: boolean;
};

export function CoachPanel({
  response,
  difficulty,
  totalMoves,
  elapsedMs,
  credits,
  onPlayAgain,
  onBackToHub: _onBackToHub,
  onViewHistory,
  proActive,
  historyMeta,
  analysisLocale,
  onReanalyze,
  isReanalyzing,
}: Props) {
  const t = useTranslations("COACH_COPY");
  const tArena = useTranslations("ARENA_COPY");
  const activeLocale = useLocale() as "en" | "es";
  const [confirmReanalyzeOpen, setConfirmReanalyzeOpen] = useState(false);
  // Prop kept on the interface for caller compatibility but no longer
  // rendered (shell exposes the close control). Reference it so the
  // unused-vars linter stays quiet.
  void _onBackToHub;
  const time = formatTime(elapsedMs);
  const diffLabel =
    (tArena.raw("difficulty") as Record<string, string>)[difficulty] ??
    difficulty;
  const warmText = "rgba(63, 34, 8, 0.95)";
  const warmMuted = "rgba(110, 65, 15, 0.75)";
  const warmSubtle = "rgba(110, 65, 15, 0.55)";
  const cream = "0 1px 0 rgba(255, 245, 215, 0.55)";

  // Locale badge: prefer the server-echoed locale (matches the actual
  // record on cache), fall back to the active UI locale (legacy records
  // never carried this field — see CoachAnalysisRecord.locale docstring).
  const badgeLocale: "en" | "es" = analysisLocale ?? activeLocale;
  const badgeLabel = (t.raw("analysisLocaleBadge") as Record<string, string>)[badgeLocale];
  const badgeAria = t("analysisLocaleBadge.ariaLabel", { locale: badgeLabel });

  async function handleReanalyzeConfirm() {
    if (!onReanalyze) return;
    try {
      await onReanalyze();
    } finally {
      setConfirmReanalyzeOpen(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {proActive && historyMeta && (
        <p
          className="text-xs text-center"
          style={{ color: warmSubtle }}
        >
          {t("historyBannerSubtitle")}
        </p>
      )}

      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            data-testid="coach-analysis-locale-badge"
            aria-label={badgeAria}
            className="rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              borderColor: "rgba(110, 65, 15, 0.3)",
              color: warmMuted,
              backgroundColor: "rgba(255, 245, 215, 0.5)",
            }}
          >
            {badgeLabel}
          </span>
          <p className="text-xs" style={{ color: warmMuted }}>
            {diffLabel} - {totalMoves} moves - {time}
          </p>
        </div>
        <span className="text-xs font-semibold" style={{ color: warmSubtle }}>
          {credits} credits
        </span>
      </div>

      {/* Summary */}
      <div className="candy-tray">
        <p className="[overflow-wrap:anywhere] text-sm italic" style={{ color: warmText, textShadow: cream }}>
          {`"${response.summary}"`}
        </p>
      </div>

      {/* Key Moments */}
      {response.mistakes.length > 0 && (
        <section>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: warmMuted }}
          >
            {t("keyMoments")}
          </h3>
          <div className="flex flex-col gap-3">
            {response.mistakes.map((m) => (
              <div key={m.moveNumber} className="candy-tray">
                <p className="[overflow-wrap:anywhere] text-xs font-semibold" style={{ color: warmText, textShadow: cream }}>
                  {t("moveLabel", { moveNumber: m.moveNumber, move: m.played })}
                </p>
                <p className="[overflow-wrap:anywhere] text-xs font-semibold text-emerald-700">
                  {t("tryInstead", { move: m.better })}
                </p>
                <p className="[overflow-wrap:anywhere] mt-1 text-xs" style={{ color: warmMuted }}>
                  {`"${m.explanation}"`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Takeaways — merged praise + lessons */}
      {(response.praise.length > 0 || response.lessons.length > 0) && (
        <section>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: warmMuted }}
          >
            {t("takeaways")}
          </h3>
          <ul className="flex flex-col gap-1">
            {response.praise.map((p, i) => (
              <li key={`p-${i}`} className="[overflow-wrap:anywhere] text-sm" style={{ color: warmText, textShadow: cream }}>
                {"\u2713"} {p}
              </li>
            ))}
            {response.lessons.map((l, i) => (
              <li key={`l-${i}`} className="[overflow-wrap:anywhere] text-sm" style={{ color: warmText, textShadow: cream }}>
                {"\u2192"} {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CTAs — Play Again primary, History secondary. The host shell
       *  (CandyGlassShell) already owns the back-to-hub affordance via
       *  its top-right close control, so the previous footer link was
       *  removed (2026-05-24 — duplicated exit affordance feedback). */}
      <div className="mt-2 flex flex-col gap-2">
        <Button type="button" variant="game-primary" size="game" onClick={onPlayAgain}>
          <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" />{" "}
          {tArena("playAgain")}
        </Button>
        {onViewHistory && (
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onViewHistory}
            style={{
              borderColor: "rgba(110, 65, 15, 0.25)",
              color: warmMuted,
            }}
          >
            {t("pastSessions")}
          </Button>
        )}
        {onReanalyze && (
          <button
            type="button"
            data-testid="coach-reanalyze-cta"
            onClick={() => setConfirmReanalyzeOpen(true)}
            disabled={isReanalyzing}
            aria-label={t("reanalyze.ariaLabel")}
            className="self-center text-xs underline underline-offset-2 disabled:opacity-50"
            style={{ color: warmSubtle }}
          >
            {isReanalyzing ? t("reanalyze.inFlightLabel") : t("reanalyze.cta")}
          </button>
        )}
      </div>

      {proActive && historyMeta && (
        <p
          data-testid="coach-history-footer"
          className="mt-3 text-nano text-center"
          style={{ color: warmSubtle }}
        >
          {historyMeta.gamesPlayed === 0
            ? t("historyFooter.building")
            : t("historyFooter.reviewing", { count: historyMeta.gamesPlayed })}
          {" · "}
          <Link href="/coach/history" className="underline underline-offset-2">
            {t("historyFooter.manageLabel")}
          </Link>
        </p>
      )}

      {/* Reanalyze confirm sheet — non-destructive variant of the
       *  ConfirmDeleteSheet pattern. We render inline (instead of
       *  reusing that component) because its rose-tinted styling is
       *  reserved for destructive actions; reanalyze just spends a
       *  credit and regenerates. */}
      {onReanalyze && (
        <Sheet
          open={confirmReanalyzeOpen}
          onOpenChange={(o) => {
            if (!isReanalyzing) setConfirmReanalyzeOpen(o);
          }}
        >
          <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-0">
            <SheetTitle style={{ color: warmText }}>
              {t("reanalyze.confirmTitle")}
            </SheetTitle>
            <SheetDescription className="text-sm" style={{ color: warmMuted }}>
              {/* PRO subscribers don't spend credits — the server's
               *  /api/coach/analyze short-circuits the DECR. Branching
               *  the copy keeps the confirm honest about the actual
               *  cost the user is about to incur. */}
              {proActive
                ? t("reanalyze.confirmBodyPro")
                : t("reanalyze.confirmBody")}
            </SheetDescription>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                type="button"
                variant="game-primary"
                size="game"
                onClick={handleReanalyzeConfirm}
                disabled={isReanalyzing}
              >
                {t("reanalyze.confirmAccept")}
              </Button>
              <Button
                type="button"
                variant="game-ghost"
                size="game-sm"
                onClick={() => setConfirmReanalyzeOpen(false)}
                disabled={isReanalyzing}
              >
                {t("reanalyze.confirmCancel")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
