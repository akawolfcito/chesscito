/**
 * POST /api/scores/save — Slice 3 endpoint tests.
 *
 * The off-chain basic SaveScore endpoint: validate transport, re-derive
 * saveId, build the save_game attestation, call the atomic
 * save_basic_score RPC (Slice 1), soft rate-limit on a DEDICATED bucket,
 * map the jsonb to BasicScoreSaveResult.
 *
 * NEVER calls /api/sign-score, submitScoreSigned, Scoreboard, or any
 * wallet write — proven here by a fetch spy + rpc-arg assertions.
 *
 * Supabase-null behaviour: the SERVER returns 503 error (NOT an
 * optimistic "saved"). Returning saved without persisting would corrupt
 * the optimistic leaderboard entry + freeUsed count. The optimistic
 * quick-save-local degrade lives in the CLIENT (Slice 5), per spec.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), eval: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => redisMock } }));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceScoreSaveRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/peones/ledger-service-server", () => ({
  buildAttestationHash: vi.fn(() => "att-sentinel"),
}));

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import { POST } from "../route";
import {
  enforceOrigin,
  enforceScoreSaveRateLimit,
} from "@/lib/server/demo-signing";
import { buildAttestationHash } from "@/lib/peones/ledger-service-server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { deriveScoreSaveId } from "@/lib/scores/save-service";
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceScoreSaveRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const GAME = "game-7";
const SAVE_ID = deriveScoreSaveId(WALLET, 1, GAME);

function body(over: Record<string, unknown> = {}) {
  return {
    player: WALLET,
    levelId: 1,
    score: 120,
    timeMs: 5000,
    gameId: GAME,
    saveId: SAVE_ID,
    ...over,
  };
}

function makeRequest(b: unknown) {
  return new Request("http://localhost/api/scores/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b),
  });
}

function rpcOk(jsonb: Record<string, unknown>) {
  supabaseMock.rpc.mockResolvedValue({ data: jsonb, error: null });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

describe("POST /api/scores/save", () => {
  beforeEach(() => {
    mockedOrigin.mockReset().mockImplementation(() => {});
    mockedRate.mockReset().mockResolvedValue(undefined);
    mockedSupabase.mockReset().mockReturnValue(supabaseMock as never);
    supabaseMock.rpc.mockReset();
    vi.mocked(buildAttestationHash).mockReset().mockReturnValue("att-sentinel");
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    __setLoggerSink(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    __resetLoggerSink();
  });

  // ── validation ──────────────────────────────────────────────────
  it("rejects a non-object / missing-field payload → 400 invalid", async () => {
    const res = await POST(makeRequest({ player: WALLET }));
    expect(res.status).toBe(400);
    expect((await res.json()).status).toBe("invalid");
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid wallet → 400 invalid", async () => {
    const res = await POST(makeRequest(body({ player: "0xnope" })));
    expect(res.status).toBe(400);
    expect((await res.json()).status).toBe("invalid");
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a saveId that does not match the derived id → 400 invalid", async () => {
    const res = await POST(makeRequest(body({ saveId: "forged:9:x" })));
    expect(res.status).toBe(400);
    expect((await res.json()).status).toBe("invalid");
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects out-of-range levelId / non-positive score / timeMs → 400", async () => {
    for (const bad of [{ levelId: 0 }, { levelId: 7 }, { score: 0 }, { timeMs: 0 }]) {
      supabaseMock.rpc.mockClear();
      // saveId must still match for levelId cases; recompute when level changes
      const lvl = (bad as { levelId?: number }).levelId ?? 1;
      const res = await POST(
        makeRequest(body({ ...bad, saveId: deriveScoreSaveId(WALLET, lvl, GAME) })),
      );
      expect(res.status).toBe(400);
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    }
  });

  // ── guards ──────────────────────────────────────────────────────
  it("rate-limited → 429 rate_limited, RPC not called", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(429);
    expect((await res.json()).status).toBe("rate_limited");
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("uses the DEDICATED score-save rate-limit bucket", async () => {
    rpcOk({ status: "saved", mode: "free", freeUsed: 1 });
    await POST(makeRequest(body()));
    expect(mockedRate).toHaveBeenCalledTimes(1);
  });

  it("origin forbidden → 403", async () => {
    mockedOrigin.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(403);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── supabase unavailable (SAFE: 503, not optimistic) ────────────
  it("supabase null → 503 error unavailable, RPC not called (no optimistic saved)", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("error");
    expect(json.reason).toBe("unavailable");
  });

  // ── happy paths ─────────────────────────────────────────────────
  it("RPC saved/free → 200 saved free with quota", async () => {
    rpcOk({ status: "saved", mode: "free", freeUsed: 1 });
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("saved");
    expect(json.mode).toBe("free");
    expect(json.quota.freeUsed).toBe(1);
    expect(json.quota.freeRemaining).toBe(4);
    expect(json.quota.requiresPeones).toBe(false);
  });

  it("RPC saved/peones → 200 spent 1", async () => {
    rpcOk({ status: "saved", mode: "peones", spent: 1, freeUsed: 6, balance: 4 });
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("saved");
    expect(json.mode).toBe("peones");
    expect(json.spent).toBe(1);
    expect(json.quota.requiresPeones).toBe(true);
  });

  it("RPC duplicate → 200 duplicate", async () => {
    rpcOk({ status: "duplicate", mode: "free", freeUsed: 3 });
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("duplicate");
  });

  it("RPC insufficient_peones → 409 with required + balance", async () => {
    rpcOk({ status: "insufficient_peones", required: 1, balance: 0, freeUsed: 6 });
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.status).toBe("insufficient_peones");
    expect(json.required).toBe(1);
    expect(json.balance).toBe(0);
  });

  it("RPC error → 500 controlled error", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    const res = await POST(makeRequest(body()));
    expect(res.status).toBe(500);
    expect((await res.json()).status).toBe("error");
  });

  // ── attestation + wallet + isolation ────────────────────────────
  it("builds the save_game attestation and passes it to the RPC", async () => {
    rpcOk({ status: "saved", mode: "free", freeUsed: 1 });
    await POST(makeRequest(body()));
    expect(buildAttestationHash).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "spend",
        source: "save_game",
        source_id: SAVE_ID,
        idempotency_key: `spend:save_game:${SAVE_ID}`,
      }),
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({ p_attestation_hash: "att-sentinel" }),
    );
  });

  it("passes the wallet LOWERCASE to the RPC", async () => {
    rpcOk({ status: "saved", mode: "free", freeUsed: 1 });
    await POST(makeRequest(body({ player: WALLET.toUpperCase().replace("0X", "0x") })));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({ p_wallet: WALLET.toLowerCase() }),
    );
  });

  it("NEVER calls /api/sign-score or any on-chain fetch", async () => {
    rpcOk({ status: "saved", mode: "free", freeUsed: 1 });
    await POST(makeRequest(body()));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("only ever calls the save_basic_score RPC (no peones_spend / scoreboard)", async () => {
    rpcOk({ status: "saved", mode: "free", freeUsed: 1 });
    await POST(makeRequest(body()));
    for (const call of supabaseMock.rpc.mock.calls) {
      expect(call[0]).toBe("save_basic_score");
    }
  });
});
