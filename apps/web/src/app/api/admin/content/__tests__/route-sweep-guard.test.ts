/**
 * The builder can author a Star Sweep — and cannot DEGRADE one by accident.
 *
 * THE RULE THAT CHANGED (sweeps-in-the-builder, 2026-08-11)
 * --------------------------------------------------------
 * `content_overlay` used to have no `targets` column, so no row it could hold
 * was a valid override of a multi-goal board: the route refused every write over
 * a sweep and sent the author to content/exercises.json — that is, to me. The
 * table now has the column, so the refusal narrows to what is still true:
 *
 *   a row WITHOUT targets may not overwrite a baseline WITH targets.
 *
 * Not a formality. Saving one anyway stored a single target with
 * `optimal_moves` measured to that one square, and the screen treats
 * `optimalMoves === 1` as "any non-target move is an instant loss" — so the
 * level shipped unplayable AND failed the player for trying, while every unit
 * test stayed green because they all read the baseline.
 *
 * And the refusal must stay HERE, not only in the read path: refusing only there
 * makes the save a silent no-op — the builder reports success, the row lands,
 * the edit never appears, and the author debugs their own content against a
 * system that ignored them without saying so. Guard the grantor.
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

/** The same board as a two-star sweep: a1 -> a8 -> h1 is 3, the leg to a8 is 1. */
function sweepRecord(id: string, over: Record<string, unknown> = {}) {
  return record(id, { target: "a8", targets: ["a8", "h1"], ...over });
}

function post(body: Record<string, unknown>, kind: "exercise" | "labyrinth" = "exercise") {
  return POST(
    new Request("http://localhost/api/admin/content", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify({ kind, record: body }),
    }),
  );
}

const savedRow = () =>
  supabaseMock.upsert.mock.calls[0][0] as Record<string, unknown>;

const errorsOf = async (res: Response) =>
  ((await res.json()) as { errors: string[] }).errors.join(" ");

describe("POST /api/admin/content — authoring a sweep", () => {
  it("the baseline it guards really is a sweep", () => {
    // Guards the guard: if the content is reverted these pass vacuously.
    expect(isSweep(EXERCISES.rook.find((e) => e.id === "rook-2")!)).toBe(true);
  });

  it("accepts a multi-goal row and stores its targets", async () => {
    const res = await post(sweepRecord("rook-overlay-sweep", { order: 9 }));

    expect(res.status).toBe(200);
    expect(savedRow().targets).toEqual(["a8", "h1"]);
  });

  it("stores the ORDER optimum, never the leg to the first star", async () => {
    // The single-target BFS answers a different question (a1 -> a8 is 1 move).
    // Storing that would make a perfect run trivially reachable and the whole
    // difficulty experiment would measure a lie.
    await post(sweepRecord("rook-overlay-sweep", { order: 9 }));

    expect(savedRow().optimal_moves).toBe(3);
  });

  it("computes the optimum even when the client sends one", async () => {
    // `optimalMoves` is network input and is NEVER trusted: the server measures.
    await post(sweepRecord("rook-overlay-sweep", { order: 9, optimalMoves: 99 }));

    expect(savedRow().optimal_moves).toBe(3);
  });

  it("persists the per-board star floor", async () => {
    await post(sweepRecord("rook-overlay-sweep", { order: 9, starFloor: 2 }));

    expect(savedRow().star_floor).toBe(2);
  });

  it("writes NULL targets for a plain single-goal exercise", async () => {
    // Not `[]` and not the one target repeated: a one-goal board is what every
    // row written before today is, and it must keep meaning exactly that.
    await post(record("rook-9", { order: 5 }));

    expect(savedRow().targets).toBeNull();
    expect(savedRow().star_floor).toBeNull();
  });

  it("lets a multi-goal row edit an existing sweep", async () => {
    // The whole point of the migration: the founder edits rook-2 in the builder.
    const res = await post(sweepRecord("rook-2"));

    expect(res.status).toBe(200);
    expect(savedRow().targets).toEqual(["a8", "h1"]);
  });
});

describe("POST /api/admin/content — a row may not degrade a sweep", () => {
  it("refuses a single-goal row over a sweep, and never writes it", async () => {
    const res = await post(record("rook-2"));

    expect(res.status).toBe(400);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("says WHY, and what to send instead", async () => {
    // A bare 400 would send the author hunting through their own puzzle.
    const message = await errorsOf(await post(record("rook-2")));

    expect(message).toMatch(/star sweep/i);
    expect(message).toMatch(/targets/);
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

describe("POST /api/admin/content — the validator's rules reach the author", () => {
  it("refuses a sweep in the LABYRINTH bucket, with the runtime's reason", async () => {
    // The labyrinth runtime ends the level on the first star and then grades
    // that half-run against the full sweep optimum: 3 stars for half a board.
    const res = await post(sweepRecord("lab-sweep-new", { order: 9 }), "labyrinth");

    expect(res.status).toBe(400);
    expect(await errorsOf(res)).toMatch(/labyrinth/i);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("refuses a sweep that COLLAPSED into a one-goal board", async () => {
    // targets[0]=h8 costs 2 from a1, and so does collecting both: the extra star
    // is free, so the board is a one-goal level wearing two.
    const res = await post(
      record("rook-overlay-collapsed", {
        order: 9,
        target: "h8",
        targets: ["h8", "a8"],
      }),
    );

    expect(res.status).toBe(400);
    expect(await errorsOf(res)).toMatch(/collapse/i);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it("reports a pawn sweep as a 400, never as a 500", async () => {
    // `computeSweepOptimal` throws for the pawn. A throw here would be a 500,
    // and a 500 body is Supabase's own message — the reason never arrives.
    const res = await post(
      record("pawn-overlay-sweep", {
        order: 9,
        piece: "pawn",
        fen: "8/8/8/8/8/8/P7/8 w - - 0 1",
        mover: "a2",
        target: "a4",
        targets: ["a4", "a6"],
      }),
    );

    expect(res.status).toBe(400);
    expect(await errorsOf(res)).toMatch(/pawn/i);
  });
});
