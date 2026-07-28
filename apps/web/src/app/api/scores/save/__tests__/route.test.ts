/**
 * POST /api/scores/save — session-token write path (Slice 0.1).
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1, §10.
 *
 * The endpoint no longer verifies a signature per save; it spends one save
 * from a write session (see `session/__tests__/routes.test.ts` for the
 * signature side). What must NOT have regressed is everything Slice 0
 * established: the wallet is never taken from the body, every value is
 * bounded server-side, the surface is checked against the deployment, and an
 * absent Origin buys nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), eval: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => redisMock } }));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceScoreSaveRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import { POST } from "../route";
import { enforceScoreSaveRateLimit } from "@/lib/server/demo-signing";
import { getSupabaseServer } from "@/lib/supabase/server";
import { MAX_SCORE_PER_LEVEL } from "@/lib/scores/save-authorization";
import { hashSessionToken } from "@/lib/server/score-session-store";
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";

const mockedRate = vi.mocked(enforceScoreSaveRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

const WALLET_A = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const WALLET_B = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);

type Session = {
  wallet: string;
  surface: "learn" | "play";
  maxSaves: number;
  usedSaves: number;
  expired?: boolean;
  revoked?: boolean;
};

/** Sessions keyed by token HASH — the endpoint must never look one up by raw
 *  token, and this makes that observable. Mirrors the SQL predicates,
 *  including that `used_saves < max_saves` is evaluated at consume time. */
function installSessions(entries: Record<string, Session>) {
  const byHash = new Map<string, Session>();
  for (const [token, s] of Object.entries(entries)) {
    byHash.set(hashSessionToken(token), { ...s });
  }

  supabaseMock.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn === "consume_score_write_session") {
      const s = byHash.get(args.p_token_hash as string);
      if (!s) return Promise.resolve({ data: { status: "not_found" }, error: null });
      if (s.revoked) return Promise.resolve({ data: { status: "revoked" }, error: null });
      if (s.expired) return Promise.resolve({ data: { status: "expired" }, error: null });
      if (s.usedSaves >= s.maxSaves) {
        return Promise.resolve({ data: { status: "exhausted" }, error: null });
      }
      s.usedSaves += 1;
      return Promise.resolve({
        data: {
          status: "consumed",
          wallet: s.wallet,
          surface: s.surface,
          usedSaves: s.usedSaves,
          maxSaves: s.maxSaves,
        },
        error: null,
      });
    }
    if (fn === "save_basic_score") {
      return Promise.resolve({
        data: { status: "saved", mode: "free", freeUsed: 1 },
        error: null,
      });
    }
    throw new Error(`unexpected rpc ${fn}`);
  });

  return byHash;
}

