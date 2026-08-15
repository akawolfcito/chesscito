import { describe, it, expect } from "vitest";

import {
  createDuel,
  joinDuel,
  playMove,
  resignDuel,
  sanitizeDisplayName,
} from "../operations";
import { hashSeatToken } from "../seat-token";
import { STARTING_FEN } from "../referee";
import type { Duel } from "../types";

const TOKEN_W = "white-credential";
const TOKEN_B = "black-credential";
const TOKEN_STRANGER = "a-credential-from-another-duel";

const NOON = Date.parse("2026-08-15T12:00:00.000Z");
const at = (ms: number) => new Date(NOON + ms).toISOString();
const ID = "A".repeat(22);

function newDuel(): Duel {
  return createDuel({
    id: ID,
    seat: "w",
    tokenHash: hashSeatToken(TOKEN_W),
    minutes: 10,
    displayName: "Ana",
    invitedBy: "account:abc",
    now: NOON,
  });
}

/** Creator on white, guest joined on black at noon. */
function seatedDuel(): Duel {
  const joined = joinDuel({
    duel: newDuel(),
    tokenHash: hashSeatToken(TOKEN_B),
    displayName: "Beto",
    presentedToken: null,
    now: NOON,
  });
  if (!joined.ok) throw new Error(`expected a seat, got ${joined.code}`);
  return joined.duel;
}

describe("createDuel", () => {
  it("opens the duel with the creator seated and the other seat free", () => {
    const duel = newDuel();

    expect(duel.status).toBe("awaiting-opponent");
    expect(duel.seats.w.tokenHash).toBe(hashSeatToken(TOKEN_W));
    expect(duel.seats.w.claimedAt).toBe(at(0));
    expect(duel.seats.b.tokenHash).toBe("");
    expect(duel.seats.b.claimedAt).toBeNull();
  });

  it("starts the game from the initial position, unplayed", () => {
    const duel = newDuel();

    expect(duel.fen).toBe(STARTING_FEN);
    expect(duel.moves).toEqual([]);
    expect(duel.version).toBe(1);
    expect(duel.outcome).toBeNull();
  });

  /** ⚠️ No stamp until somebody sits down: with one seat there is no clock to run. */
  it("leaves the chess clock unstarted", () => {
    expect(newDuel().lastMoveAt).toBeNull();
  });

  it("gives both seats the bank the ladder asked for, and the invitation an hour", () => {
    const duel = newDuel();

    expect(duel.seats.w.remainingMs).toBe(600_000);
    expect(duel.seats.b.remainingMs).toBe(600_000);
    expect(duel.initialMinutes).toBe(10);
    expect(duel.expiresAt).toBe(at(60 * 60 * 1000));
  });

  it("stores the 30-second rung as half a minute", () => {
    const duel = createDuel({ ...createArgs(), minutes: 0.5 });

    expect(duel.initialMinutes).toBe(0.5);
    expect(duel.seats.w.remainingMs).toBe(30_000);
  });

  /**
   * ⛔ `invitedBy` is attribution the SERVER writes. It is a parameter of this
   * function and never a field of a request body — the founder wants to reward
   * whoever brings people in, and a value the client picks gets forged the day
   * it is worth something. It is the defect that killed v2.
   */
  it("records the attribution it was handed", () => {
    expect(newDuel().invitedBy).toBe("account:abc");
    expect(createDuel({ ...createArgs(), invitedBy: null }).invitedBy).toBeNull();
  });
});

