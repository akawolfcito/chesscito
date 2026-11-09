/**
 * The four things that can happen to a duel, as pure transitions.
 *
 * `Duel → { result, duel }`. No Supabase, no `Request`, no `Date.now()`: the
 * route supplies `now` from the SERVER clock, the credentials, and the CAS. Put
 * differently — everything a route can get wrong is HERE, where it is cheap to
 * test exhaustively, and the route is left with I/O it cannot reason about.
 *
 * ⛔ THE ORDER IS FIXED AND IT IS THE SAME IN ALL THREE WRITE PATHS:
 *
 *   1. the seat        — a credential that matches nothing learns nothing
 *   2. the clock       — the flag falls BEFORE any move is considered
 *   3. the version     — the CAS, answered with fresh state
 *   4. the move        — only now does the referee look at the board
 *
 * Step 2 before step 4 is the decision the spec pinned: a mate delivered
 * exactly as the bank empties LOSES ON TIME, because the flag is judged against
 * the `lastMoveAt` from before the move. Both readings were defensible; this
 * one is written down so two implementations cannot differ.
 */

import {
  INVITATION_TTL_MS,
  chargeClock,
  initialRemainingMs,
  type ClockMinutes,
} from "./clock";
import { materialize } from "./lifecycle";
import { STARTING_FEN, applyMove } from "./referee";
import { resolveSeat } from "./seat-token";
import { opponentOf, type Duel, type DuelColor, type DuelSeat } from "./types";

/** The table caps it too (`char_length <= 24`); the cut happens before the write. */
const MAX_DISPLAY_NAME = 24;

// ── create ──────────────────────────────────────────────────────────

export type CreateDuelInput = {
  /** 128 bits base64url, from `newDuelId()`. */
  id: string;
  /** Which seat the creator gets. Drawn by the caller — this stays pure. */
  seat: DuelColor;
  /** SHA-256 of the credential the caller just issued. Never the token itself. */
  tokenHash: string;
  minutes: ClockMinutes;
  displayName: unknown;
  /**
   * ⛔ Attribution the SERVER writes, from the creator's session. It is a
   * parameter here and must never be a field of a request body: the founder
   * wants to reward whoever brings people in, and a value the client picks gets
   * forged the day it is worth something. It is what killed v2.
   */
  invitedBy: string | null;
  now: number;
};

export function createDuel(input: CreateDuelInput): Duel {
  const bank = initialRemainingMs(input.minutes);
  const stamp = new Date(input.now).toISOString();
  const other = opponentOf(input.seat);

  return {
    id: input.id,
    status: "awaiting-opponent",
    seats: {
      [input.seat]: {
        color: input.seat,
        tokenHash: input.tokenHash,
        displayName: sanitizeDisplayName(input.displayName),
        claimedAt: stamp,
        remainingMs: bank,
      },
      [other]: freeSeat(other, bank),
    } as Record<DuelColor, DuelSeat>,
    moves: [],
    fen: STARTING_FEN,
    outcome: null,
    version: 1,
    createdAt: stamp,
    expiresAt: new Date(input.now + INVITATION_TTL_MS).toISOString(),
    // ⚠️ No stamp until somebody sits down: with one seat there is no clock to
    // run, and `active` without one is refused by `duels_active_is_seated`.
    lastMoveAt: null,
    initialMinutes: input.minutes,
    invitedBy: input.invitedBy,
  };
}

// ── join ────────────────────────────────────────────────────────────

export type JoinInput = {
  duel: Duel;
  /** SHA-256 of the credential being issued to the guest. */
  tokenHash: string;
  displayName: unknown;
  /** What the caller already holds, if anything. */
  presentedToken: string | null;
  now: number;
};

export type JoinOutcome =
  | { ok: true; duel: Duel }
  /** The caller already holds a seat here — the creator reopening their own
   *  link, or a double tap. Consumes no seat and issues no second credential. */
  | { ok: false; code: "already-seated"; duel: Duel }
  | { ok: false; code: "seat-taken" }
  | { ok: false; code: "duel-not-joinable" };

export function joinDuel(input: JoinInput): JoinOutcome {
  const { duel } = materialize(input.duel, input.now);

  // Behaviour 5 + the idempotence edge case, in one check and before anything
  // else: whoever already has a seat gets it back rather than taking the other.
  const held = resolveSeat(duel.seats, input.presentedToken);
  if (held) return { ok: false, code: "already-seated", duel };

  if (duel.status !== "awaiting-opponent") {
    // ⚠️ `active` means somebody got there first — that reads as "you were
    // beaten to it", not as an error. Only a settled duel is "not joinable".
    return duel.status === "active"
      ? { ok: false, code: "seat-taken" }
      : { ok: false, code: "duel-not-joinable" };
  }

  const free = freeSeatOf(duel);
  if (!free) return { ok: false, code: "seat-taken" };

  const stamp = new Date(input.now).toISOString();
  return {
    ok: true,
    duel: {
      ...duel,
      status: "active",
      // ⛔ Sitting down IS what starts white's clock. `active` with no stamp is
      // a game whose clock has nothing to run against.
      lastMoveAt: stamp,
      version: duel.version + 1,
      seats: {
        ...duel.seats,
        [free]: {
          ...duel.seats[free],
          tokenHash: input.tokenHash,
          displayName: sanitizeDisplayName(input.displayName),
          claimedAt: stamp,
        },
      } as Record<DuelColor, DuelSeat>,
    },
  };
}

// ── move ────────────────────────────────────────────────────────────

export type MoveInput = {
  duel: Duel;
  token: string | null;
  san: string;
  /** The version the client read. The CAS of the spec. */
  version: number;
  now: number;
};

