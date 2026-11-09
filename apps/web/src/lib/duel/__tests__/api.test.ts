import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  createDuelRequest,
  fetchDuel,
  joinDuelRequest,
  moveRequest,
  resignRequest,
} from "../api";
import {
  forgetSeatToken,
  readStoredSeatToken,
  storeSeatToken,
} from "../seat-store";

const ID = "A".repeat(22);
const TOKEN = "the-seat-credential";

function respond(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the credential never touches a URL", () => {
  /**
   * ⛔ THE ASSERTION THIS FILE EXISTS FOR, checked on EVERY call that carries a
   * credential. A URL ends up in access logs, in `Referer` headers sent to
   * third parties and in browser history; a token there is a seat given away.
   * The server already refuses to read the query string, so this is the other
   * half of the same lock.
   */
  it("puts it in the body on join, move and resign — and in no URL", async () => {
    fetchMock.mockImplementation(() => respond(200, { ok: true, duel: { id: ID } }));

    await joinDuelRequest(ID, { seatToken: TOKEN });
    await moveRequest(ID, { san: "e4", version: 2, seatToken: TOKEN });
    await resignRequest(ID, { version: 2, seatToken: TOKEN });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain(TOKEN);
      expect(String(init.body)).toContain(TOKEN);
    }
  });

  /** ⚠️ A duel id is base64url and can contain `-`/`_`; it still must be
   *  escaped so a hostile id cannot climb out of the path. */
  it("escapes the duel id into the path", async () => {
    fetchMock.mockImplementation(() => respond(200, { ok: true, duel: { id: ID } }));
    await fetchDuel("../../admin");

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/duel/..%2F..%2Fadmin");
  });
});

describe("reading the answer", () => {
  it("hands back the duel on success, with the credential when one was issued", async () => {
    fetchMock.mockReturnValue(
      respond(200, { ok: true, duel: { id: ID }, seatToken: TOKEN }),
    );
    const result = await createDuelRequest({ minutes: 10 });

    expect(result.ok).toBe(true);
    expect(result.ok && result.seatToken).toBe(TOKEN);
  });

  /** Behaviour 16: the refusal that carries fresh state must keep it. */
  it("keeps the fresh duel that comes with a version-conflict", async () => {
    fetchMock.mockReturnValue(
      respond(409, { ok: false, error: "version-conflict", duel: { id: ID, version: 5 } }),
    );
    const result = await moveRequest(ID, { san: "e4", version: 2 });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("version-conflict");
    expect(result.ok === false && result.duel?.version).toBe(5);
  });

  it("names an ordinary refusal instead of throwing", async () => {
    fetchMock.mockReturnValue(respond(409, { ok: false, error: "illegal-move" }));

    await expect(moveRequest(ID, { san: "e9", version: 2 })).resolves.toEqual({
      ok: false,
      error: "illegal-move",
      duel: undefined,
    });
  });

  /**
   * ⛔ A request that never got an answer is NOT a refusal: it may have
   * applied. It is named `network` so the Arena can take the only safe branch —
   * re-READ, never re-POST. A retry after a silent success plays twice.
   */
  it("names a dead network as its own thing", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));

    for (const call of [
      fetchDuel(ID),
      moveRequest(ID, { san: "e4", version: 2 }),
      joinDuelRequest(ID, {}),
      resignRequest(ID, { version: 2 }),
    ]) {
      await expect(call).resolves.toEqual({ ok: false, error: "network" });
    }
  });

  it("survives a body that is not JSON", async () => {
    fetchMock.mockReturnValue(
      Promise.resolve(new Response("<html>502</html>", { status: 502 })),
    );

    expect((await fetchDuel(ID)).ok).toBe(false);
  });

  /** ⚠️ The flag is materialized INSIDE the GET, so a cached answer is a duel
   *  frozen in the past — one that would never show the clock running out. */
  it("never lets the read be served from cache", async () => {
    fetchMock.mockReturnValue(respond(200, { ok: true, duel: { id: ID } }));
    await fetchDuel(ID);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });
});

describe("the seat store", () => {
  beforeEach(() => window.localStorage.clear());

  it("remembers a credential per duel", () => {
    storeSeatToken(ID, TOKEN);
    expect(readStoredSeatToken(ID)).toBe(TOKEN);
  });

  /**
   * ⛔ Keyed PER DUEL. One shared key would mean opening a second duel silently
   * evicts the credential of the first — and the eviction is invisible until
   * the player returns to the first game and finds themselves a spectator in a
   * duel they are seated in.
   */
  it("does not let a second duel evict the first", () => {
    storeSeatToken(ID, TOKEN);
    storeSeatToken("B".repeat(22), "another-credential");

    expect(readStoredSeatToken(ID)).toBe(TOKEN);
    expect(readStoredSeatToken("B".repeat(22))).toBe("another-credential");
  });

  it("forgets one duel without touching the other", () => {
    storeSeatToken(ID, TOKEN);
    storeSeatToken("B".repeat(22), "another-credential");
    forgetSeatToken(ID);

    expect(readStoredSeatToken(ID)).toBeNull();
    expect(readStoredSeatToken("B".repeat(22))).toBe("another-credential");
  });

  /** ⚠️ Safari in private mode throws on `setItem`. A storage quota is not a
   *  reason to fail a chess move — the token is also in a cookie. */
  it("never throws when storage refuses", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(() => storeSeatToken(ID, TOKEN)).not.toThrow();
    expect(readStoredSeatToken(ID)).toBeNull();

    setItem.mockRestore();
    getItem.mockRestore();
  });

  it("treats a blank stored value as no credential", () => {
    window.localStorage.setItem(`chesscito:duel:${ID}:seat`, "");
    expect(readStoredSeatToken(ID)).toBeNull();
  });
});
