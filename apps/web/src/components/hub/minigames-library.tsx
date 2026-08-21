"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { PLAYABLE_PIECES } from "@/lib/game/exercises";
import { getLabyrinthBestsMap } from "@/lib/game/labyrinth-progress";
import { challengeHref, completedChallengeIds } from "@/lib/minigames/hub-cards";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { resolveLibrary } from "@/lib/minigames/queue";
import type { MiniGameEngineId } from "@/lib/minigames/catalog";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { track } from "@/lib/telemetry";

/**
 * Mini-games Library — every healthy challenge, grouped by game.
 *
 * WHY THIS EXISTS
 * ---------------
 * Featured shows three. Until now the other ten were reachable only because
 * lane-2 rows were still appended to the END OF THE EXERCISES PATH — which is
 * exactly the separation the product wanted to close: a mini-game sitting in
 * the exercise trail reads as an exercise. This is their real home, so the
 * Exercises path can stop being an index for content that is not an exercise.
 *
 * ⛔ IT INSTANTIATES NO ENGINE. Every row routes to the same `/exercises`
 * boundary Featured uses, through the same `challengeHref` and the same
 * `resolveMiniGameDeepLink` — one route, one resolver. A second player surface
 * would be a second place for the gate, the grading and the completion write to
 * drift.
 *
 * ⛔ Coming-soon engines are ABSENT, not greyed. `resolveLibrary` builds from
 * `earlyAccessEngines()`, so there is no row to tap and no dead end dressed as
 * content. Their roster still ships in the catalog for when they graduate.
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

  /* Bests are localStorage, so they land after mount. Rendering before that
     would paint every row un-completed for one frame — a cleared level briefly
     advertising itself as untouched reads as lost progress. */
  const [completed, setCompleted] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    const bests: Record<string, Record<string, number>> = {};
    for (const piece of PLAYABLE_PIECES) bests[piece] = getLabyrinthBestsMap(piece);
    setCompleted(completedChallengeIds(bests));
  }, []);

  const library = useMemo(
    () => resolveLibrary(pools, completed ?? new Set()),
    [pools, completed],
  );

  const open = (challengeId: string, engineId: MiniGameEngineId, piece: string) => {
    /* SAME event family as Featured, with `entry` telling them apart. A new
       event name here would split the funnel in two and make "challenges
       started per account" a join instead of a filter. */
    track("minigame_start", {
      challenge_id: challengeId,
      game_id: engineId,
      piece,
      entry: "library",
    });
    router.push(challengeHref(challengeId, "library"));
  };

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
        <span
          className="minigames-library-progress tabular-nums"
          data-testid="minigames-library-progress"
          aria-label={t("progressAria", {
            done: library.completedCount,
            total: library.total,
          })}
        >
          {t("progressFormat", {
            done: library.completedCount,
            total: library.total,
          })}
        </span>
      </header>

      {library.groups.map((group) => (
        <section
          key={group.engineId}
          className="minigames-library-group"
          data-testid={`library-group-${group.engineId}`}
          aria-labelledby={`library-heading-${group.engineId}`}
        >
          <h2
            id={`library-heading-${group.engineId}`}
            className="minigames-library-group-title"
          >
            <ThemeAssetPicture
              slot={ENGINE_ICON_SLOT[group.engineId]}
              pictureClassName="minigames-library-group-icon"
              alt=""
              aria-hidden="true"
            />
            {t(`engines.${group.engineId}` as const)}
          </h2>
          <ul className="minigames-library-list">
            {group.challenges.map((entry) => (
              <li key={entry.challengeId}>
                <button
                  type="button"
                  className="minigames-library-row"
                  data-testid={`library-challenge-${entry.challengeId}`}
                  data-completed={String(entry.completed)}
                  data-engine={group.engineId}
                  onClick={() => open(entry.challengeId, group.engineId, entry.piece)}
                >
                  {/* The hierarchy PART 10 asks for, with the room a list row
                      has and a 50px tile does not: the CHALLENGE is the line
                      you read, its GAME is the group it sits under. */}
                  <span className="minigames-library-row-title">
                    {entry.challenge.title ?? entry.challengeId}
                  </span>
                  {entry.completed ? (
                    <span className="minigames-library-row-done">
                      {t("libraryCompleted")}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
