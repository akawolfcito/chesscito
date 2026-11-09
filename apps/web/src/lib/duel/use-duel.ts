"use client";

/**
 * The Arena's connection to a duel: read, poll, act.
 *
 * ⚠️ Deliberately thin. Every decision it could get wrong already lives in a
 * pure module — `duelArenaState` names the screen, `reactToApiResult` decides
 * what each answer means, `displayedRemainingMs` draws the clocks. What is left
 * here is timers and effects, which is the part that cannot be unit-tested
 * cheaply and therefore should hold as little judgement as possible.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchDuel,
  joinDuelRequest,
  moveRequest,
  resignRequest,
  type DuelApiResult,
} from "./api";
import { duelArenaState, shouldPoll, type DuelArenaInput } from "./arena-state";
import { reactToApiResult, type DuelNotice } from "./reaction";
import { readStoredSeatToken, storeSeatToken } from "./seat-store";

/** ⚠️ The clock does NOT need a faster poll: the client knows `lastMoveAt` and
 *  whose turn it is, so it draws its own countdown. This cadence exists only to
 *  find out that the rival moved. */
const POLL_MS = 3_000;

/**
 * ⛔ While WAITING, the poll is the clock.
 *
 * The chess clock starts the instant the second player sits down, but the
 * player on move does not find out until their next read — so every second of
 * this interval is time billed to somebody who has not seen the board yet. It
 * showed up in the first playtest as "entré a jugar con 8 segundos menos".
 *
 * ⚠️ The cost is bounded and small: a duel only waits until somebody joins or
 * until the invitation dies at one hour, and the screen it belongs to has
 * nothing else to do.
 */
const WAITING_POLL_MS = 1_200;
/** A hidden tab is a player who is not looking. Keep the duel alive, stop
 *  hammering: the flag still falls on the next read, whenever that is. */
const HIDDEN_POLL_MS = 30_000;
/** How long a transient notice ("that move is illegal") stays on screen. */
const NOTICE_MS = 3_500;

export type UseDuel = ReturnType<typeof useDuel>;

export function useDuel(
  duelId: string | null,
  options: { sessionId?: string | null } = {},
) {
  const [input, setInput] = useState<DuelArenaInput>({ status: "loading" });
  const [notice, setNotice] = useState<DuelNotice>(null);
  const [busy, setBusy] = useState(false);
  const [seatToken, setSeatToken] = useState<string | null>(null);

  // Read once per duel, before the first request, so the very first GET can
  // already name our seat.
  useEffect(() => {
    if (!duelId) return;
    setSeatToken(readStoredSeatToken(duelId));
  }, [duelId]);

  const state = useMemo(() => duelArenaState(input), [input]);

  /** Latest input, for callbacks that must not re-create on every render. */
  const inputRef = useRef(input);
  inputRef.current = input;

  const apply = useCallback(
    (result: DuelApiResult): boolean => {
      const reaction = reactToApiResult(inputRef.current, result);
      setInput(reaction.next);
      setNotice(reaction.notice);
      if (reaction.seatToken && duelId) {
        storeSeatToken(duelId, reaction.seatToken);
        setSeatToken(reaction.seatToken);
      }
      return reaction.refetch;
    },
    [duelId],
  );

  const refresh = useCallback(async () => {
    if (!duelId) return;
    apply(await fetchDuel(duelId));
  }, [apply, duelId]);

  /**
   * Every action funnels through here so the one rule that matters cannot be
   * forgotten in one of three call sites: ⛔ when the reaction asks for a
   * refetch, we RE-READ. We never re-send the action.
   */
  const act = useCallback(
    async (run: () => Promise<DuelApiResult>) => {
      if (!duelId || busy) return;
      setBusy(true);
      try {
        const shouldRefetch = apply(await run());
        if (shouldRefetch) await refresh();
      } finally {
        setBusy(false);
      }
    },
    [apply, busy, duelId, refresh],
  );

  const join = useCallback(
    (displayName?: string | null) =>
      act(() =>
        joinDuelRequest(duelId!, {
          displayName,
          seatToken,
          sessionId: options.sessionId,
        }),
      ),
    [act, duelId, options.sessionId, seatToken],
  );

  const move = useCallback(
    (san: string) => {
      const current = inputRef.current;
      if (current.status !== "loaded") return Promise.resolve();
      return act(() =>
        moveRequest(duelId!, {
          san,
          version: current.duel.version,
          seatToken,
          sessionId: options.sessionId,
        }),
      );
    },
    [act, duelId, options.sessionId, seatToken],
  );

  const resign = useCallback(() => {
    const current = inputRef.current;
    if (current.status !== "loaded") return Promise.resolve();
    return act(() =>
      resignRequest(duelId!, {
        version: current.duel.version,
        seatToken,
        sessionId: options.sessionId,
      }),
    );
  }, [act, duelId, options.sessionId, seatToken]);

  // First read.
  useEffect(() => {
    if (!duelId) return;
    void refresh();
    // Only on a change of duel: `refresh` is stable per duel id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelId]);

  // The poll. ⛔ Stops on `finished` and `expired`: those are terminal, and a
  // poll that keeps running is a promise to the reader that something might
  // still change.
  const polling = shouldPoll(state);
  const waiting = state.kind === "inviting" || state.kind === "invited";
  useEffect(() => {
    if (!duelId || !polling) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const hidden = typeof document !== "undefined" && document.hidden;
      const delay = hidden
        ? HIDDEN_POLL_MS
        : waiting
          ? WAITING_POLL_MS
          : POLL_MS;
      timer = setTimeout(async () => {
        if (cancelled) return;
        if (!document.hidden) await refresh();
        tick();
      }, delay);
    };
    tick();

    // Coming back to the tab is worth an immediate read — the rival may have
    // moved several times while it was hidden.
    const onVisible = () => {
      if (!document.hidden && !cancelled) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [duelId, polling, refresh, waiting]);

  // Transient notices fade on their own; nothing here is an error the player
  // has to dismiss.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return { state, notice, busy, seatToken, join, move, resign, refresh };
}
