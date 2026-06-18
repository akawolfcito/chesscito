/**
 * POST /api/admin/content — db-backed-content Phase 1 (write side only).
 *
 * The ADMIN_TOKEN-gated write route: gate on a server-only shared secret,
 * rate-limit, BFS-validate the record (reusing buildCatalog), upsert a
 * content_overlay row keyed by (kind, id), then revalidateTag("content").
 * The read path still serves the baseline this phase — these tests assert the
 * write contract only.
 *
 * Fail-closed proof: 503 when ADMIN_TOKEN unset, 403 on a bad token, 400 on an
 * unsolvable/malformed record, 503 when Supabase is unconfigured — and NEVER an
 * upsert in any of those branches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import { POST } from "../route";
import { revalidateTag } from "next/cache";
import { enforceRateLimit } from "@/lib/server/demo-signing";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedRevalidate = vi.mocked(revalidateTag);
const mockedRate = vi.mocked(enforceRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

const TOKEN = "s3cr3t-admin-token";

// A real, BFS-solvable rook exercise (a1 → h1 along rank 1, empty board).
function validRecord(over: Record<string, unknown> = {}) {
  return {
    id: "rook-overlay-1",
    kind: "exercise",
    piece: "rook",
    fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
    target: "h1",
    mover: "a1",
    tier: "easy",
    tags: null,
    explanation: null,
    order: 0,
    disabled: false,
    ...over,
  };
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin/content", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authed(body: unknown) {
  return req({ kind: "exercise", record: body }, { "x-admin-token": TOKEN });
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.from.mockReturnValue({ upsert: supabaseMock.upsert });
  supabaseMock.upsert.mockResolvedValue({ error: null });
  mockedSupabase.mockReturnValue(supabaseMock as never);
  process.env.ADMIN_TOKEN = TOKEN;
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("POST /api/admin/content", () => {
  it("returns 503 and never writes when ADMIN_TOKEN is unset", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await POST(authed(validRecord()));
    expect(res.status).toBe(503);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("returns 403 and never writes on a bad/absent admin token", async () => {
    const res = await POST(req({ kind: "exercise", record: validRecord() }, { "x-admin-token": "wrong" }));
    expect(res.status).toBe(403);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 and never writes on an unsolvable/malformed record", async () => {
    const res = await POST(authed(validRecord({ target: "z9" })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(authed(validRecord()));
    expect(res.status).toBe(503);
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockedRate.mockRejectedValueOnce(new Error("Rate limit exceeded"));
    const res = await POST(authed(validRecord()));
    expect(res.status).toBe(429);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("upserts (kind,id,stage), revalidates the content tag, and returns the saved row", async () => {
    const res = await POST(authed(validRecord()));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.revalidated).toBe(true);
    expect(body.saved.id).toBe("rook-overlay-1");
    expect(body.saved.kind).toBe("exercise");
    expect(body.saved.optimal_moves).toBe(1); // a1 → h1 is one rook move
    expect(typeof body.saved.updated_at).toBe("string");

    expect(supabaseMock.from).toHaveBeenCalledWith("content_overlay");
    const [row, opts] = supabaseMock.upsert.mock.calls[0];
    expect(row).toMatchObject({ id: "rook-overlay-1", kind: "exercise", optimal_moves: 1 });
    expect(opts).toMatchObject({ onConflict: "kind,id,stage" });
    expect(row).toMatchObject({ stage: "draft" }); // Save lands at draft
    expect(mockedRevalidate).toHaveBeenCalledWith("content");
  });
});
