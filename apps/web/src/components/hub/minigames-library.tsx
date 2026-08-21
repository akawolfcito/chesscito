"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { PLAYABLE_PIECES } from "@/lib/game/exercises";
import { getLabyrinthBestsMap } from "@/lib/game/labyrinth-progress";
import {
  currentWindowId,
  MINIGAME_WINDOW_STORAGE_KEY,
  parseStoredAssignment,
  resolveWindowAssignment,
} from "@/lib/minigames/daily-window";
import { completedChallengeIds } from "@/lib/minigames/hub-cards";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { resolveChallengePool, resolveLibrary } from "@/lib/minigames/queue";
import type { LibraryChallenge } from "@/lib/minigames/queue";
import type { MiniGameEngineId } from "@/lib/minigames/catalog";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { track } from "@/lib/telemetry";

/**
 * Mini-games Library — grouped by what the player can do, not by game family.
 *
 * ⛔ IT CANNOT BYPASS THE DAILY ALLOWANCE. It used to list all 13 as playable,
 * which would have let a player walk past the window and burn the catalogue
 * from here instead of the Home. Only today's assigned challenges and already
 * cleared ones are tappable; everything else is one quiet line.
 *
 * ⛔ IT INSTANTIATES NO ENGINE. Every row routes to the same `/exercises`
 * boundary Featured uses, through the same `challengeHref` and the same
 * resolver — one route, one gate, one completion write.
 *
 * ⚠️ It resolves the window READ-ONLY and never writes it. The Home's
 * `MiniGamesSlot` is the single writer; two writers would race across a
 * midnight boundary and hand the player two different assignments.
 */

const ENGINE_ICON_SLOT: Record<MiniGameEngineId, ThemeAssetKey> = {
  "rook-rail": "hub.minigame.rook-rail",
  "pivot-run": "hub.minigame.pivot-run",
  "n-queens": "hub.minigame.n-queens",
  "safe-path": "hub.minigame.safe-path",
  "knight-tour": "hub.minigame.knight-tour",
  "promotion-run": "hub.minigame.promotion-run",
};

