/**
 * The five duel routes, tested where they can still be wrong: the composition.
 *
 * Everything they decide was already settled and mutation-tested in
 * `lib/duel/*`. What is left here is wiring — what comes back in the body, what
 * status it carries, what gets set as a cookie, and above all what NEVER leaves
 * the process: the seat credential.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enforceOriginMock = vi.fn();
const enforceRateLimitMock = vi.fn();
const logMock = vi.fn();

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: (...args: unknown[]) => enforceOriginMock(...args),
  enforceRateLimit: (...args: unknown[]) => enforceRateLimitMock(...args),
  getRequestIp: () => "203.0.113.7",
}));

vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({
    info: (...args: unknown[]) => logMock(...args),
    warn: (...args: unknown[]) => logMock(...args),
    error: (...args: unknown[]) => logMock(...args),
  }),
}));

const findMock = vi.fn();
const createMock = vi.fn();
const commitMock = vi.fn();

vi.mock("@/lib/duel/repository", () => ({
  duelRepositoryFrom: () => ({
    find: (...args: unknown[]) => findMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    commit: (...args: unknown[]) => commitMock(...args),
  }),
}));

const insertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({ from: () => ({ insert: insertMock }) }),
}));

import { POST as createDuelRoute } from "@/app/api/duel/route";
import { GET as readDuelRoute } from "@/app/api/duel/[id]/route";
import { POST as joinRoute } from "@/app/api/duel/[id]/join/route";
import { POST as moveRoute } from "@/app/api/duel/[id]/move/route";
import { POST as resignRoute } from "@/app/api/duel/[id]/resign/route";

import { createDuel, joinDuel } from "@/lib/duel/operations";
import { hashSeatToken } from "@/lib/duel/seat-token";
import type { Duel } from "@/lib/duel/types";

const ORIGIN = "https://play.chesscito.com";
const ID = "A".repeat(22);
const WHITE = "white-credential";
const BLACK = "black-credential";

function anInvitation(now = Date.now()): Duel {
  return createDuel({
    id: ID,
    seat: "w",
    tokenHash: hashSeatToken(WHITE),
    minutes: 10,
    displayName: "Ana",
    invitedBy: null,
    now,
  });
}

function aGame(now = Date.now()): Duel {
  const joined = joinDuel({
    duel: anInvitation(now),
    tokenHash: hashSeatToken(BLACK),
    displayName: "Beto",
    presentedToken: null,
    now,
  });
  if (!joined.ok) throw new Error("fixture");
  return joined.duel;
}

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = { origin: ORIGIN },
) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  enforceOriginMock.mockReturnValue(undefined);
  enforceRateLimitMock.mockResolvedValue(undefined);
  createMock.mockResolvedValue("created");
  commitMock.mockResolvedValue("committed");
  insertMock.mockResolvedValue({ error: null });
});

describe("POST /api/duel", () => {
  it("issues the credential in the body and in a duel-scoped cookie", async () => {
    const response = await createDuelRoute(post("/api/duel", { minutes: 10 }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(typeof payload.seatToken).toBe("string");
    expect(payload.seatToken.length).toBeGreaterThan(16);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`Path=/api/duel/${payload.duel.id}`);
    expect(cookie).toContain("HttpOnly");
  });

  /**
   * ⛔ An acceptance criterion, asserted on the JSON that actually travels: the
   * stored hash must never reach a client. An `Omit<>` deletes nothing at
   * runtime, so only the serialized body can answer this.
   */
  it("never serializes a token hash to the client", async () => {
    const response = await createDuelRoute(post("/api/duel", {}));
    const body = await response.text();

    expect(body).not.toContain("tokenHash");
    expect(body).not.toContain("white_token_hash");
  });

  /** ⛔ The ladder is the whole validation, and a `curl` gets the same answer. */
  it("refuses a clock that is not on the ladder", async () => {
    const response = await createDuelRoute(post("/api/duel", { minutes: 7 }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_minutes");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("defaults to ten minutes when none is asked for", async () => {
    await createDuelRoute(post("/api/duel", {}));
    expect(createMock.mock.calls[0][0].initialMinutes).toBe(10);
  });

  /**
   * ⛔ `invitedBy` is attribution the SERVER writes, and this app has no
   * server-verifiable identity. Taking it from the body would be the v2 defect
   * wearing a new name, so the field stays null NO MATTER what is sent.
   */
  it("ignores an attribution the client tries to set", async () => {
    await createDuelRoute(
      post("/api/duel", { invitedBy: "account:someone-else", invited_by: "x" }),
    );

    expect(createMock.mock.calls[0][0].invitedBy).toBeNull();
  });

  /**
   * ⚠️ Asserted on whichever seat the creator GOT, never on white. Behaviour 1
   * draws the colour, so pinning `seats.w` here passes about half the time —
   * an intermittent red that would have been read as flake in CI rather than
   * as a test asking the wrong question. (It was found by a mutation run that
   * turned it red for reasons unrelated to the mutant.)
   */
  it("caps a display name instead of letting the database refuse it", async () => {
    await createDuelRoute(post("/api/duel", { displayName: "x".repeat(90) }));

    const duel = createMock.mock.calls[0][0] as Duel;
    const creator = duel.seats.w.tokenHash === "" ? duel.seats.b : duel.seats.w;
    expect(creator.displayName).toHaveLength(24);
  });

  /** The creator sits down; the other seat stays free until somebody joins. */
  it("seats the creator on exactly one side", async () => {
    await createDuelRoute(post("/api/duel", {}));

    const duel = createMock.mock.calls[0][0] as Duel;
    const taken = [duel.seats.w, duel.seats.b].filter((s) => s.tokenHash !== "");
    expect(taken).toHaveLength(1);
  });

  it("blocks a foreign origin and never touches the database", async () => {
    enforceOriginMock.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const response = await createDuelRoute(post("/api/duel", {}));

    expect(response.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  /** ⚠️ Without this, one script opens duels forever. */
  it("rate limits, before writing anything", async () => {
    enforceRateLimitMock.mockRejectedValue(new Error("Rate limit exceeded"));
    const response = await createDuelRoute(post("/api/duel", {}));

    expect(response.status).toBe(429);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/duel/[id]", () => {
  it("shows the board to somebody with no credential, and no seat", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await readDuelRoute(new Request(`${ORIGIN}/api/duel/${ID}`), params);
    const { duel } = await response.json();

    expect(response.status).toBe(200);
    expect(duel.you).toBeNull();
    expect(duel.yourTurn).toBe(false);
    expect(duel.fen).toBeTruthy();
  });

  it("names the seat of whoever presents its credential", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await readDuelRoute(
      new Request(`${ORIGIN}/api/duel/${ID}`, {
        headers: { cookie: `chesscito_duel_seat=${BLACK}` },
      }),
      params,
    );

    expect((await response.json()).duel.you).toBe("b");
  });

  it("answers 404 for a duel that is not there", async () => {
    findMock.mockResolvedValue({ status: "not-found" });
    const response = await readDuelRoute(new Request(`${ORIGIN}/api/duel/${ID}`), params);

    expect(response.status).toBe(404);
  });

  /**
   * ⛔ A broken database is 500, never 404. Telling a guest their invitation
   * does not exist because a query timed out sends them away from a duel that
   * is sitting right there.
   */
  it("never turns a database failure into a missing duel", async () => {
    findMock.mockResolvedValue({ status: "error" });
    const response = await readDuelRoute(new Request(`${ORIGIN}/api/duel/${ID}`), params);

    expect(response.status).toBe(500);
  });

  /** Behaviour 15, materialized by a plain read: no cron, no job, nobody moves. */
  it("settles a fallen flag on the way out", async () => {
    const stale = aGame(Date.now() - 20 * 60 * 1000);
    findMock.mockResolvedValue({ status: "found", duel: stale });

    const response = await readDuelRoute(new Request(`${ORIGIN}/api/duel/${ID}`), params);
    const { duel } = await response.json();

    expect(duel.status).toBe("finished");
    expect(duel.outcome).toEqual({ kind: "timeout", winner: "b" });
    expect(commitMock).toHaveBeenCalledTimes(1);
  });

  /** ⚠️ And still answers it when that write fails: expiration is a function
   *  of time, not a permission to write. */
  it("reports the settled state even if it could not be stored", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame(Date.now() - 20 * 60 * 1000) });
    commitMock.mockResolvedValue("error");

    const response = await readDuelRoute(new Request(`${ORIGIN}/api/duel/${ID}`), params);

    expect((await response.json()).duel.status).toBe("finished");
  });
});

