import { describe, it, expect } from "vitest";

import {
  displayedRemainingMs,
  duelArenaState,
  isBoardInteractive,
  runningSeat,
  shouldPoll,
  type DuelArenaState,
} from "../arena-state";
import { toPublic } from "../lifecycle";
import { createDuel, joinDuel, playMove, resignDuel } from "../operations";
import { hashSeatToken } from "../seat-token";
import type { DuelColor, DuelPublic } from "../types";

const NOON = Date.parse("2026-08-15T12:00:00.000Z");
const ID = "A".repeat(22);
const WHITE = "white-credential";
const BLACK = "black-credential";

/** Creator on white, so `turnOf` after the join is the creator's seat. */
function invitation() {
  return createDuel({
    id: ID,
    seat: "w",
    tokenHash: hashSeatToken(WHITE),
    minutes: 10,
    displayName: "Ana",
    invitedBy: null,
    now: NOON,
  });
}

function game() {
  const joined = joinDuel({
    duel: invitation(),
    tokenHash: hashSeatToken(BLACK),
    displayName: "Beto",
    presentedToken: null,
    now: NOON,
  });
  if (!joined.ok) throw new Error("fixture");
  return joined.duel;
}

function loaded(duel: DuelPublic): DuelArenaState {
  return duelArenaState({ status: "loaded", duel });
}

const ALL_STATES: Array<[string, DuelArenaState]> = (() => {
  const finished = resignDuel({ duel: game(), token: WHITE, version: 2, now: NOON });
  if (!finished.ok) throw new Error("fixture");
  return [
    ["loading", duelArenaState({ status: "loading" })],
    ["missing", duelArenaState({ status: "missing" })],
    ["inviting", loaded(toPublic(invitation(), "w"))],
    ["invited", loaded(toPublic(invitation(), null))],
    ["your-turn", loaded(toPublic(game(), "w"))],
    ["their-turn", loaded(toPublic(game(), "b"))],
    ["watching", loaded(toPublic(game(), null))],
    ["finished", loaded(toPublic(finished.duel, "w"))],
    ["expired", loaded(toPublic({ ...invitation(), status: "expired" }, "w"))],
  ];
})();

describe("duelArenaState — the eight states", () => {
  it("names every state from what the server said", () => {
    for (const [expected, state] of ALL_STATES) {
      expect(state.kind).toBe(expected);
    }
  });

  /** ⚠️ Whoever holds a seat in `awaiting-opponent` is the creator: joining
   *  flips the duel to `active` in the same write, so there is no third case. */
  it("separates the inviter from the invited by the seat, not by a flag", () => {
    expect(loaded(toPublic(invitation(), "w")).kind).toBe("inviting");
    expect(loaded(toPublic(invitation(), null)).kind).toBe("invited");
  });

  /** The forwarded link mid-game: read only, and no seat. */
  it("puts a seatless reader of a live game in watching", () => {
    const state = loaded(toPublic(game(), null));

    expect(state.kind).toBe("watching");
    expect(state.kind === "watching" && state.duel.you).toBeNull();
  });

  it("keeps a settled duel settled for everyone, seat or not", () => {
    const finished = resignDuel({ duel: game(), token: WHITE, version: 2, now: NOON });
    if (!finished.ok) throw new Error("fixture");

    for (const seat of ["w", "b", null] as Array<DuelColor | null>) {
      expect(loaded(toPublic(finished.duel, seat)).kind).toBe("finished");
    }
  });
});

describe("isBoardInteractive", () => {
  /**
   * ⛔ THE ASSERTION THIS FILE EXISTS FOR. Exactly one of the eight states may
   * move a piece. Computed inline as `!yourTurn` somewhere in a component, this
   * silently unlocks the board for a spectator the day `yourTurn` is undefined.
   */
  it("is true in your-turn and false in all seven others", () => {
    const interactive = ALL_STATES.filter(([, s]) => isBoardInteractive(s));

    expect(interactive.map(([name]) => name)).toEqual(["your-turn"]);
  });
});

describe("shouldPoll", () => {
  /** ⚠️ A poll that keeps running on a finished duel is a promise to the reader
   *  that something might still change. Both terminal states stop it. */
  it("stops on the two terminal states, and on nothing to poll", () => {
    const polling = ALL_STATES.filter(([, s]) => shouldPoll(s)).map(([n]) => n);

    expect(polling).toEqual([
      "inviting",
      "invited",
      "your-turn",
      "their-turn",
      "watching",
    ]);
  });
});

describe("runningSeat", () => {
  it("names the seat on move while the game runs", () => {
    expect(runningSeat(loaded(toPublic(game(), "w")))).toBe("w");
    expect(runningSeat(loaded(toPublic(game(), "b")))).toBe("w");
  });

  /**
   * ⚠️ No chess clock runs before somebody sits down: `lastMoveAt` is null, so
   * there is nothing to count against. What runs then is the INVITATION hour,
   * a different clock that lives in `expiresAt`.
   */
  it("has nothing running before the game starts or after it ends", () => {
    expect(runningSeat(loaded(toPublic(invitation(), "w")))).toBeNull();
    expect(runningSeat(loaded(toPublic(invitation(), null)))).toBeNull();

    const finished = resignDuel({ duel: game(), token: WHITE, version: 2, now: NOON });
    if (!finished.ok) throw new Error("fixture");
    expect(runningSeat(loaded(toPublic(finished.duel, "w")))).toBeNull();
  });
});

describe("displayedRemainingMs", () => {
  it("counts down only the seat on move", () => {
    const duel = toPublic(game(), "w");

    expect(displayedRemainingMs(duel, "w", NOON + 30_000)).toBe(570_000);
    expect(displayedRemainingMs(duel, "b", NOON + 30_000)).toBe(600_000);
  });

  it("follows the move to the other clock", () => {
    const moved = playMove({ duel: game(), token: WHITE, san: "e4", version: 2, now: NOON });
    if (!moved.ok) throw new Error("fixture");
    const duel = toPublic(moved.duel, "w");

    expect(displayedRemainingMs(duel, "b", NOON + 30_000)).toBe(570_000);
    expect(displayedRemainingMs(duel, "w", NOON + 30_000)).toBe(600_000);
  });

  /** ⛔ It is a rendering, not a rule: it floors at zero and never goes
   *  negative, and reaching zero says "ask the server", not "you lost". */
  it("floors at zero instead of going negative", () => {
    const duel = toPublic(game(), "w");

    expect(displayedRemainingMs(duel, "w", NOON + 10 * 60 * 1000)).toBe(0);
    expect(displayedRemainingMs(duel, "w", NOON + 60 * 60 * 1000)).toBe(0);
  });

  /** ⚠️ A stamp in the future — clock skew between the phone and the server —
   *  must never hand time BACK to a player. */
  it("never gives time back when the clocks disagree", () => {
    const duel = toPublic(game(), "w");

    expect(displayedRemainingMs(duel, "w", NOON - 30_000)).toBe(600_000);
  });

  it("freezes both clocks once the duel is settled", () => {
    const finished = resignDuel({ duel: game(), token: WHITE, version: 2, now: NOON });
    if (!finished.ok) throw new Error("fixture");
    const duel = toPublic(finished.duel, "w");

    expect(displayedRemainingMs(duel, "w", NOON + 10 * 60 * 1000)).toBe(600_000);
    expect(displayedRemainingMs(duel, "b", NOON + 10 * 60 * 1000)).toBe(600_000);
  });
});
