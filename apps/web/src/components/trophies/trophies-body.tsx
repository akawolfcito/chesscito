"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import { PageSection } from "@/components/redesign/page-section";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { TrophyList } from "@/components/trophies/trophy-list";
import { AchievementsGrid } from "@/components/trophies/achievements-grid";
import { getVictoryAddress } from "@/lib/game/victory-events";
import { computeAchievements } from "@/lib/achievements/compute";
import { deriveLiteAchievements } from "@/lib/achievements/lite";
import { getDailyProgress, type DailyProgress } from "@/lib/daily/progress";
import { useCoachHistoryCount } from "@/lib/coach/use-coach-history-count";
import type { VictoryEntry } from "@/lib/game/victory-events";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { WelcomePackageStamp } from "@/components/welcome-package/welcome-package-stamp";
import {
  clearOptimisticVictory,
  getOptimisticVictory,
  toVictoryEntry,
  useTrophiesData,
  type ApiVictoryRow,
} from "@/components/trophies/trophies-data-provider";

type RoadmapItem = { title: string; description: string };

/** "Coming later" roadmap (Tournaments / VIP Passes / Seasonal Rewards) is
 *  hidden until further notice (founder 2026-06-16): show what exists, don't
 *  promise. Flip to true to bring it back. */
const SHOW_ROADMAP = false;

/** Compact time formatter used inside the HERO BAND's "Your best" line.
 *  Mirrors trophy-card.tsx#formatTimeMs but kept local so the hero
 *  doesn't pull a sibling-card private helper. */
function formatTimeMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * HERO BAND for the trophies surface. Extracted from `TrophiesBody` so it
 * can render OUTSIDE the parent scroll container — the scroll's
 * `overflow-y-auto` collapses overflow-x to `auto` per CSS spec and
 * clips the anchor's `left: -1.25rem` overhang. Rendering the band as
 * a sibling (shrink-0) lets the trofeo-épico character visibly escape
 * the panel's left edge, matching the Badges hero treatment.
 *
 * Consumers should pair this with `<TrophiesBody hideHero />` so the
 * hero is not duplicated.
 */
