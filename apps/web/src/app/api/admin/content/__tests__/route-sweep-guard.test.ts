/**
 * The builder cannot save over a Star Sweep — and is TOLD so.
 *
 * The read path (`mergeOverlay`) already refuses such a row, so the game is safe
 * either way. Refusing only there makes the SAVE a silent no-op: the builder
 * reports success, the row lands in `content_overlay`, and the edit never
 * appears. The author is then left debugging their own content against a system
 * that decided to ignore them without saying so.
 *
 * So the write refuses too, with the reason and the place to go instead.
 * Guard the grantor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceRateLimit: vi.fn(() => null),
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
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST } from "../route";
import { EXERCISES } from "@/lib/game/exercises";
import { isSweep } from "@/lib/game/targets";

const TOKEN = "s3cr3t-admin-token";

/** Minimal stand-in for the postgrest builder: `.eq()` chains, `await` resolves. */
function selectChain(result: { data: { id: string }[] | null; error: unknown }) {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.from.mockReturnValue({
    upsert: supabaseMock.upsert,
    select: supabaseMock.select,
  });
  supabaseMock.upsert.mockResolvedValue({ error: null });
  supabaseMock.select.mockReturnValue(selectChain({ data: [], error: null }));
  process.env.ADMIN_TOKEN = TOKEN;
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

/** The rook board the builder would send for a single-goal edit. */
function record(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    piece: "rook",
    fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
    target: "h1",
    mover: "a1",
    tier: "easy",
    order: 1,
    ...over,
  };
}

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/admin/content", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify({ kind: "exercise", record: body }),
    }),
  );
}

describe("POST /api/admin/content — Star Sweep", () => {
  it("the baseline it guards really is a sweep", () => {
    // Guards the guard: if the content is reverted these pass vacuously.
    expect(isSweep(EXERCISES.rook.find((e) => e.id === "rook-2")!)).toBe(true);
  });

  it("refuses to overwrite a sweep, and never writes the row", async () => {
    const res = await post(record("rook-2"));

    expect(res.status).toBe(400);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("says WHY, and where to edit it instead", async () => {
    // A bare 400 would send the author hunting through their own puzzle.
    const res = await post(record("rook-2"));
    const body = (await res.json()) as { errors: string[] };
    const message = body.errors.join(" ");

    expect(message).toMatch(/star sweep/i);
    expect(message).toMatch(/exercises\.json/);
    expect(message).toMatch(/import-puzzles/);
  });

  it("still allows DISABLING a sweep", async () => {
    // Retiring content is a decision the overlay IS allowed to make: it says
    // "not this one", not "this one, but broken".
    const res = await post(record("rook-2", { disabled: true }));

    expect(res.status).toBe(200);
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });

  it("leaves normal single-goal exercises writable", async () => {
    // The guard must be narrow, or it breaks the builder's whole purpose.
    expect(isSweep(EXERCISES.rook.find((e) => e.id === "rook-9")!)).toBe(false);

    const res = await post(record("rook-9", { order: 5 }));

    expect(res.status).toBe(200);
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });

  it("leaves brand-new ids writable", async () => {
    // An id with no baseline entry cannot be shadowing a sweep.
    const res = await post(record("rook-overlay-brand-new", { order: 9 }));

    expect(res.status).toBe(200);
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });
});
