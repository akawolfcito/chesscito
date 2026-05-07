import { describe, it, expect, vi, beforeEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  lrange: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { GET } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(wallet: string | null) {
  const suffix = wallet === null ? "" : `?wallet=${wallet}`;
  return new Request(`http://localhost/api/coach/history${suffix}`, { method: "GET" });
}

function makeAnalysis(gameId: string) {
  return {
    gameId,
    provider: "server",
    model: "gpt-4o-mini",
    analysisVersion: "1.0.0",
    createdAt: 1_700_000_000_000,
    response: { summary: `analysis for ${gameId}` },
  };
}

function makeGame(gameId: string) {
  return {
    gameId,
    moves: ["e4", "e5"],
    result: "win",
    difficulty: "easy",
    totalMoves: 2,
    receivedAt: 1_700_000_000_000,
  };
}

describe("GET /api/coach/history", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.lrange.mockReset();
    redisMock.get.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
  });

  it("returns paired analysis+game records (status 200)", async () => {
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key.includes("analysis:")) return Promise.resolve(makeAnalysis(key.split(":").pop()!));
      if (key.includes("game:")) return Promise.resolve(makeGame(key.split(":").pop()!));
      return Promise.resolve(null);
    });

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(200);
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((e) => e.gameId)).toEqual(["g1", "g2"]);
  });

  it("drops entries when either analysis or game is missing", async () => {
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:analysis:${VALID_WALLET}:g1`) return Promise.resolve(makeAnalysis("g1"));
      if (key === `coach:game:${VALID_WALLET}:g1`) return Promise.resolve(makeGame("g1"));
      // g2: analysis missing
      return Promise.resolve(null);
    });

    const res = await GET(makeRequest(VALID_WALLET));
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].gameId).toEqual("g1");
  });

  it("returns an empty list when the analysisList is empty", async () => {
    redisMock.lrange.mockResolvedValue([]);
    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual([]);
  });

  it("caps results at 20 entries (lrange 0..19)", async () => {
    redisMock.lrange.mockResolvedValue([]);
    await GET(makeRequest(VALID_WALLET));
    expect(redisMock.lrange).toHaveBeenCalledWith(`coach:analyses:${VALID_WALLET}`, 0, 19);
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(403);
  });

  it("returns 403 when rate limit is exceeded", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit"));
    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(403);
  });

  it("returns 400 when the wallet query param is missing", async () => {
    const res = await GET(makeRequest(null));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when the wallet address is malformed", async () => {
    const res = await GET(makeRequest("0xnope"));
    expect(res.status).toEqual(400);
  });
});

// recoverMessageAddress is mocked at the viem layer so tests don't have
// to compute real signatures. The DELETE handler is the only consumer of
// this API surface in this file, so a partial mock is safe.
vi.mock("viem", async (importActual) => {
  const actual = await importActual<typeof import("viem")>();
  return {
    ...actual,
    recoverMessageAddress: vi.fn(),
  };
});

import { DELETE } from "../route";
import { recoverMessageAddress } from "viem";

const mockedRecover = vi.mocked(recoverMessageAddress);

const DELETE_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const VALID_NONCE = "deadbeefcafef00d1234567890abcdef";
const VALID_SIG = "0x" + "11".repeat(65);

function makeDeleteRequest(body: unknown) {
  return new Request("http://localhost/api/coach/history", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function freshIso() {
  return new Date().toISOString();
}

describe("DELETE /api/coach/history", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockReset();
    redisMock.del.mockReset();
    redisMock.lrange.mockReset();
    mockedRecover.mockReset();
    vi.stubEnv("LOG_SALT", "test-salt");

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue("OK");
    redisMock.del.mockResolvedValue(1);
    redisMock.lrange.mockResolvedValue([]);
  });

  it("400 — invalid wallet shape", async () => {
    const res = await DELETE(makeDeleteRequest({
      walletAddress: "0xnotanaddress",
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(400);
  });

  it("400 — invalid nonce shape (not 32 hex chars)", async () => {
    const res = await DELETE(makeDeleteRequest({
      walletAddress: DELETE_WALLET,
      signature: VALID_SIG,
      nonce: "tooshort",
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(400);
  });

  it("410 — message older than 5 minutes", async () => {
    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const res = await DELETE(makeDeleteRequest({
      walletAddress: DELETE_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: stale,
    }));
    expect(res.status).toBe(410);
  });

  it("409 — nonce already claimed (replay)", async () => {
    redisMock.set.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest({
      walletAddress: DELETE_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(409);
  });

  it("401 — signature recovery throws", async () => {
    mockedRecover.mockRejectedValue(new Error("bad signature bytes"));
    const res = await DELETE(makeDeleteRequest({
      walletAddress: DELETE_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(401);
  });

  it("403 — recovered address ≠ body walletAddress", async () => {
    mockedRecover.mockResolvedValue("0xabababababababababababababababababababab");
    const res = await DELETE(makeDeleteRequest({
      walletAddress: DELETE_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(403);
  });

  it("503 — Supabase unavailable", async () => {
    mockedRecover.mockResolvedValue(DELETE_WALLET);
    const { getSupabaseServer } = await import("@/lib/supabase/server");
    vi.mocked(getSupabaseServer).mockReturnValue(null);

    const res = await DELETE(makeDeleteRequest({
      walletAddress: DELETE_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(503);
  });

  it("200 happy path — deletes Supabase rows + Redis keys", async () => {
    mockedRecover.mockResolvedValue(DELETE_WALLET);

    const supabaseEq = vi.fn().mockResolvedValue({ count: 7, error: null });
    const supabaseDeleteWrap = vi.fn().mockReturnValue({ eq: supabaseEq });
    const supabaseFrom = vi.fn().mockReturnValue({ delete: supabaseDeleteWrap });
    const { getSupabaseServer } = await import("@/lib/supabase/server");
    vi.mocked(getSupabaseServer).mockReturnValue({ from: supabaseFrom } as never);

    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.del.mockResolvedValue(3);

    const res = await DELETE(makeDeleteRequest({
      walletAddress: DELETE_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: true, supabase_rows: 7 });
    expect(supabaseFrom).toHaveBeenCalledWith("coach_analyses");
    expect(supabaseEq).toHaveBeenCalledWith("wallet", DELETE_WALLET);
    expect(redisMock.del).toHaveBeenCalledWith(
      `coach:analyses:${DELETE_WALLET}`,
      `coach:analysis:${DELETE_WALLET}:g1`,
      `coach:analysis:${DELETE_WALLET}:g2`,
    );
  });
});
