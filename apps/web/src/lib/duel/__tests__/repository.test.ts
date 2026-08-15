import { describe, it, expect } from "vitest";

import { duelRepository, type DuelQueryClient } from "../repository";
import { createDuel } from "../operations";
import { hashSeatToken } from "../seat-token";
import type { DuelRow } from "../row";

const TOKEN = "the-plain-credential-that-must-never-be-stored";
const ID = "A".repeat(22);
const NOON = Date.parse("2026-08-15T12:00:00.000Z");

function aDuel() {
  return createDuel({
    id: ID,
    seat: "w",
    tokenHash: hashSeatToken(TOKEN),
    minutes: 10,
    displayName: "Ana",
    invitedBy: "account:abc",
    now: NOON,
  });
}

function aRow(overrides: Partial<DuelRow> = {}): DuelRow {
  return {
    id: ID,
    status: "awaiting-opponent",
    white_token_hash: hashSeatToken(TOKEN),
    black_token_hash: null,
    white_display_name: "Ana",
    black_display_name: null,
    white_claimed_at: "2026-08-15T12:00:00.000Z",
    black_claimed_at: null,
    white_remaining_ms: 600_000,
    black_remaining_ms: 600_000,
    moves: [],
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    outcome: null,
    version: 1,
    created_at: "2026-08-15T12:00:00.000Z",
    expires_at: "2026-08-15T13:00:00.000Z",
    last_move_at: null,
    initial_minutes: 10,
    invited_by: "account:abc",
    ...overrides,
  };
}

type Recorded = {
  table: string | null;
  operation: "select" | "insert" | "update" | null;
  payload: unknown;
  /** Every `.eq(column, value)` in the order it was chained. */
  filters: Array<[string, unknown]>;
};

/**
 * A stand-in for the PostgREST client that RECORDS the query it was asked to
 * build. The point is not to simulate Postgres — it is to assert the shape of
 * the request, because the one thing that cannot be seen from the outside is a
 * CAS that quietly forgot its `version` filter and overwrites the winner.
 */
