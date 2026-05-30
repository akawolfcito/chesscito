import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { __setLoggerSink, __resetLoggerSink, type LogLevel } from "@/lib/server/logger";

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  eval: vi.fn(),
  lpush: vi.fn(),
  lpos: vi.fn(),
  ltrim: vi.fn(),
  lrange: vi.fn(),
  llen: vi.fn(),
  exists: vi.fn(),
  lrem: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

const enforceGameCapMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/game-persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/coach/game-persistence")>();
  return {
    ...actual,
    enforceGameCap: enforceGameCapMock,
  };
});

import { GET, POST } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";
import { GAME_LIST_LPUSH_LUA } from "@/lib/coach/game-persistence";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const VALID_GAME_ID = "11111111-2222-3333-4444-555555555555";

function makePost(body: unknown) {
  return new Request("http://localhost/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(wallet: string | null) {
  const suffix = wallet === null ? "" : `?wallet=${wallet}`;
  return new Request(`http://localhost/api/games${suffix}`, { method: "GET" });
}

function validGame(overrides: Record<string, unknown> = {}) {
  return {
    gameId: VALID_GAME_ID,
    moves: ["e4", "e5", "Nf3"],
    result: "win",
    difficulty: "easy",
    ...overrides,
  };
}

describe("POST /api/games", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.set.mockReset();
    redisMock.eval.mockReset();
    redisMock.lpush.mockReset();
    redisMock.lpos.mockReset();
    redisMock.ltrim.mockReset();
    enforceGameCapMock.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue("OK");
    redisMock.eval.mockResolvedValue(1); // default: Lua reports "pushed"
    redisMock.ltrim.mockResolvedValue("OK");
    enforceGameCapMock.mockResolvedValue({ evicted: [], softOverflow: false });
  });

  it("stores the game and returns 200 on valid input", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(redisMock.set).toHaveBeenCalledWith(
      `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`,
      expect.objectContaining({ gameId: VALID_GAME_ID, totalMoves: 3 }),
      expect.objectContaining({ ex: expect.any(Number) }),
    );
  });

  it("delegates list-cap enforcement to enforceGameCap (replaces ltrim)", async () => {
    await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
    expect(redisMock.ltrim).not.toHaveBeenCalled();
    expect(enforceGameCapMock).toHaveBeenCalledTimes(1);
    const [redisArg, walletArg, options] = enforceGameCapMock.mock.calls[0];
    expect(redisArg).toBe(redisMock);
    expect(walletArg).toBe(VALID_WALLET);
    expect(typeof options?.onOverflow).toBe("function");
  });

  it("returns 400 when walletAddress is missing", async () => {
    const res = await POST(makePost({ game: validGame() }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when game is missing", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when wallet is malformed", async () => {
    const res = await POST(makePost({ walletAddress: "0xnope", game: validGame() }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when gameId is not a UUID", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ gameId: "not-a-uuid" }) }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when moves is not an array", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ moves: "e4" }) }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when moves array exceeds MAX_MOVES", async () => {
    const tooMany = Array.from({ length: 501 }, () => "e4");
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ moves: tooMany }) }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when a move is longer than 10 chars", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ moves: ["e4", "waytoolongmove"] }) }));
    expect(res.status).toEqual(400);
  });

  it("persists playerColor when present and valid (white)", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ playerColor: "w" }) }));
    expect(res.status).toEqual(200);
    expect(redisMock.set).toHaveBeenCalledWith(
      `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`,
      expect.objectContaining({ playerColor: "w" }),
      expect.objectContaining({ ex: expect.any(Number) }),
    );
  });

  it("persists playerColor when present and valid (black)", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ playerColor: "b" }) }));
    expect(res.status).toEqual(200);
    expect(redisMock.set).toHaveBeenCalledWith(
      `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`,
      expect.objectContaining({ playerColor: "b" }),
      expect.objectContaining({ ex: expect.any(Number) }),
    );
  });

  it("returns 400 when playerColor is not 'w' or 'b'", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ playerColor: "x" }) }));
    expect(res.status).toEqual(400);
  });

  it("accepts records without playerColor (backward compat with legacy entries)", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
    expect(res.status).toEqual(200);
    expect(redisMock.set).toHaveBeenCalledWith(
      `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`,
      expect.not.objectContaining({ playerColor: expect.anything() }),
      expect.objectContaining({ ex: expect.any(Number) }),
    );
  });

  it("returns 500 when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
    expect(res.status).toEqual(500);
  });

  describe("atomic LPOS+LPUSH via Lua eval (Cluster E defer #1)", () => {
    it("delegates list-dedupe to redis.eval with the Lua script, listKey, and gameId", async () => {
      const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));

      expect(res.status).toEqual(200);
      expect(redisMock.eval).toHaveBeenCalledTimes(1);
      expect(redisMock.eval).toHaveBeenCalledWith(
        GAME_LIST_LPUSH_LUA,
        [`coach:games:${VALID_WALLET}`],
        [VALID_GAME_ID],
      );
    });

    it("returns 200 when eval reports pushed (1)", async () => {
      redisMock.eval.mockResolvedValue(1);

      const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));

      expect(res.status).toEqual(200);
    });

    it("returns 200 when eval reports skipped (0) — retried POST refreshes record", async () => {
      redisMock.eval.mockResolvedValue(0);

      const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));

      expect(res.status).toEqual(200);
      // record upsert still happens — recordedAt refreshes via SET
      expect(redisMock.set).toHaveBeenCalledTimes(1);
    });

    it("never calls redis.lpos or redis.lpush directly (atomicity guard)", async () => {
      await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));

      expect(redisMock.lpos).not.toHaveBeenCalled();
      expect(redisMock.lpush).not.toHaveBeenCalled();
    });

    it("dispatches one eval per POST under concurrent same-gameId load (regression net)", async () => {
      // Mock cannot prove atomicity — Redis Lua's single-threaded
      // execution does. This test only asserts the route delegates to
      // eval N times without crashing under parallel dispatch.
      redisMock.eval.mockImplementation(async () =>
        redisMock.eval.mock.calls.length === 1 ? 1 : 0,
      );

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          POST(makePost({ walletAddress: VALID_WALLET, game: validGame() })),
        ),
      );

      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(redisMock.eval).toHaveBeenCalledTimes(5);
      expect(redisMock.lpos).not.toHaveBeenCalled();
      expect(redisMock.lpush).not.toHaveBeenCalled();
    });
  });

  describe("error logging (Cluster E defer — Blind hunter #12)", () => {
    const captured: Array<{ level: LogLevel; line: string }> = [];

    beforeEach(() => {
      captured.length = 0;
      __setLoggerSink((line, level) => { captured.push({ level, line }); });
    });

    afterEach(() => {
      __resetLoggerSink();
    });

    it("emits structured error log when redis.set throws (replaces silent catch {})", async () => {
      redisMock.set.mockRejectedValue(new Error("redis connection refused"));

      const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
      expect(res.status).toEqual(500);

      const errLine = captured.find(c => c.level === "error" && c.line.includes("game_persist_error"));
      expect(errLine, "expected an error log line with msg=game_persist_error").toBeDefined();
      const parsed = JSON.parse(errLine!.line);
      expect(parsed.level).toBe("error");
      expect(parsed.route).toBe("/api/games");
      expect(parsed.error).toContain("redis connection refused");
    });

    it("emits error log when enforceGameCap throws", async () => {
      enforceGameCapMock.mockRejectedValue(new Error("cap enforcement failed"));

      const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
      expect(res.status).toEqual(500);

      const errLine = captured.find(c => c.level === "error" && c.line.includes("game_persist_error"));
      expect(errLine).toBeDefined();
      const parsed = JSON.parse(errLine!.line);
      expect(parsed.error).toContain("cap enforcement failed");
    });

    it("does NOT emit error log on happy path", async () => {
      const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
      expect(res.status).toEqual(200);
      const errLines = captured.filter(c => c.level === "error");
      expect(errLines).toHaveLength(0);
    });
  });
});

