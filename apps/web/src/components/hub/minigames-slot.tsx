"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import {
  MiniGamesSection,
  type MiniGameStartIntent,
} from "@/components/hub/minigames-section";
import { PLAYABLE_PIECES } from "@/lib/game/exercises";
import { getLabyrinthBestsMap } from "@/lib/game/labyrinth-progress";
import {
  challengeHref,
  deriveMiniGamesHubView,
} from "@/lib/minigames/hub-cards";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { track } from "@/lib/telemetry";

/**
 * Learn Home mini-games container: hydration + routing + telemetry.
 *
 * Split from `<MiniGamesSection>` so the presenter stays hook-free and
 * mountable in a test or a `/dev` probe, the same split `dailySlot` already
 * uses.
 */

/** Session-scoped latch for the surface-view event. */
const OPEN_EVENT_KEY = "chesscito:minigames-open-fired";

export function MiniGamesSlot() {
  const router = useRouter();
  const pools = useMemo(() => baselineMiniGamePools(), []);

  /* Bests live in localStorage, so they are read AFTER mount. Rendering before
     that would paint every card AVAILABLE for one frame and then correct
     itself — a completed challenge briefly advertising "Play" is the kind of
     flicker that reads as lost progress. Null = not hydrated = render nothing. */
  const [bestsByPiece, setBestsByPiece] = useState<Record<
    string,
    Record<string, number>
  > | null>(null);

  useEffect(() => {
    const next: Record<string, Record<string, number>> = {};
    for (const piece of PLAYABLE_PIECES) next[piece] = getLabyrinthBestsMap(piece);
    setBestsByPiece(next);
  }, []);

  const view = useMemo(
    () => (bestsByPiece ? deriveMiniGamesHubView({ pools, bestsByPiece }) : null),
    [bestsByPiece, pools],
  );

  /* `minigames_open` — the H1 denominator.
   *
   * ⚠️ NOT a render event and NOT an impression. It fires ONCE PER SESSION,
   * latched in sessionStorage and keyed by rotation id, so a session that
   * bounces between hub and exercises twenty times still writes one row.
   * Volume is ~1/session (~300/week today) against `peones_balance_viewed`,
   * which reached 9% of ALL telemetry by firing per render — that is the
   * failure mode the "no event on render" rule exists to prevent, and this
   * event does not have it.
   *
   * ⚠️ `rotation_id` IS GONE (2026-08-21) — there is no rotation to attribute
   * to. What replaces it is `completed`/`pool_size`: the player's own position
   * in the pool, which is the thing a personal queue makes a usage read
   * comparable across. Same event family, same volume, no new event. */
  const openFiredRef = useRef(false);
  useEffect(() => {
    if (!view || view.cards.length === 0) return;
    if (openFiredRef.current) return;
    openFiredRef.current = true;
    const value = `personal:${view.completedCount}`;
    try {
      if (window.sessionStorage.getItem(OPEN_EVENT_KEY) === value) return;
      window.sessionStorage.setItem(OPEN_EVENT_KEY, value);
    } catch {
      // Private-mode iframes throw on sessionStorage. Ship the event anyway —
      // the per-mount ref still bounds it — rather than lose the denominator.
    }
    track("minigames_open", {
      completed: view.completedCount,
      pool_size: view.poolSize,
      exhausted: view.exhausted,
    });
  }, [view]);

  if (!view || view.cards.length === 0) return null;

  const handlePlay = (intent: MiniGameStartIntent) => {
    /* The ONLY start signal this product has ever had. `entry` is decided by
       the card that was tapped, so the funnel cannot disagree with what the
       player saw.
       ⚠️ Starts from inside /exercises (the drawer, the contextual pin) are
       deliberately NOT counted here: H1 asks whether players start mini-games
       when they are VISIBLE on this surface. Completions from every origin
       stay covered by `labyrinth_complete`, which is now a single emitter and
       carries `labyrinth_id`. */
    track("minigame_start", {
      challenge_id: intent.challengeId,
      game_id: intent.engineId,
      piece: intent.piece,
      entry: intent.entry,
    });
    router.push(challengeHref(intent.challengeId, "featured"));
  };

  return (
    <MiniGamesSection
      cards={view.cards}
      comingSoon={view.comingSoon}
      exhausted={view.exhausted}
      completedCount={view.completedCount}
      poolSize={view.poolSize}
      onPlay={handlePlay}
      onViewAll={() => router.push("/minigames")}
    />
  );
}
