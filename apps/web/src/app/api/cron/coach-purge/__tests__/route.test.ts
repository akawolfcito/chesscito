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
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";

function makeRequest(auth?: string) {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return new Request("http://localhost/api/cron/coach-purge", { headers });
}

function buildSupabaseChain(passes: Array<{ data?: number | null; error?: { message: string; code: string } | null }>) {
  let callIndex = 0;
  return { rpc: vi.fn().mockImplementation(() => Promise.resolve(passes[callIndex++] ?? { data: 0, error: null })) };
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
    __resetLoggerSink();
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
    expect(getSupabaseServer).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("401 — unset secret fails closed", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(makeRequest("Bearer s3cret"))).status).toBe(401);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("503 — missing Supabase config does not acquire the lock", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    expect((await GET(makeRequest("Bearer s3cret"))).status).toBe(503);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("returns { skipped: true } when another run holds the lock", async () => {
    // Supabase env present (cheap-check passes); lock collision is what we exercise.
    const chain = buildSupabaseChain([]);
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    redisMock.set.mockResolvedValue(null); // SETNX collision
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: true, reason: "another run in progress" });
    expect(chain.rpc).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  it("happy path — single pass returns rows_deleted with cumulative count", async () => {
    const chain = buildSupabaseChain([{ data: 2, error: null }]);
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ rows_deleted: 2 });
    expect(chain.rpc).toHaveBeenCalledExactlyOnceWith("purge_expired_coach_analyses");
    expect(redisMock.del).toHaveBeenCalledWith("coach:cron:purge");
  });

  it("happy path — multi-pass terminates when batch < limit", async () => {
    const chain = buildSupabaseChain([
      { data: 5000, error: null },
      { data: 17, error: null },
    ]);
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    const body = await res.json();
    expect(body).toEqual({ rows_deleted: 5017 });
  });

  it("500 on supabase error mid-pass — partial count returned", async () => {
    const chain = buildSupabaseChain([
      { data: 5000, error: null },
      { data: null, error: { message: "boom", code: "42703" } },
    ]);
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "purge failed", deleted_before_failure: 5000 });
    expect(redisMock.del).toHaveBeenCalledWith("coach:cron:purge");
  });

  it("200 — zero expired rows is a successful no-op", async () => {
    const chain = buildSupabaseChain([{ data: 0, error: null }]);
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rows_deleted: 0 });
    expect(chain.rpc).toHaveBeenCalledTimes(1);
    expect(redisMock.del).toHaveBeenCalledTimes(1);
  });

  it("caps one run at twenty batches", async () => {
    const chain = buildSupabaseChain(Array.from({ length: 21 }, () => ({ data: 5000, error: null })));
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    expect(await (await GET(makeRequest("Bearer s3cret"))).json()).toEqual({ rows_deleted: 100000 });
    expect(chain.rpc).toHaveBeenCalledTimes(20);
  });

  it.each([null, -1, 5001, 1.5])("500 — invalid RPC count %s is not silently treated as zero", async (data) => {
    vi.mocked(getSupabaseServer).mockReturnValue(buildSupabaseChain([{ data, error: null }]) as never);
    expect((await GET(makeRequest("Bearer s3cret"))).status).toBe(500);
    expect(redisMock.del).toHaveBeenCalledTimes(1);
  });

  it("503 — Redis failure never runs the destructive RPC or logs exception text", async () => {
    const sink = vi.fn();
    __setLoggerSink(sink);
    const chain = buildSupabaseChain([]);
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    redisMock.set.mockRejectedValue(new Error("sensitive transport message"));
    expect((await GET(makeRequest("Bearer s3cret"))).status).toBe(503);
    expect(chain.rpc).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
    expect(sink.mock.calls[0][0]).toContain("coach_purge_lock_failed");
    expect(sink.mock.calls[0][0]).not.toContain("sensitive transport message");
  });

  it("500 — rejected RPC preserves partial count and releases the lock", async () => {
    const chain = buildSupabaseChain([{ data: 5000, error: null }]);
    chain.rpc.mockResolvedValueOnce({ data: 5000, error: null }).mockRejectedValueOnce(new Error("transport failure"));
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "purge failed", deleted_before_failure: 5000 });
    expect(redisMock.del).toHaveBeenCalledTimes(1);
  });

  it("logs Supabase codes without raw error text, including a missing migration", async () => {
    const sink = vi.fn();
    __setLoggerSink(sink);
    const chain = buildSupabaseChain([{ data: null, error: { code: "PGRST202", message: "sensitive backend message" } }]);
    vi.mocked(getSupabaseServer).mockReturnValue(chain as never);
    expect((await GET(makeRequest("Bearer s3cret"))).status).toBe(500);
    expect(sink.mock.calls[0][0]).toContain('"code":"PGRST202"');
    expect(sink.mock.calls[0][0]).not.toContain("sensitive backend message");
  });

  it("reports lock release failures without masking the successful purge", async () => {
    const sink = vi.fn();
    __setLoggerSink(sink);
    vi.mocked(getSupabaseServer).mockReturnValue(buildSupabaseChain([{ data: 0, error: null }]) as never);
    redisMock.del.mockRejectedValue(new Error("release failure"));
    expect((await GET(makeRequest("Bearer s3cret"))).status).toBe(200);
    expect(sink.mock.calls.at(-1)?.[0]).toContain("coach_purge_lock_release_failed");
  });
});