describe("GET /api/games", () => {
  const UUID_A = "11111111-2222-3333-4444-555555555555";
  const UUID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.lrange.mockReset();
    redisMock.get.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
  });

  it("returns games list on valid wallet query", async () => {
    redisMock.lrange.mockResolvedValue([UUID_A, UUID_B]);
    redisMock.get.mockImplementation((key: string) =>
      Promise.resolve({ gameId: key.split(":").pop(), moves: [] }),
    );

    const res = await GET(makeGet(VALID_WALLET));
    expect(res.status).toEqual(200);
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((g) => g.gameId)).toEqual([UUID_A, UUID_B]);
  });

  it("drops missing entries (null values filtered)", async () => {
    redisMock.lrange.mockResolvedValue([UUID_A, UUID_B]);
    redisMock.get.mockImplementation((key: string) =>
      key.endsWith(UUID_A) ? Promise.resolve({ gameId: UUID_A, moves: [] }) : Promise.resolve(null),
    );

    const res = await GET(makeGet(VALID_WALLET));
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(1);
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });
    const res = await GET(makeGet(VALID_WALLET));
    expect(res.status).toEqual(403);
  });

  it("returns 400 when wallet is missing", async () => {
    const res = await GET(makeGet(null));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when wallet is malformed", async () => {
    const res = await GET(makeGet("0xnope"));
    expect(res.status).toEqual(400);
  });

  describe("UUID filter (Cluster E defer #4 — defense-in-depth)", () => {
    const captured: Array<{ level: LogLevel; line: string }> = [];

    beforeEach(() => {
      captured.length = 0;
      __setLoggerSink((line, level) => { captured.push({ level, line }); });
    });

    afterEach(() => {
      __resetLoggerSink();
    });

    it("filters non-UUID gameIds from list and skips their redis.get", async () => {
      redisMock.lrange.mockResolvedValue([UUID_A, "not-a-uuid", UUID_B, ""]);
      redisMock.get.mockImplementation((key: string) =>
        Promise.resolve({ gameId: key.split(":").pop(), moves: [] }),
      );

      const res = await GET(makeGet(VALID_WALLET));
      expect(res.status).toEqual(200);
      const body = (await res.json()) as Array<{ gameId: string }>;
      expect(body).toHaveLength(2);
      expect(body.map((g) => g.gameId)).toEqual([UUID_A, UUID_B]);
      // skipped corrupted entries — only 2 redis.get calls, not 4
      expect(redisMock.get).toHaveBeenCalledTimes(2);
    });

    it("emits warn log when corrupt entries are dropped (signal for corruption monitoring)", async () => {
      redisMock.lrange.mockResolvedValue([UUID_A, "legacy-non-uuid"]);
      redisMock.get.mockResolvedValue({ gameId: UUID_A, moves: [] });

      await GET(makeGet(VALID_WALLET));

      const warnLine = captured.find(c => c.level === "warn" && c.line.includes("game_list_invalid_id_filtered"));
      expect(warnLine, "expected warn log for filtered non-UUID entries").toBeDefined();
      const parsed = JSON.parse(warnLine!.line);
      expect(parsed.route).toBe("/api/games");
      expect(parsed.dropped).toBe(1);
      expect(parsed.total).toBe(2);
    });

    it("does NOT emit warn log on clean list (no false positives)", async () => {
      redisMock.lrange.mockResolvedValue([UUID_A, UUID_B]);
      redisMock.get.mockImplementation((key: string) =>
        Promise.resolve({ gameId: key.split(":").pop(), moves: [] }),
      );

      await GET(makeGet(VALID_WALLET));

      const warnLines = captured.filter(c => c.level === "warn" && c.line.includes("game_list_invalid_id_filtered"));
      expect(warnLines).toHaveLength(0);
    });
  });
});