function fakeClient(response: { data?: unknown; error?: unknown }) {
  const recorded: Recorded = {
    table: null,
    operation: null,
    payload: undefined,
    filters: [],
  };

  const result = { data: response.data ?? null, error: response.error ?? null };
  const builder = {
    eq(column: string, value: unknown) {
      recorded.filters.push([column, value]);
      return builder;
    },
    select() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
    then(resolve: (value: typeof result) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };

  const client = {
    from(table: string) {
      recorded.table = table;
      return {
        select() {
          recorded.operation = "select";
          return builder;
        },
        insert(payload: unknown) {
          recorded.operation = "insert";
          recorded.payload = payload;
          return builder;
        },
        update(payload: unknown) {
          recorded.operation = "update";
          recorded.payload = payload;
          return builder;
        },
      };
    },
  } as unknown as DuelQueryClient;

  return { client, recorded };
}

describe("find", () => {
  it("maps the row it read into a duel", async () => {
    const { client } = fakeClient({ data: aRow() });
    const result = await duelRepository(client).find(ID);

    expect(result.status).toBe("found");
    expect(result.status === "found" && result.duel.id).toBe(ID);
  });

  it("reads the duels table by id", async () => {
    const { client, recorded } = fakeClient({ data: aRow() });
    await duelRepository(client).find(ID);

    expect(recorded.table).toBe("duels");
    expect(recorded.operation).toBe("select");
    expect(recorded.filters).toEqual([["id", ID]]);
  });

  it("reports a missing duel as not-found", async () => {
    const { client } = fakeClient({ data: null });
    expect((await duelRepository(client).find(ID)).status).toBe("not-found");
  });

  /**
   * ⛔ A database that is down is NOT "no such duel". Collapsing the two would
   * answer 404 for a link that exists, and the guest would be told the
   * invitation is wrong when the invitation is fine.
   */
  it("never disguises a failure as a missing duel", async () => {
    const { client } = fakeClient({ error: { message: "connection refused" } });
    expect((await duelRepository(client).find(ID)).status).toBe("error");
  });
});

describe("create", () => {
  it("inserts the flat row into duels", async () => {
    const { client, recorded } = fakeClient({ data: [aRow()] });
    await duelRepository(client).create(aDuel());

    expect(recorded.table).toBe("duels");
    expect(recorded.operation).toBe("insert");
    expect(recorded.payload).toMatchObject({ id: ID, status: "awaiting-opponent" });
  });

  /**
   * ⛔ An acceptance criterion, asserted on what actually travels: the plain
   * credential exists only in the response that issues it. A dump of this table
   * must hand over hashes, and a hash cannot sit down.
   */
  it("never sends the plain credential to the database", async () => {
    const { client, recorded } = fakeClient({ data: [aRow()] });
    await duelRepository(client).create(aDuel());

    expect(JSON.stringify(recorded.payload)).not.toContain(TOKEN);
    expect(JSON.stringify(recorded.payload)).toContain(hashSeatToken(TOKEN));
  });

  /** The free seat is NULL, never `""` — the column's CHECK rejects the latter. */
  it("writes a free seat as null", async () => {
    const { client, recorded } = fakeClient({ data: [aRow()] });
    await duelRepository(client).create(aDuel());

    expect(recorded.payload).toMatchObject({ black_token_hash: null });
  });

  it("reports a duplicate id rather than pretending it wrote", async () => {
    const { client } = fakeClient({ error: { code: "23505" } });
    expect(await duelRepository(client).create(aDuel())).toBe("conflict");
  });

  it("reports any other failure as an error", async () => {
    const { client } = fakeClient({ error: { code: "23514" } });
    expect(await duelRepository(client).create(aDuel())).toBe("error");
  });
});

describe("commit — the CAS", () => {
  /**
   * ⛔ THE TEST THIS FILE EXISTS FOR. The whole concurrency story of the spec is
   * one `where version = $n`, and dropping it is invisible from the outside:
   * every move still "works", and the loser of a race silently overwrites the
   * winner. Nothing observable changes — so the assertion is on the QUERY.
   */
  it("filters by the id AND by the version it read", async () => {
    const { client, recorded } = fakeClient({ data: [{ version: 3 }] });
    await duelRepository(client).commit({ ...aDuel(), version: 3 }, 2);

    expect(recorded.operation).toBe("update");
    expect(recorded.filters).toEqual([
      ["id", ID],
      ["version", 2],
    ]);
  });

  it("confirms the write when exactly one row matched", async () => {
    const { client } = fakeClient({ data: [{ version: 3 }] });
    expect(await duelRepository(client).commit({ ...aDuel(), version: 3 }, 2)).toBe(
      "committed",
    );
  });

  /** Behaviour 16: the loser of the race learns it lost, and never in silence. */
  it("reports a stale version when no row matched", async () => {
    const { client } = fakeClient({ data: [] });
    expect(await duelRepository(client).commit({ ...aDuel(), version: 3 }, 2)).toBe(
      "stale",
    );
  });

  /**
   * ⛔ A failed write is not a lost race. Answering `stale` on a database error
   * tells the player "somebody moved first" and sends the client into a
   * refetch-and-retry loop against a duel that never changed.
   */
  it("never disguises a failure as a lost race", async () => {
    const { client } = fakeClient({ error: { message: "timeout" } });
    expect(await duelRepository(client).commit({ ...aDuel(), version: 3 }, 2)).toBe(
      "error",
    );
  });

  it("sends the whole row, so the seats and the clocks move together", async () => {
    const { client, recorded } = fakeClient({ data: [{ version: 3 }] });
    await duelRepository(client).commit({ ...aDuel(), version: 3 }, 2);

    expect(recorded.payload).toMatchObject({
      version: 3,
      white_remaining_ms: 600_000,
      black_remaining_ms: 600_000,
    });
  });
});
