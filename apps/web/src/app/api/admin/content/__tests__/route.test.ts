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
  select: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

/** Minimal stand-in for the postgrest builder: `.eq()` chains, `await` resolves. */
function selectChain(result: { data: { id: string }[] | null; error: unknown }) {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return chain;
}

import { POST } from "../route";
import { EXERCISES } from "@/lib/game/exercises";
import { MAX_EXERCISES_PER_PIECE } from "@/lib/game/score";
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

/** Pretend the piece already carries these enabled overlay exercises. */
function withStoredOverlay(ids: string[], error: unknown = null) {
  supabaseMock.select.mockReturnValue(
    selectChain({ data: error ? null : ids.map((id) => ({ id })), error }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.from.mockReturnValue({
    upsert: supabaseMock.upsert,
    select: supabaseMock.select,
  });
  supabaseMock.upsert.mockResolvedValue({ error: null });
  withStoredOverlay([]);
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

describe("POST /api/admin/content — pool capacity", () => {
  /** Overlay ids that bring rook's merged pool to exactly `size`. */
  function fillTo(size: number) {
    const extra = size - EXERCISES.rook.length;
    return Array.from({ length: extra }, (_, i) => `rook-extra-${i}`);
  }

  it("accepts the write that lands exactly on the invariant", async () => {
    withStoredOverlay(fillTo(MAX_EXERCISES_PER_PIECE - 1));

    const res = await POST(authed(validRecord()));

    expect(res.status).toBe(200);
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });

  it("refuses, and never writes, the exercise that would outgrow the invariant", async () => {
    // The player-facing failure this prevents: a pool past the invariant lets
    // the client compute a score above MAX_SUBMITTABLE_SCORE, and every
    // on-chain save for that piece starts returning 400.
    withStoredOverlay(fillTo(MAX_EXERCISES_PER_PIECE));

    const res = await POST(authed(validRecord()));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors[0]).toContain(String(MAX_EXERCISES_PER_PIECE));
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("still accepts a write that disables an exercise when the pool is over the cap", async () => {
    withStoredOverlay(fillTo(MAX_EXERCISES_PER_PIECE + 5));

    const res = await POST(authed(validRecord({ disabled: true })));

    expect(res.status).toBe(200);
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });

  it("does not cap labyrinths — they never feed the score", async () => {
    withStoredOverlay(fillTo(MAX_EXERCISES_PER_PIECE + 5));

    const res = await POST(
      req(
        { kind: "labyrinth", record: validRecord({ kind: "labyrinth" }) },
        { "x-admin-token": TOKEN },
      ),
    );

    expect(res.status).toBe(200);
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });

  it("fails closed, never writing, when the capacity read errors", async () => {
    withStoredOverlay([], { message: "boom" });

    const res = await POST(authed(validRecord()));

    expect(res.status).toBe(500);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });
});