describe("joinDuel", () => {
  it("seats the guest, starts the game and starts the clock", () => {
    const result = joinDuel({
      duel: newDuel(),
      tokenHash: hashSeatToken(TOKEN_B),
      displayName: "Beto",
      presentedToken: null,
      now: NOON + 5_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duel.status).toBe("active");
    expect(result.duel.seats.b.tokenHash).toBe(hashSeatToken(TOKEN_B));
    expect(result.duel.seats.b.claimedAt).toBe(at(5_000));
    expect(result.duel.version).toBe(2);
  });

  /**
   * ⛔ `active` with no `lastMoveAt` is a game whose clock has nothing to run
   * against — the table refuses it (`duels_active_is_seated`). Sitting down IS
   * what starts white's clock.
   */
  it("stamps the clock the moment the second player sits", () => {
    const result = joinDuel({
      duel: newDuel(),
      tokenHash: hashSeatToken(TOKEN_B),
      displayName: null,
      presentedToken: null,
      now: NOON + 5_000,
    });

    expect(result.ok && result.duel.lastMoveAt).toBe(at(5_000));
  });

  /**
   * Behaviour 5 and the idempotence edge case in one: the creator opening their
   * own link resumes their seat and does NOT take the other one, and a double
   * tap consumes no second seat and issues no second credential.
   */
  it("gives the creator back their own seat instead of the free one", () => {
    const duel = newDuel();
    const result = joinDuel({
      duel,
      tokenHash: hashSeatToken("a-brand-new-credential"),
      displayName: "Ana",
      presentedToken: TOKEN_W,
      now: NOON + 1_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("already-seated");
    expect(result.code === "already-seated" && result.duel).toEqual(duel);
  });

  it("tells the second person somebody got there first", () => {
    const result = joinDuel({
      duel: seatedDuel(),
      tokenHash: hashSeatToken("late-arrival"),
      displayName: null,
      presentedToken: null,
      now: NOON + 10_000,
    });

    expect(result.ok === false && result.code).toBe("seat-taken");
  });

  /**
   * ⚠️ A credential from ANOTHER duel resolves to no seat here, so the caller is
   * a stranger at a full table — `seat-taken`, not `already-seated`. Answering
   * `already-seated` would confirm to an outsider that their token means
   * something in this duel.
   */
  it("treats a credential from another duel as no credential at all", () => {
    const result = joinDuel({
      duel: seatedDuel(),
      tokenHash: hashSeatToken("late-arrival"),
      displayName: null,
      presentedToken: TOKEN_STRANGER,
      now: NOON + 10_000,
    });

    expect(result.ok === false && result.code).toBe("seat-taken");
  });

  it("refuses to seat anyone in a duel that is over", () => {
    for (const settled of [finishedDuel(), expiredDuel()]) {
      const result = joinDuel({
        duel: settled,
        tokenHash: hashSeatToken("too-late"),
        displayName: null,
        presentedToken: null,
        now: NOON + 10_000,
      });
      expect(result.ok === false && result.code).toBe("duel-not-joinable");
    }
  });

  /** ⚠️ Materialized on the way in: an invitation whose hour passed is expired,
   *  even though no job ever ran. */
  it("expires an invitation that timed out instead of seating a latecomer", () => {
    const result = joinDuel({
      duel: newDuel(),
      tokenHash: hashSeatToken("too-late"),
      displayName: null,
      presentedToken: null,
      now: NOON + 60 * 60 * 1000 + 1,
    });

    expect(result.ok === false && result.code).toBe("duel-not-joinable");
  });
});

describe("playMove", () => {
  it("applies a legal move from the seat on move", () => {
    const result = playMove({
      duel: seatedDuel(),
      token: TOKEN_W,
      san: "e4",
      version: 2,
      now: NOON + 3_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duel.moves).toEqual(["e4"]);
    expect(result.duel.fen).toContain(" b ");
    expect(result.duel.version).toBe(3);
    expect(result.duel.lastMoveAt).toBe(at(3_000));
  });

  /**
   * ⛔ Behaviour 15b: the discount is `now_server − lastMoveAt` and the client's
   * clock does not participate. Two identical moves that took different real
   * time leave different banks — asserted on the STATE, not on any UI.
   */
  it("charges the mover with the server clock, not with anything they sent", () => {
    const quick = playMove({
      duel: seatedDuel(),
      token: TOKEN_W,
      san: "e4",
      version: 2,
      now: NOON + 3_000,
    });
    const slow = playMove({
      duel: seatedDuel(),
      token: TOKEN_W,
      san: "e4",
      version: 2,
      now: NOON + 90_000,
    });

    expect(quick.ok && quick.duel.seats.w.remainingMs).toBe(597_000);
    expect(slow.ok && slow.duel.seats.w.remainingMs).toBe(510_000);
  });

  it("never charges the seat that did not move", () => {
    const result = playMove({
      duel: seatedDuel(),
      token: TOKEN_W,
      san: "e4",
      version: 2,
      now: NOON + 90_000,
    });

    expect(result.ok && result.duel.seats.b.remainingMs).toBe(600_000);
  });

  /**
   * ⛔ Behaviour 8, and an acceptance criterion: a credential that belongs to no
   * seat of THIS duel gets `not-your-seat` WITHOUT revealing whose turn it is.
   * The assertion is on the shape of the answer — an extra `duel` or `turnOf`
   * smuggled in "to be helpful" is the leak.
   */
  it("tells a stranger nothing but that the seat is not theirs", () => {
    const result = playMove({
      duel: seatedDuel(),
      token: TOKEN_STRANGER,
      san: "e4",
      version: 2,
      now: NOON + 1_000,
    });

    expect(result).toEqual({ ok: false, code: "not-your-seat" });
  });

  it("rejects a move with no credential at all, in every state", () => {
    for (const duel of [newDuel(), seatedDuel(), finishedDuel(), expiredDuel()]) {
      const result = playMove({
        duel,
        token: null,
        san: "e4",
        version: duel.version,
        now: NOON + 1_000,
      });
      expect(result).toEqual({ ok: false, code: "not-your-seat" });
    }
  });

  it("refuses a move from the seat that is not on move", () => {
    const result = playMove({
      duel: seatedDuel(),
      token: TOKEN_B,
      san: "e5",
      version: 2,
      now: NOON + 1_000,
    });

    expect(result.ok === false && result.code).toBe("not-your-turn");
  });

  it("refuses an illegal move", () => {
    const result = playMove({
      duel: seatedDuel(),
      token: TOKEN_W,
      san: "e9",
      version: 2,
      now: NOON + 1_000,
    });

    expect(result.ok === false && result.code).toBe("illegal-move");
  });

  /**
   * Behaviour 16: two concurrent moves on the same `version` — one applies and
   * the other gets `version-conflict` WITH FRESH STATE, so nothing is lost in
   * silence and the client can re-decide against the real position.
   */
  it("answers a stale version with the fresh duel", () => {
    const result = playMove({
      duel: seatedDuel(),
      token: TOKEN_W,
      san: "e4",
      version: 1,
      now: NOON + 1_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok || result.code !== "version-conflict") {
      throw new Error(`expected version-conflict, got ${JSON.stringify(result)}`);
    }
    expect(result.duel.version).toBe(2);
    expect(result.duel.moves).toEqual([]);
  });

  it("refuses any move once the duel is settled", () => {
    for (const settled of [finishedDuel(), expiredDuel()]) {
      const result = playMove({
        duel: settled,
        token: TOKEN_W,
        san: "e4",
        version: settled.version,
        now: NOON + 1_000,
      });
      expect(result.ok === false && result.code).toBe("duel-not-active");
    }
  });

  /**
   * ⛔ THE FIXED ORDER, end to end. A move that arrives after the bank has
   * emptied does NOT get applied: the flag is judged against the `lastMoveAt`
   * BEFORE the move, so the game is already over by timeout and the board never
   * changes. A route that applied the move first would hand the win to the
   * player who ran out of time.
   */
  it("loses on time rather than playing a move that arrived too late", () => {
    const duel = seatedDuel();
    const result = playMove({
      duel,
      token: TOKEN_W,
      san: "e4",
      version: 2,
      now: NOON + 600_001,
    });

    expect(result.ok === false && result.code).toBe("duel-not-active");
    expect(duel.moves).toEqual([]);
  });

  /**
   * ⚠️ The difference between `expired` and `duel-not-active` is WHEN it
   * happened. A duel that ran out during THIS request answers `expired` with
   * fresh state, so the player learns why; one that was already over answers
   * `duel-not-active` (behaviour 17).
   */
  it("reports the invitation that ran out during this very request", () => {
    const result = playMove({
      duel: newDuel(),
      token: TOKEN_W,
      san: "e4",
      version: 1,
      now: NOON + 60 * 60 * 1000 + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok || result.code !== "expired") {
      throw new Error(`expected expired, got ${JSON.stringify(result)}`);
    }
    expect(result.duel.status).toBe("expired");
  });

  it("ends the game on checkmate, with the mover as winner", () => {
    const result = playMove({
      duel: foolsMateDuel(),
      token: TOKEN_B,
      san: "Qh4#",
      version: 2,
      now: NOON + 1_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duel.status).toBe("finished");
    expect(result.duel.outcome).toEqual({ kind: "checkmate", winner: "b" });
  });

  it("does not mutate the duel it was given", () => {
    const duel = seatedDuel();
    const snapshot = structuredClone(duel);

    playMove({ duel, token: TOKEN_W, san: "e4", version: 2, now: NOON + 1_000 });

    expect(duel).toEqual(snapshot);
  });
});

describe("resignDuel", () => {
  it("hands the win to the other seat", () => {
    const result = resignDuel({
      duel: seatedDuel(),
      token: TOKEN_W,
      version: 2,
      now: NOON + 1_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duel.status).toBe("finished");
    expect(result.duel.outcome).toEqual({ kind: "resign", winner: "b" });
    expect(result.duel.version).toBe(3);
  });

  it("lets the seat on move resign too", () => {
    const result = resignDuel({
      duel: seatedDuel(),
      token: TOKEN_B,
      version: 2,
      now: NOON + 1_000,
    });

    expect(result.ok && result.duel.outcome).toEqual({ kind: "resign", winner: "w" });
  });

  it("tells a stranger nothing but that the seat is not theirs", () => {
    const result = resignDuel({
      duel: seatedDuel(),
      token: TOKEN_STRANGER,
      version: 2,
      now: NOON + 1_000,
    });

    expect(result).toEqual({ ok: false, code: "not-your-seat" });
  });

  it("answers a stale version with the fresh duel", () => {
    const result = resignDuel({
      duel: seatedDuel(),
      token: TOKEN_W,
      version: 1,
      now: NOON + 1_000,
    });

    expect(result.ok === false && result.code).toBe("version-conflict");
  });

  /** ⚠️ Resigning after the flag already fell does not overwrite the timeout. */
  it("cannot resign a game the clock already ended", () => {
    const result = resignDuel({
      duel: seatedDuel(),
      token: TOKEN_W,
      version: 2,
      now: NOON + 600_001,
    });

    expect(result.ok === false && result.code).toBe("duel-not-active");
  });
});

describe("sanitizeDisplayName", () => {
  /**
   * P2 of the red-team: it is free text from a stranger rendered to the other
   * player. The ceiling is in the table too (`char_length <= 24`), but a route
   * that hands over 4 KB gets a constraint violation instead of a duel, so the
   * cut happens before the write.
   */
  it("cuts a name at 24 characters", () => {
    expect(sanitizeDisplayName("x".repeat(40))).toHaveLength(24);
  });

  it("drops control characters that could fake our own interface", () => {
    expect(sanitizeDisplayName("Ana\nSistema: has perdido")).toBe(
      "Ana Sistema: has perdido",
    );
    expect(sanitizeDisplayName("Ana Beto")).toBe("Ana Beto");
  });

  it("treats blank and missing alike, as no name at all", () => {
    expect(sanitizeDisplayName("   ")).toBeNull();
    expect(sanitizeDisplayName("")).toBeNull();
    expect(sanitizeDisplayName(null)).toBeNull();
    expect(sanitizeDisplayName(undefined)).toBeNull();
    expect(sanitizeDisplayName(42)).toBeNull();
  });

  it("leaves an ordinary name alone", () => {
    expect(sanitizeDisplayName("  Ana  ")).toBe("Ana");
  });
});

// ── fixtures ────────────────────────────────────────────────────────

function createArgs() {
  return {
    id: ID,
    seat: "w" as const,
    tokenHash: hashSeatToken(TOKEN_W),
    minutes: 10 as const,
    displayName: "Ana",
    invitedBy: "account:abc",
    now: NOON,
  };
}

function finishedDuel(): Duel {
  const result = resignDuel({
    duel: seatedDuel(),
    token: TOKEN_W,
    version: 2,
    now: NOON + 1_000,
  });
  if (!result.ok) throw new Error("fixture: resign should have applied");
  return result.duel;
}

function expiredDuel(): Duel {
  return { ...newDuel(), status: "expired" };
}

/** 1. f3 e5 2. g4 — black to move, with mate in one. */
function foolsMateDuel(): Duel {
  const duel = seatedDuel();
  return {
    ...duel,
    fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2",
    moves: ["f3", "e5", "g4"],
  };
}
