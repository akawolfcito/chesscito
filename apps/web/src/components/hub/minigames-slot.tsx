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
  currentWindowId,
  hoursUntilNextWindow,
  MINIGAME_WINDOW_STORAGE_KEY,
  parseStoredAssignment,
  type WindowAssignment,
} from "@/lib/minigames/daily-window";
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

  /* ⛔ THE WINDOW IS READ ONCE, AT MOUNT, AND NOTHING TICKS. Queue correctness
     must not depend on a React interval or on render time: `windowId` is a UTC
     date the resolver reads, and the hours below are display only. A player who
     leaves the tab open across midnight sees yesterday's window until they
     navigate — which is correct, because a silent re-shuffle under an idle
     screen is worse than a stale-by-one-visit number. */
  const [stored, setStored] = useState<WindowAssignment | null>(null);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [hoursLeft, setHoursLeft] = useState(0);

  useEffect(() => {
    const next: Record<string, Record<string, number>> = {};
    for (const piece of PLAYABLE_PIECES) next[piece] = getLabyrinthBestsMap(piece);
    setBestsByPiece(next);

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(MINIGAME_WINDOW_STORAGE_KEY);
    } catch {
      // Private-mode iframes throw. A fresh window is the safe degradation:
      // the player gets three assigned challenges, they just do not persist.
    }
    setStored(parseStoredAssignment(raw));

    const now = new Date();
    setWindowId(currentWindowId(now));
    setHoursLeft(hoursUntilNextWindow(now));
  }, []);

  const view = useMemo(
    () =>
      bestsByPiece && windowId
        ? deriveMiniGamesHubView({ pools, bestsByPiece, stored, windowId })
        : null,
    [bestsByPiece, pools, stored, windowId],
  );

  /* Persist the assignment the moment it changes — a new window, a top-up, or
     a ghost id dropped. Writing unconditionally would touch localStorage on
     every mount for no reason. */
  useEffect(() => {
    if (!view || !view.assignmentChanged) return;
    try {
      window.localStorage.setItem(
        MINIGAME_WINDOW_STORAGE_KEY,
        JSON.stringify(view.assignment),
      );
    } catch {
      // Same as the read: the session still works, it just will not survive.
    }
  }, [view]);

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
    const value = `${view.assignment.windowId}:${view.completedToday}`;
    try {
      if (window.sessionStorage.getItem(OPEN_EVENT_KEY) === value) return;
      window.sessionStorage.setItem(OPEN_EVENT_KEY, value);
    } catch {
      // Private-mode iframes throw on sessionStorage. Ship the event anyway —
      // the per-mount ref still bounds it — rather than lose the denominator.
    }
    /* ⚠️ WINDOW-SCOPED FIELDS. `completed_today` / `slots` are what make the
       measurement question answerable — "did this account reach its cap, and
       did it come back the same day?" — without a new event. The session latch
       is keyed by window id, so crossing midnight re-arms it exactly once. */
    track("minigames_open", {
      window_id: view.assignment.windowId,
      completed_today: view.completedToday,
      slots: view.slotCount,
      pool_exhausted: view.poolExhausted,
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
      completedToday={view.completedToday}
      slotCount={view.slotCount}
      /* ⛔ Null at 0/3 (nothing is charging) and null when the pool is
         exhausted (nothing will refill). Both are product states — see the
         prop's own note. */
      hoursUntilNext={
        view.completedToday > 0 && !view.poolExhausted ? hoursLeft : null
      }
      onPlay={handlePlay}
      onViewAll={() => router.push("/minigames")}
    />
  );
}