export function TrophiesHeroBand({ showAchievements = true }: { showAchievements?: boolean } = {}) {
  const t = useTranslations("TROPHY_VITRINE_COPY");
  const { victories } = useTrophiesData();
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({
    streak: 0,
    lastCompletedDate: null,
    totalCompleted: 0,
  });
  useEffect(() => {
    if (CHESSCITO_LITE_MODE) setDailyProgress(getDailyProgress());
  }, []);
  const liteAchievements = CHESSCITO_LITE_MODE ? deriveLiteAchievements(dailyProgress) : [];
  const summary = CHESSCITO_LITE_MODE
    ? {
        list: liteAchievements,
        earnedCount: liteAchievements.filter((a) => a.earned).length,
        total: liteAchievements.length,
      }
    : computeAchievements(victories);
  const victoryCount = CHESSCITO_LITE_MODE
    ? dailyProgress.totalCompleted
    : (victories?.length ?? 0);
  const hasVictories = !CHESSCITO_LITE_MODE && victoryCount > 0;
  const bestVictory = hasVictories
    ? [...(victories ?? [])].sort(
        (a, b) => a.totalMoves - b.totalMoves || a.timeMs - b.timeMs,
      )[0]
    : null;
  const achievementsPct =
    summary.total === 0 ? 0 : (summary.earnedCount / summary.total) * 100;

  return (
    <div className="trophy-vitrine-hero">
      <picture className="trophy-vitrine-hero-anchor">
        <source srcSet="/art/action-row/trofeo-epico.avif" type="image/avif" />
        <source srcSet="/art/action-row/trofeo-epico.webp" type="image/webp" />
        <img
          src="/art/action-row/trofeo-epico.png"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </picture>
      <div className="trophy-vitrine-hero-content">
        <p className="trophy-vitrine-hero-eyebrow">{t(CHESSCITO_LITE_MODE ? "heroEyebrowLite" : "heroEyebrow")}</p>
        <p className="trophy-vitrine-hero-stats">
          <span className="trophy-vitrine-hero-stats-victory">
            {victoryCount} {t(CHESSCITO_LITE_MODE ? "heroVictoriesLabelLite" : "heroVictoriesLabel")}
          </span>
          {showAchievements ? (
            <>
              <span className="trophy-vitrine-hero-stats-sep" aria-hidden="true">·</span>
              <span className="trophy-vitrine-hero-stats-ach">
                {summary.earnedCount}/{summary.total} {t("heroAchievementsLabel")}
              </span>
            </>
          ) : null}
        </p>
        <p className="trophy-vitrine-hero-sub">
          {bestVictory
            ? t("heroBestLabelFormat", {
                moves: bestVictory.totalMoves,
                time: formatTimeMs(bestVictory.timeMs),
              })
            : t(CHESSCITO_LITE_MODE ? "heroEmptyHintLite" : "heroEmptyHint")}
        </p>
        {showAchievements ? (
          <div className="trophy-vitrine-hero-progress">
            <div
              className="trophy-vitrine-hero-progress-fill"
              style={{ width: `${achievementsPct}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TrophiesBody({
  hideHero,
  showAchievements = true,
  showHallOfFame = true,
}: {
  hideHero?: boolean;
  showAchievements?: boolean;
  showHallOfFame?: boolean;
} = {}) {
  const t = useTranslations("TROPHY_VITRINE_COPY");
  const tAch = useTranslations("ACHIEVEMENTS_COPY");
  const tRoad = useTranslations("ROADMAP_COPY");
  const { address, isConnected } = useAccount();
  const { connectWallet } = useConnectWallet();
  // Save Later (2026-05-31): empty-state secondary CTA "Or save a past
  // victory" only renders when the user has at least one match in
  // history. Gating prevents a brand-new user from being routed to an
  // empty /coach/history dead-end.
  const { rowCount: historyRowCount } = useCoachHistoryCount(address);
  const hasPastMatches = (historyRowCount ?? 0) > 0;

  const {
    victories: myVictories,
    loading: myLoading,
    error: myError,
    reload: loadMyVictories,
  } = useTrophiesData();

  const [hallOfFame, setHallOfFame] = useState<VictoryEntry[]>();
  const [hofLoading, setHofLoading] = useState(true);
  const [hofError, setHofError] = useState<string | null>(null);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({
    streak: 0,
    lastCompletedDate: null,
    totalCompleted: 0,
  });
  useEffect(() => {
    if (CHESSCITO_LITE_MODE) setDailyProgress(getDailyProgress());
  }, []);

  const configured = getVictoryAddress() !== null;

  const loadHallOfFame = useCallback(async () => {
    if (!showHallOfFame || CHESSCITO_LITE_MODE || !configured) {
      setHofLoading(false);
      return;
    }
    setHofLoading(true);
    setHofError(null);
    try {
      const res = await fetch("/api/hall-of-fame");
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic) {
        const found = entries.some((e) => e.player.toLowerCase() === optimistic.player.toLowerCase());
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setHallOfFame(entries);
    } catch {
      setHofError(t("loadError"));
    } finally {
      setHofLoading(false);
    }
  }, [configured, showHallOfFame, t]);

  useEffect(() => {
    void loadHallOfFame();
  }, [loadHallOfFame]);

  // Lite achievements are local Daily Focus progress and do not depend on
  // the legacy victory-contract configuration. Preserve the Full fallback.
  if (!configured && !CHESSCITO_LITE_MODE) {
    return (
      <div className="trophy-empty-card flex flex-col items-center gap-3 p-6 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(110, 65, 15, 0.18)" }}
        >
          <CandyIcon name="trophy" className="h-6 w-6" />
        </div>
        <p
          className="text-sm font-semibold leading-relaxed"
          style={{ color: "rgba(63, 34, 8, 0.85)" }}
        >
          {t("configError")}
        </p>
      </div>
    );
  }

  const hasVictories = (myVictories?.length ?? 0) > 0;
  const isChampion = isConnected && hasVictories;
  const isEmptyConnected = isConnected && myVictories?.length === 0 && !myLoading && !myError;
  const liteAchievements = CHESSCITO_LITE_MODE ? deriveLiteAchievements(dailyProgress) : [];
  const summary = CHESSCITO_LITE_MODE
    ? {
        list: liteAchievements,
        earnedCount: liteAchievements.filter((a) => a.earned).length,
        total: liteAchievements.length,
      }
    : computeAchievements(myVictories);
  const victoryCount = CHESSCITO_LITE_MODE
    ? dailyProgress.totalCompleted
    : (myVictories?.length ?? 0);
  /** Best run = fewest moves, ties broken by shortest time. Drives the
   *  HERO BAND's "Your best" line. Stays null when the user has no
   *  victories yet so the empty hint shows in its place. */
  const bestVictory = !CHESSCITO_LITE_MODE && hasVictories
    ? [...(myVictories ?? [])].sort(
        (a, b) => a.totalMoves - b.totalMoves || a.timeMs - b.timeMs,
      )[0]
    : null;
  const achievementsPct =
    summary.total === 0 ? 0 : (summary.earnedCount / summary.total) * 100;

  const myVictoriesSection = (
    <PageSection
      key="my-victories"
      icon={<CandyIcon name="crown" className="h-4 w-4" />}
      title={t("myVictories")}
    >
      {!isConnected ? (
        <div className="trophy-empty-card flex flex-col items-center gap-4 p-6 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(110, 65, 15, 0.18)" }}
          >
            <CandyIcon name="wallet" className="h-7 w-7" />
          </div>
          <p
            className="text-sm font-semibold leading-relaxed px-4"
            style={{ color: "rgba(63, 34, 8, 0.85)" }}
          >
            {t("connectWallet")}
          </p>
          <PrincipalButton
            size="medium"
            onClick={() => connectWallet()}
          >
            {t("connectWalletButton")}
          </PrincipalButton>
        </div>
      ) : isEmptyConnected ? (
        <div className="trophy-empty-card flex flex-col items-center gap-5 p-8 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: "rgba(255, 224, 102, 0.55)" }}
            />
            <CandyIcon name="trophy" className="relative h-10 w-10" />
          </div>
          {/* Narrative empty-state — sells the reward (collectible for
           *  life) in plain language. Lead with the headline so the
           *  visual-first user gets the promise even if they don't read
           *  the sub. */}
          <div className="flex flex-col items-center gap-1.5 px-2">
            <p
              className="text-base font-extrabold leading-tight"
              style={{ color: "rgba(63, 34, 8, 0.95)" }}
            >
              {t(CHESSCITO_LITE_MODE ? "firstVictoryHeadlineLite" : "firstVictoryHeadline")}
            </p>
            <p
              className="text-sm font-semibold leading-relaxed"
              style={{ color: "rgba(63, 34, 8, 0.75)" }}
            >
              {t(CHESSCITO_LITE_MODE ? "firstVictorySubLite" : "firstVictorySub")}
            </p>
          </div>
          {CHESSCITO_LITE_MODE ? (
            <Link
              href="/exercises"
              className="principal-button principal-button-medium inline-flex w-full items-center justify-center text-center"
            >
              <span className="principal-button-label">
                {t("practiceLink")}
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/arena?fresh=1"
                className="principal-button principal-button-medium inline-flex w-full items-center justify-center text-center"
              >
                <span className="principal-button-label">
                  {t("arenaLink")}
                </span>
              </Link>
              {hasPastMatches && (
                <Link
                  href="/coach/history"
                  className="text-sm font-semibold underline decoration-dotted underline-offset-4"
                  style={{ color: "rgba(63, 34, 8, 0.78)" }}
                >
                  {t("saveLaterFromHistoryLink")}
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <TrophyList
          victories={myVictories}
          loading={myLoading}
          error={myError}
          emptyMessage={t("noVictories")}
          variant="victory"
          onRetry={loadMyVictories}
        />
      )}
    </PageSection>
  );

  const achievementsSection = (
    <PageSection
      key="achievements"
      icon={<CandyIcon name="star" className="h-4 w-4" />}
      title={tAch("sectionTitle")}
    >
      {(CHESSCITO_LITE_MODE || summary.earnedCount > 0) && (
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="text-nano font-black uppercase tracking-[0.18em] opacity-30">
            {tAch("progressEyebrow")}
          </span>
          <CandyChip variant="warm" tone="subtle">
            {tAch("sectionDescription", {
              earned: summary.earnedCount,
              total: summary.total,
            })}
          </CandyChip>
        </div>
      )}

      {CHESSCITO_LITE_MODE && <WelcomePackageStamp />}
      <AchievementsGrid achievements={summary.list} />

      {!CHESSCITO_LITE_MODE && summary.earnedCount === 0 && (
        <p className="mt-6 text-center text-xs font-bold uppercase tracking-widest opacity-40">
          {tAch("emptyHint")}
        </p>
      )}
    </PageSection>
  );

  const hallOfFameSection = (
    <PageSection
      key="hall-of-fame"
      icon={<CandyIcon name="trophy" className="h-4 w-4" />}
      title={t(CHESSCITO_LITE_MODE ? "hallOfFameLite" : "hallOfFame")}
    >
      <TrophyList
        victories={hallOfFame}
        loading={hofLoading}
        error={hofError}
        emptyMessage={t("noGlobalVictories")}
        variant="hall-of-fame"
        onRetry={loadHallOfFame}
      />
    </PageSection>
  );

  // In Lite: My Victories requires Arena NFTs (unavailable) and Community
  // duplicates the existing Leaders surface — show only achievements.
  const fullSections = isChampion
    ? [myVictoriesSection, showAchievements ? achievementsSection : null, showHallOfFame ? hallOfFameSection : null]
    : [showHallOfFame ? hallOfFameSection : null, myVictoriesSection, showAchievements ? achievementsSection : null];
  const ordered = (CHESSCITO_LITE_MODE
    ? [showAchievements ? achievementsSection : null]
    : fullSections
  ).filter((section): section is NonNullable<typeof section> => section !== null);

  return (
    <div className="flex flex-col gap-10 pb-10">
      {/* HERO BAND — overview anchor that mirrors the Badges vitrine
       *  pattern. Trofeo-épico character anchors the warm cream-amber
       *  panel; the right column carries the glance-able stats (victory
       *  count + best run when present, achievements progress).
       *  2026-05-30: when `hideHero` is true the band is rendered as a
       *  sibling OUTSIDE the parent scroll container (mirror badges)
       *  so its anchor's `left: -1.25rem` overhang isn't clipped by
       *  the scroll's spec-promoted overflow-x. The body skips the
       *  block entirely in that case to avoid duplicate render. */}
      {!hideHero && (
      <div className="trophy-vitrine-hero">
        <picture className="trophy-vitrine-hero-anchor">
          <source srcSet="/art/action-row/trofeo-epico.avif" type="image/avif" />
          <source srcSet="/art/action-row/trofeo-epico.webp" type="image/webp" />
          <img
            src="/art/action-row/trofeo-epico.png"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        </picture>
        <div className="trophy-vitrine-hero-content">
          <p className="trophy-vitrine-hero-eyebrow">{t(CHESSCITO_LITE_MODE ? "heroEyebrowLite" : "heroEyebrow")}</p>
          <p className="trophy-vitrine-hero-stats">
            <span className="trophy-vitrine-hero-stats-victory">
              {victoryCount} {t(CHESSCITO_LITE_MODE ? "heroVictoriesLabelLite" : "heroVictoriesLabel")}
            </span>
            <span className="trophy-vitrine-hero-stats-sep" aria-hidden="true">·</span>
            <span className="trophy-vitrine-hero-stats-ach">
              {summary.earnedCount}/{summary.total} {t("heroAchievementsLabel")}
            </span>
          </p>
          <p className="trophy-vitrine-hero-sub">
            {bestVictory
              ? t("heroBestLabelFormat", {
                  moves: bestVictory.totalMoves,
                  time: formatTimeMs(bestVictory.timeMs),
                })
              : t(CHESSCITO_LITE_MODE ? "heroEmptyHintLite" : "heroEmptyHint")}
          </p>
          <div className="trophy-vitrine-hero-progress">
            <div
              className="trophy-vitrine-hero-progress-fill"
              style={{ width: `${achievementsPct}%` }}
            />
          </div>
        </div>
      </div>
      )}

      {ordered}

      {/* Roadmap — Footer (hidden until further notice, see SHOW_ROADMAP) */}
      {SHOW_ROADMAP && (
      <footer className="mt-4 border-t border-[rgba(110,65,15,0.15)] pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(110,65,15,0.15)]" />
          <h3 className="text-nano font-black uppercase tracking-[0.2em] text-[rgba(63,34,8,0.45)]">
            {tRoad("sectionTitle")}
          </h3>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(110,65,15,0.15)]" />
        </div>

        <ul className="flex flex-col gap-3" role="list">
          {(tRoad.raw("items") as RoadmapItem[]).map((item) => (
            <li key={item.title} className="roadmap-item">
              <div className="h-2 w-2 rounded-full bg-amber-500/60" />
              <div className="flex-1">
                <p className="text-xs font-bold text-[rgba(63,34,8,0.95)] leading-none">
                  {item.title}
                </p>
                <p className="text-xs text-[rgba(63,34,8,0.70)] mt-1">
                  {item.description}
                </p>
              </div>
              <CandyChip variant="warm" tone="subtle">
                {tRoad("soonTag")}
              </CandyChip>
            </li>
          ))}
        </ul>
      </footer>
      )}
    </div>
  );
}
