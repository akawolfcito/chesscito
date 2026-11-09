import { describe, it, expect, vi } from "vitest";

import {
  firstMoveEvent,
  loadMaterialized,
  outcomeReason,
  recordDuelEvent,
  type DuelEventClient,
} from "../service";
import { createDuel, joinDuel } from "../operations";
import { hashSeatToken } from "../seat-token";
import type { DuelRepository } from "../repository";
import type { Duel } from "../types";

const ID = "A".repeat(22);
const NOON = Date.parse("2026-08-15T12:00:00.000Z");

function anInvitation(): Duel {
  return createDuel({
    id: ID,
    seat: "w",
    tokenHash: hashSeatToken("white"),
    minutes: 10,
    displayName: "Ana",
    invitedBy: null,
    now: NOON,
  });
}

function aGame(): Duel {
  const joined = joinDuel({
    duel: anInvitation(),
    tokenHash: hashSeatToken("black"),
    displayName: "Beto",
    presentedToken: null,
    now: NOON,
  });
  if (!joined.ok) throw new Error("fixture");
  return joined.duel;
}

function fakeRepo(
  find: Awaited<ReturnType<DuelRepository["find"]>>,
  commit: Awaited<ReturnType<DuelRepository["commit"]>> = "committed",
) {
  const commitSpy = vi.fn().mockResolvedValue(commit);
  const repo: DuelRepository = {
    find: vi.fn().mockResolvedValue(find),
    create: vi.fn().mockResolvedValue("created"),
    commit: commitSpy,
  };
  return { repo, commitSpy };
}

describe("loadMaterialized", () => {
  it("hands back a duel the clock has nothing to say about, untouched", async () => {
    const { repo, commitSpy } = fakeRepo({ status: "found", duel: aGame() });
    const result = await loadMaterialized(repo, ID, NOON + 1_000);

    expect(result.status).toBe("found");
    expect(commitSpy).not.toHaveBeenCalled();
  });

  /** Behaviour 13 and 15: no cron, no job — the next read of anyone does it. */
  it("materializes the fallen flag and writes it once", async () => {
    const { repo, commitSpy } = fakeRepo({ status: "found", duel: aGame() });
    const result = await loadMaterialized(repo, ID, NOON + 600_001);

    expect(result.status === "found" && result.duel.status).toBe("finished");
    expect(result.status === "found" && result.duel.outcome).toEqual({
      kind: "timeout",
      winner: "b",
    });
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it("commits against the version it materialized FROM", async () => {
    const { repo, commitSpy } = fakeRepo({ status: "found", duel: aGame() });
    await loadMaterialized(repo, ID, NOON + 600_001);

    const [duel, expectedVersion] = commitSpy.mock.calls[0];
    expect(duel.version).toBe(3);
    expect(expectedVersion).toBe(2);
  });

  /**
   * ⛔ The edge case the spec spells out: the write inside a GET can fail, and
   * the GET must still answer the state it COMPUTED. Expiration is a function
   * of time, not a permission to write — answering `active` because an UPDATE
   * failed would show a live board for a game that is already over.
   */
  it("answers the computed state even when the write fails", async () => {
    for (const outcome of ["error", "stale"] as const) {
      const { repo } = fakeRepo({ status: "found", duel: aGame() }, outcome);
      const result = await loadMaterialized(repo, ID, NOON + 600_001);

      expect(result.status === "found" && result.duel.status).toBe("finished");
    }
  });

  it("passes a missing duel and a broken database through as they are", async () => {
    expect((await loadMaterialized(fakeRepo({ status: "not-found" }).repo, ID, NOON)).status)
      .toBe("not-found");
    expect((await loadMaterialized(fakeRepo({ status: "error" }).repo, ID, NOON)).status)
      .toBe("error");
  });
});

describe("firstMoveEvent", () => {
  /** ⛔ The metric is duels where BOTH seats moved, so the event fires at most
   *  twice — once per seat — instead of once per move. */
  it("names the seat on its own first move, and nothing after", () => {
    const empty = { moves: [] } as unknown as Duel;
    const one = { moves: ["e4"] } as unknown as Duel;
    const two = { moves: ["e4", "e5"] } as unknown as Duel;
    const three = { moves: ["e4", "e5", "Nf3"] } as unknown as Duel;

    expect(firstMoveEvent(empty, one)).toBe("w");
    expect(firstMoveEvent(one, two)).toBe("b");
    expect(firstMoveEvent(two, three)).toBeNull();
  });
});

describe("outcomeReason", () => {
  it("keeps the reason a draw was a draw", () => {
    expect(outcomeReason({ kind: "draw", reason: "threefold-repetition" })).toBe(
      "draw:threefold-repetition",
    );
    expect(outcomeReason({ kind: "timeout", winner: "w" })).toBe("timeout");
    expect(outcomeReason(null)).toBeNull();
  });
});

describe("recordDuelEvent", () => {
  function fakeClient() {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert }) } as unknown as DuelEventClient;
    return { client, insert };
  }

  it("writes one analytics row with the duel on it", async () => {
    const { client, insert } = fakeClient();
    await recordDuelEvent(client, {
      event: "duel_created",
      duelId: ID,
      sessionId: "session-1",
      props: { minutes: 10 },
    });

    expect(insert).toHaveBeenCalledWith({
      session_id: "session-1",
      event: "duel_created",
      props: { duel_id: ID, minutes: 10 },
    });
  });

  /**
   * ⛔ No session, no row. A synthetic session id would land in the very table
   * the `stats_*` RPCs read, inflating `events/session` and the session counts
   * on the public `/stats` page — one metric bought by corrupting three others.
   */
  it("writes nothing rather than inventing a session", async () => {
    const { client, insert } = fakeClient();
    await recordDuelEvent(client, {
      event: "duel_created",
      duelId: ID,
      sessionId: null,
    });

    expect(insert).not.toHaveBeenCalled();
  });

  /** ⚠️ Best-effort, like the rest of the telemetry here: a lost event must
   *  never cost a player their move. The numbers are a floor, not a total. */
  it("never lets a telemetry failure reach the caller", async () => {
    const client = {
      from: () => ({
        insert: () => Promise.reject(new Error("analytics is down")),
      }),
    } as unknown as DuelEventClient;

    await expect(
      recordDuelEvent(client, { event: "duel_joined", duelId: ID, sessionId: "s" }),
    ).resolves.toBeUndefined();
  });

  it("does nothing at all without a database", async () => {
    await expect(
      recordDuelEvent(null, { event: "duel_joined", duelId: ID, sessionId: "s" }),
    ).resolves.toBeUndefined();
  });
});
