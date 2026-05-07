import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { GET } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

function makeRequest(auth?: string) {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return new Request("http://localhost/api/cron/coach-purge", { headers });
}

function buildSupabaseChain(passes: Array<{ data?: unknown[] | null; error?: { message: string } | null }>) {
  let callIndex = 0;
  // Production chain: from(...).delete().lt(...).order(...).limit(N).select("game_id")
  const selectAfterLimit = vi.fn().mockImplementation(() => Promise.resolve(passes[callIndex++] ?? { data: [], error: null }));
  const limitChained = vi.fn().mockReturnValue({ select: selectAfterLimit });
  const orderChained = vi.fn().mockReturnValue({ limit: limitChained });
  const lt = vi.fn().mockReturnValue({ order: orderChained });
  const del = vi.fn().mockReturnValue({ lt });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { from, del, lt, order: orderChained, limit: limitChained, select: selectAfterLimit };
}

describe("GET /api/cron/coach-purge", () => {
  const ORIG_SECRET = process.env.CRON_SECRET;

  beforeEach(() => {
    redisMock.set.mockReset();
    redisMock.del.mockReset();
    vi.mocked(getSupabaseServer).mockReset();
    vi.stubEnv("LOG_SALT", "test-salt");
    process.env.CRON_SECRET = "s3cret";
    redisMock.set.mockResolvedValue("OK");
    redisMock.del.mockResolvedValue(1);
  });

  afterEach(() => {
    if (ORIG_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIG_SECRET;
  });

  it("401 — missing authorization header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("401 — wrong bearer", async () => {
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns { skipped: true } when another run holds the lock", async () => {
    // Supabase env present (cheap-check passes); lock collision is what we exercise.
    vi.mocked(getSupabaseServer).mockReturnValue({ from: vi.fn() } as never);
    redisMock.set.mockResolvedValue(null); // SETNX collision
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: true, reason: "another run in progress" });
  });

  it("happy path — single pass returns rows_deleted with cumulative count", async () => {
    const chain = buildSupabaseChain([{ data: [{ game_id: "g1" }, { game_id: "g2" }], error: null }]);
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ rows_deleted: 2 });
    expect(redisMock.del).toHaveBeenCalledWith("coach:cron:purge");
  });

  it("happy path — multi-pass terminates when batch < limit", async () => {
    const fullBatch = Array.from({ length: 5000 }, (_, i) => ({ game_id: `g${i}` }));
    const partial = Array.from({ length: 17 }, (_, i) => ({ game_id: `g${5000 + i}` }));
    const chain = buildSupabaseChain([
      { data: fullBatch, error: null },
      { data: partial, error: null },
    ]);
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    const body = await res.json();
    expect(body).toEqual({ rows_deleted: 5017 });
  });

  it("500 on supabase error mid-pass — partial count returned", async () => {
    const chain = buildSupabaseChain([
      { data: Array.from({ length: 5000 }, (_, i) => ({ game_id: `g${i}` })), error: null },
      { data: null, error: { message: "boom" } },
    ]);
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "purge failed", deleted_before_failure: 5000 });
    expect(redisMock.del).toHaveBeenCalledWith("coach:cron:purge");
  });
});