function makeRequest(
  body: unknown,
  token: string | null = TOKEN_A,
  headers: Record<string, string> = { origin: "http://localhost:3000" },
) {
  const h: Record<string, string> = { "content-type": "application/json", ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/scores/save", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { levelId: 1, score: 1200, timeMs: 5000 };

describe("POST /api/scores/save — session token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setLoggerSink(() => {});
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    mockedRate.mockResolvedValue(undefined);
    mockedSupabase.mockReturnValue(supabaseMock as never);
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 25, usedSaves: 0 },
    });
  });

  afterEach(() => {
    __resetLoggerSink();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // ── 9: the happy path ────────────────────────────────────────────────────

  it("saves under a valid token", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "saved", mode: "free" });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({
        p_wallet: WALLET_A,
        p_level_id: 1,
        p_score: 1200,
        p_surface: "learn",
      }),
    );
  });

  it("looks the session up by token HASH, never by the raw token", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(supabaseMock.rpc).toHaveBeenCalledWith("consume_score_write_session", {
      p_token_hash: hashSessionToken(TOKEN_A),
    });
  });

  // ── 10: the wallet comes from the token ──────────────────────────────────

  it("writes to the token's wallet, not one supplied in the body", async () => {
    // "A token for another wallet" is not expressible: identity comes out of
    // the session row, so a body-level player has nowhere to take effect.
    await POST(makeRequest({ ...VALID_BODY, player: WALLET_B, wallet: WALLET_B }));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({ p_wallet: WALLET_A }),
    );
  });

  it("writes to wallet B under B's token, with the same body", async () => {
    installSessions({
      [TOKEN_B]: { wallet: WALLET_B, surface: "learn", maxSaves: 25, usedSaves: 0 },
    });
    await POST(makeRequest(VALID_BODY, TOKEN_B));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({ p_wallet: WALLET_B }),
    );
  });

  // ── 11–13: token state ───────────────────────────────────────────────────

  it("rejects a request with no token", async () => {
    const res = await POST(makeRequest(VALID_BODY, null));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "missing_session" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed Authorization header without touching the DB", async () => {
    const res = await POST(makeRequest(VALID_BODY, "not-a-token"));
    expect(res.status).toBe(401);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    const res = await POST(makeRequest(VALID_BODY, "c".repeat(64)));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "invalid_session" });
  });

  it("rejects an expired token", async () => {
    installSessions({
      [TOKEN_A]: {
        wallet: WALLET_A, surface: "learn", maxSaves: 25, usedSaves: 0, expired: true,
      },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "session_expired" });
  });

  it("rejects a revoked token", async () => {
    installSessions({
      [TOKEN_A]: {
        wallet: WALLET_A, surface: "learn", maxSaves: 25, usedSaves: 0, revoked: true,
      },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "session_revoked" });
  });

  it("rejects a token minted on the other product", async () => {
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "play", maxSaves: 25, usedSaves: 0 },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "surface_mismatch" });
  });

  // ── 14: the budget ───────────────────────────────────────────────────────

  it("spends exactly one save per request", async () => {
    const sessions = installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 3, usedSaves: 0 },
    });
    await POST(makeRequest(VALID_BODY));
    await POST(makeRequest(VALID_BODY));
    expect(sessions.get(hashSessionToken(TOKEN_A))!.usedSaves).toBe(2);
  });

  it("refuses the save that would cross maxSaves", async () => {
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 2, usedSaves: 2 },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ reason: "session_exhausted" });
  });

  it("never writes a score once the budget is spent", async () => {
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 1, usedSaves: 0 },
    });
    await POST(makeRequest(VALID_BODY));
    supabaseMock.rpc.mockClear();
    const res = await POST(makeRequest({ ...VALID_BODY, score: 1500 }));
    expect(res.status).toBe(409);
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      "save_basic_score",
      expect.anything(),
    );
  });

  it("does not exceed the budget under concurrent requests", async () => {
    const sessions = installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 3, usedSaves: 0 },
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        POST(makeRequest({ ...VALID_BODY, score: 1000 + i })),
      ),
    );
    const ok = results.filter((r) => r.status === 200).length;
    const refused = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(3);
    expect(refused).toBe(5);
    expect(sessions.get(hashSessionToken(TOKEN_A))!.usedSaves).toBe(3);
  });

  // ── 15, 22: bounds survive ───────────────────────────────────────────────

  it("rejects a score above the per-level ceiling even with a valid token", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, score: MAX_SCORE_PER_LEVEL + 1 }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "score_out_of_range" });
    // Bounds run BEFORE the spend: a rejected value must not cost a save.
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("accepts a score exactly at the ceiling", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, score: MAX_SCORE_PER_LEVEL }));
    expect(res.status).toBe(200);
    expect(MAX_SCORE_PER_LEVEL * 6).toBeLessThan(2_147_483_647);
  });

  it.each([
    ["out-of-range level", { levelId: 9 }],
    ["NaN score", { score: Number.NaN }],
    ["negative score", { score: -100 }],
    ["Infinity score", { score: Number.POSITIVE_INFINITY }],
    ["fractional score", { score: 12.5 }],
    ["string score", { score: "1200" }],
    ["zero time", { timeMs: 0 }],
  ])("rejects %s", async (_label, over) => {
    const res = await POST(makeRequest({ ...VALID_BODY, ...over }));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── origin ───────────────────────────────────────────────────────────────

  it("still requires a token when Origin and Referer are absent", async () => {
    const res = await POST(makeRequest(VALID_BODY, null, {}));
    expect(res.status).toBe(401);
  });

  it("accepts a header-less request that carries a valid token", async () => {
    // Proves the rejection above was about the token, not the headers —
    // MiniPay's WebView must keep working.
    const res = await POST(makeRequest(VALID_BODY, TOKEN_A, {}));
    expect(res.status).toBe(200);
  });

  it("rejects a mismatched origin outright", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://learn.chesscito.xyz";
    const res = await POST(makeRequest(VALID_BODY, TOKEN_A, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── infrastructure ───────────────────────────────────────────────────────

  it("returns 429 when the limiter trips, before any DB work", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 rather than a false 'saved' when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it("fails closed when the session store is unreachable", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it("never touches the on-chain lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await POST(makeRequest(VALID_BODY));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