describe("POST /api/duel/[id]/join", () => {
  it("seats the guest and hands back their credential", async () => {
    findMock.mockResolvedValue({ status: "found", duel: anInvitation() });
    const response = await joinRoute(post(`/api/duel/${ID}/join`, { displayName: "Beto" }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(typeof payload.seatToken).toBe("string");
    expect(payload.duel.status).toBe("active");
    expect(payload.duel.you).toBe("b");
  });

  /** Behaviour 5 + a double tap: the creator gets their OWN seat back and no
   *  second credential. */
  it("gives the creator their seat instead of a second one", async () => {
    findMock.mockResolvedValue({ status: "found", duel: anInvitation() });
    const response = await joinRoute(
      post(`/api/duel/${ID}/join`, { seatToken: WHITE }),
      params,
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.alreadySeated).toBe(true);
    expect(payload.seatToken).toBeUndefined();
    expect(payload.duel.you).toBe("w");
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("tells the second person somebody got there first", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await joinRoute(post(`/api/duel/${ID}/join`, {}), params);

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("seat-taken");
  });

  /** ⛔ Two guests tapping at the same instant: the CAS decides, and the loser
   *  is told they were beaten to it — not that something broke. */
  it("turns a lost race into seat-taken, not an error", async () => {
    findMock.mockResolvedValue({ status: "found", duel: anInvitation() });
    commitMock.mockResolvedValue("stale");
    const response = await joinRoute(post(`/api/duel/${ID}/join`, {}), params);

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("seat-taken");
  });

  it("rate limits", async () => {
    enforceRateLimitMock.mockRejectedValue(new Error("Rate limit exceeded"));
    const response = await joinRoute(post(`/api/duel/${ID}/join`, {}), params);

    expect(response.status).toBe(429);
    expect(findMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/duel/[id]/move", () => {
  it("applies a legal move from the seat on move", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await moveRoute(
      post(`/api/duel/${ID}/move`, { san: "e4", version: 2, seatToken: WHITE }),
      params,
    );
    const { duel } = await response.json();

    expect(response.status).toBe(200);
    expect(duel.moves).toEqual(["e4"]);
    expect(duel.you).toBe("w");
  });

  /**
   * ⛔ Behaviour 8 at the HTTP boundary: a credential belonging to no seat of
   * this duel gets a bare refusal. No board, no `turnOf`, nothing to learn.
   */
  it("tells a stranger nothing but that the seat is not theirs", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await moveRoute(
      post(`/api/duel/${ID}/move`, { san: "e4", version: 2, seatToken: "someone-else" }),
      params,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "not-your-seat" });
  });

  /** Behaviour 16: the loser of a race gets FRESH state, never silence. */
  it("answers a stale version with the real position", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await moveRoute(
      post(`/api/duel/${ID}/move`, { san: "e4", version: 1, seatToken: WHITE }),
      params,
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("version-conflict");
    expect(payload.duel.version).toBe(2);
  });

  it("refuses a move that is not legal in the position", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await moveRoute(
      post(`/api/duel/${ID}/move`, { san: "e9", version: 2, seatToken: WHITE }),
      params,
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("illegal-move");
  });

  it("refuses a body that is not a move at all", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    for (const body of [{ version: 2 }, { san: "e4" }, { san: "x".repeat(40), version: 2 }]) {
      const response = await moveRoute(post(`/api/duel/${ID}/move`, body), params);
      expect(response.status).toBe(400);
    }
  });

  /** ⛔ The metric: at most one event per seat, and only on its first move. */
  it("records the first move of each seat and nothing after", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    await moveRoute(
      post(`/api/duel/${ID}/move`, { san: "e4", version: 2, seatToken: WHITE, sessionId: "s" }),
      params,
    );

    const events = insertMock.mock.calls.map((call) => call[0].event);
    expect(events).toEqual(["duel_first_move"]);
    expect(insertMock.mock.calls[0][0].props).toMatchObject({ seat: "w", duel_id: ID });
  });

  it("writes no telemetry when the client has no session", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    await moveRoute(
      post(`/api/duel/${ID}/move`, { san: "e4", version: 2, seatToken: WHITE }),
      params,
    );

    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/duel/[id]/resign", () => {
  it("hands the win to the other seat", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await resignRoute(
      post(`/api/duel/${ID}/resign`, { version: 2, seatToken: WHITE }),
      params,
    );
    const { duel } = await response.json();

    expect(duel.status).toBe("finished");
    expect(duel.outcome).toEqual({ kind: "resign", winner: "b" });
  });

  it("tells a stranger nothing but that the seat is not theirs", async () => {
    findMock.mockResolvedValue({ status: "found", duel: aGame() });
    const response = await resignRoute(
      post(`/api/duel/${ID}/resign`, { version: 2, seatToken: "someone-else" }),
      params,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "not-your-seat" });
  });

  /** ⚠️ A resignation arriving after the flag fell must not rewrite why they lost. */
  it("cannot overwrite a game the clock already ended", async () => {
    findMock.mockResolvedValue({
      status: "found",
      duel: aGame(Date.now() - 20 * 60 * 1000),
    });
    const response = await resignRoute(
      post(`/api/duel/${ID}/resign`, { version: 2, seatToken: WHITE }),
      params,
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("duel-not-active");
  });
});

describe("what never leaves the process", () => {
  /**
   * ⛔ THE RULE THIS SUITE ENFORCES ACROSS ALL FIVE ROUTES.
   *
   * The credential is obvious: a token in an access log is a seat given away.
   * The duel id is the subtler one — the id IS the invitation link, so a log
   * drain full of ids is a drain full of duels a reader could join.
   *
   * Asserted over EVERY log call of every route, on the serialized arguments,
   * because a helpful `{ duelId }` added later would be invisible in review.
   */
  it("never logs the credential or the duel id, on any path", async () => {
    const paths: Array<() => Promise<unknown>> = [
      () => createDuelRoute(post("/api/duel", { minutes: 10, displayName: "Ana" })),
      () => readDuelRoute(new Request(`${ORIGIN}/api/duel/${ID}`), params),
      () => joinRoute(post(`/api/duel/${ID}/join`, { seatToken: WHITE }), params),
      () => moveRoute(post(`/api/duel/${ID}/move`, { san: "e4", version: 2, seatToken: WHITE }), params),
      () => resignRoute(post(`/api/duel/${ID}/resign`, { version: 2, seatToken: WHITE }), params),
    ];

    // Every failure mode too — that is where a well-meaning log gets added.
    for (const outcome of ["found", "not-found", "error"] as const) {
      findMock.mockResolvedValue(
        outcome === "found" ? { status: "found", duel: aGame() } : { status: outcome },
      );
      createMock.mockResolvedValue(outcome === "found" ? "created" : "error");
      commitMock.mockResolvedValue(outcome === "found" ? "committed" : "error");

      for (const run of paths) await run();
    }

    expect(logMock).toHaveBeenCalled();
    const logged = JSON.stringify(logMock.mock.calls);
    expect(logged).not.toContain(WHITE);
    expect(logged).not.toContain(BLACK);
    expect(logged).not.toContain(ID);
  });
});