export type MoveOutcome =
  | { ok: true; duel: Duel }
  | { ok: false; code: "not-your-seat" }
  | { ok: false; code: "not-your-turn" }
  | { ok: false; code: "illegal-move" }
  | { ok: false; code: "duel-not-active" }
  | { ok: false; code: "version-conflict"; duel: Duel }
  /** It ran out during THIS request. Already-settled duels get
   *  `duel-not-active` (behaviour 17); this one carries the reason. */
  | { ok: false; code: "expired"; duel: Duel };

export function playMove(input: MoveInput): MoveOutcome {
  const gate = openWriteGate(input.duel, input.token, input.version, input.now);
  if (!gate.ok) return gate.error;
  const { seat, duel } = gate;

  const verdict = applyMove(duel.fen, duel.moves, seat, input.san);
  if (!verdict.ok) return { ok: false, code: verdict.code };

  // ⚠️ The charge is `now_server − lastMoveAt`. The client's own count never
  // enters, however smooth it draws its clocks. The flag was already resolved
  // above, so this cannot land on zero without the game being over.
  const charged = chargeClock(duel.seats[seat].remainingMs, duel.lastMoveAt, input.now);

  return {
    ok: true,
    duel: {
      ...duel,
      moves: [...duel.moves, verdict.san],
      fen: verdict.fen,
      status: verdict.outcome ? "finished" : "active",
      outcome: verdict.outcome,
      version: duel.version + 1,
      lastMoveAt: new Date(input.now).toISOString(),
      seats: {
        ...duel.seats,
        [seat]: { ...duel.seats[seat], remainingMs: charged.remainingMs },
      } as Record<DuelColor, DuelSeat>,
    },
  };
}

// ── resign ──────────────────────────────────────────────────────────

export type ResignInput = {
  duel: Duel;
  token: string | null;
  version: number;
  now: number;
};

export type ResignOutcome =
  | { ok: true; duel: Duel }
  | { ok: false; code: "not-your-seat" }
  | { ok: false; code: "duel-not-active" }
  | { ok: false; code: "version-conflict"; duel: Duel }
  | { ok: false; code: "expired"; duel: Duel };

export function resignDuel(input: ResignInput): ResignOutcome {
  const gate = openWriteGate(input.duel, input.token, input.version, input.now);
  if (!gate.ok) return gate.error;
  const { seat, duel } = gate;

  return {
    ok: true,
    duel: {
      ...duel,
      status: "finished",
      outcome: { kind: "resign", winner: opponentOf(seat) },
      version: duel.version + 1,
    },
  };
}

// ── the shared gate ─────────────────────────────────────────────────

type WriteGate =
  | { ok: true; seat: DuelColor; duel: Duel }
  | {
      ok: false;
      error:
        | { ok: false; code: "not-your-seat" }
        | { ok: false; code: "duel-not-active" }
        | { ok: false; code: "version-conflict"; duel: Duel }
        | { ok: false; code: "expired"; duel: Duel };
    };

/**
 * Steps 1-3 of the fixed order, shared by every write so the three routes
 * cannot drift apart. Whoever adds a fourth write path gets the order for free.
 */
function openWriteGate(
  input: Duel,
  token: string | null,
  version: number,
  now: number,
): WriteGate {
  // 1. The seat, FIRST and on the duel as read. ⛔ Behaviour 8: a credential
  //    that matches no seat of THIS duel learns nothing else — not whose turn
  //    it is, not whether the duel is still running.
  const seat = resolveSeat(input.seats, token);
  if (!seat) return { ok: false, error: { ok: false, code: "not-your-seat" } };

  // 2. The clock, BEFORE the board is ever consulted.
  const { duel, changed } = materialize(input, now);
  if (changed && duel.status === "expired") {
    return { ok: false, error: { ok: false, code: "expired", duel } };
  }
  if (duel.status !== "active") {
    return { ok: false, error: { ok: false, code: "duel-not-active" } };
  }

  // 3. The CAS, answered with FRESH state so nothing is lost in silence and the
  //    client can re-decide against the position that actually exists.
  if (version !== duel.version) {
    return { ok: false, error: { ok: false, code: "version-conflict", duel } };
  }

  return { ok: true, seat, duel };
}

// ── display names ───────────────────────────────────────────────────

/**
 * Free text from a stranger, rendered to the other player.
 *
 * Control characters become spaces rather than being dropped, so a name cannot
 * be assembled into something that impersonates our own interface across a line
 * break (*"Sistema: has perdido"* — the P2 of the red-team). Escaping is still
 * the renderer's job; the length and the shape are settled here, before the
 * write, because the table's `char_length <= 24` would otherwise answer a long
 * name with a constraint violation instead of a duel.
 */
export function sanitizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const flattened = raw
    // ⚠️ The class is written as ESCAPES on purpose. Typing the control
    // characters themselves turns this source file into a binary blob as far as
    // git and grep are concerned — it happened once while writing this line.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (flattened === "") return null;
  return flattened.slice(0, MAX_DISPLAY_NAME).trim();
}

// ── seats ───────────────────────────────────────────────────────────

function freeSeat(color: DuelColor, remainingMs: number): DuelSeat {
  // ⛔ `""`, never the hash of anything: `resolveSeat` skips a falsy hash, and
  // that is what stops whoever hands over the hash of nothing from sitting down.
  return { color, tokenHash: "", displayName: null, claimedAt: null, remainingMs };
}

function freeSeatOf(duel: Duel): DuelColor | null {
  if (duel.seats.w.tokenHash === "") return "w";
  if (duel.seats.b.tokenHash === "") return "b";
  return null;
}