export function MiniGamesLibrary() {
  const router = useRouter();
  const t = useTranslations("MINIGAMES_COPY");
  const pools = useMemo(() => baselineMiniGamePools(), []);
  const pool = useMemo(() => resolveChallengePool(pools), [pools]);

  /* Bests and the window assignment both live in localStorage, so they land
     after mount. Rendering before that would paint every row un-completed and
     every challenge locked for one frame — a cleared level briefly advertising
     itself as untouched reads as lost progress. */
  const [hydrated, setHydrated] = useState<{
    completed: ReadonlySet<string>;
    assigned: ReadonlySet<string>;
  } | null>(null);

  useEffect(() => {
    const bests: Record<string, Record<string, number>> = {};
    for (const piece of PLAYABLE_PIECES) bests[piece] = getLabyrinthBestsMap(piece);
    const completed = completedChallengeIds(bests);

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(MINIGAME_WINDOW_STORAGE_KEY);
    } catch {
      // Private-mode iframes throw; an empty assignment is the safe reading.
    }
    const resolved = resolveWindowAssignment({
      stored: parseStoredAssignment(raw),
      windowId: currentWindowId(),
      pool,
      completedChallengeIds: completed,
    });

    setHydrated({ completed, assigned: new Set(resolved.assignment.assigned) });

    /* ⛔ THE ONE EVENT THIS PASS ADDS, and the exact decision it enables:
       "does a player who used up today's allowance go looking for more the
       same day?" That is the signal the whole 5-day measurement exists for,
       and NOTHING answers it today. `minigames_open` is latched once per
       session on the Home; `minigame_start` needs a tap, and a capped player
       has nothing new to tap. Opening this page IS the intent.

       Volume is one row per Library visit on a secondary surface — nowhere
       near `peones_balance_viewed`, which reached 9% of all telemetry by
       firing per render. Fires once per mount, after hydration, never on a
       re-render. */
    const assignedOpen = new Set(resolved.assignment.assigned);
    track("minigames_library_open", {
      window_id: resolved.assignment.windowId,
      completed_today: [...assignedOpen].filter((id) => completed.has(id)).length,
      slots: assignedOpen.size,
      upcoming: pool.filter(
        (entry) =>
          !completed.has(entry.challengeId) && !assignedOpen.has(entry.challengeId),
      ).length,
    });
  }, [pool]);

  const library = useMemo(
    () => resolveLibrary(pools, hydrated?.completed, hydrated?.assigned),
    [pools, hydrated],
  );

  const open = (entry: LibraryChallenge) => {
    /* SAME event family as Featured, with `entry` telling them apart. A new
       event name here would split the funnel in two and make "challenges
       started per account" a join instead of a filter. */
    track("minigame_start", {
      challenge_id: entry.challengeId,
      game_id: entry.engineId,
      piece: entry.piece,
      entry: entry.completed ? "library_replay" : "library",
    });
    router.push(`/exercises?content=${encodeURIComponent(entry.challengeId)}&from=library`);
  };

  const row = (entry: LibraryChallenge) => (
    <li key={entry.challengeId}>
      <button
        type="button"
        className="minigames-library-row"
        data-testid={`library-challenge-${entry.challengeId}`}
        data-completed={String(entry.completed)}
        data-engine={entry.engineId}
        onClick={() => open(entry)}
      >
        <ThemeAssetPicture
          slot={ENGINE_ICON_SLOT[entry.engineId]}
          pictureClassName="minigames-library-row-icon"
          alt=""
          aria-hidden="true"
        />
        {/* The hierarchy the 50px tile has no room for: the CHALLENGE is the
            line you read, its GAME is the quiet second line under it. */}
        <span className="minigames-library-row-text">
          <span className="minigames-library-row-title">
            {entry.challenge.title ?? entry.challengeId}
          </span>
          <span className="minigames-library-row-engine">
            {t(`engines.${entry.engineId}` as const)}
          </span>
        </span>
        {entry.completed ? (
          <span className="minigames-library-row-done">{t("libraryCompleted")}</span>
        ) : null}
      </button>
    </li>
  );

  return (
    <main className="minigames-library" data-testid="minigames-library">
      <header className="minigames-library-header">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="minigames-library-back"
          data-testid="minigames-library-back"
        >
          {t("libraryBack")}
        </button>
        <h1 className="minigames-library-title">{t("libraryTitle")}</h1>
      </header>

      {library.today.length > 0 ? (
        <section
          className="minigames-library-group"
          data-testid="library-section-today"
          aria-labelledby="library-heading-today"
        >
          <h2 id="library-heading-today" className="minigames-library-group-title">
            {t("libraryToday")}
          </h2>
          <ul className="minigames-library-list">{library.today.map(row)}</ul>
        </section>
      ) : null}

      {library.completed.length > 0 ? (
        <section
          className="minigames-library-group"
          data-testid="library-section-completed"
          aria-labelledby="library-heading-done"
        >
          <h2 id="library-heading-done" className="minigames-library-group-title">
            {t("libraryDone")}
          </h2>
          <ul className="minigames-library-list">{library.completed.map(row)}</ul>
        </section>
      ) : null}

      {/* ⛔ ONE LINE, NOT TEN LOCKED ROWS, AND NO NUMBER. Enumerating future
          titles turns this page into a wall of locks, and naming the count
          re-introduces the catalogue size the Home just stopped showing. It is
          also deliberately NOT a button: there is nothing to do with it today.
          ⚠️ When Peones acceleration ships, THIS is the natural second home for
          the affordance — it is the only place a player is looking straight at
          the content they cannot reach yet. */}
      {library.upcoming > 0 ? (
        <p className="minigames-library-upcoming" data-testid="library-upcoming">
          {t("libraryUpcoming")}
        </p>
      ) : null}
    </main>
  );
}
