/**
 * A local save must invalidate the catalog cache too.
 *
 * FOUND BY AUTHORING (2026-08-12). The founder converted the four rook mazes to
 * Star Sweeps; the JSON and the generated module both had the new targets and
 * the recomputed optima — and the game kept serving the OLD catalog, with one
 * star and the previous "8 moves". Nothing was broken and nothing said so.
 *
 * The catalog is served through `unstable_cache` tagged "content", and the only
 * thing that ever revalidated that tag was the OVERLAY write route. Locally the
 * overlay is deliberately off (no ADMIN_TOKEN), so that step fails by design —
 * and with it went the invalidation that had nothing to do with the overlay.
 *
 * The baseline write is a content change on its own. It gets its own
 * revalidation, or the builder keeps writing correct content that the game
 * refuses to show.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock("node:fs", () => ({ ...fsMocks, default: fsMocks }));

const cacheMocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => cacheMocks);

import { POST } from "../route";

const SOLVABLE = {
  piece: "rook",
  fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
  target: "h1",
  mover: "a1",
  tier: "easy",
  order: 1,
  id: "rook-pub",
};

/** Boxed rook → the baseline write fails, so nothing changed on disk. */
const UNSOLVABLE = {
  piece: "rook",
  fen: "8/8/8/8/8/1R6/RRR5/1R6 w - - 0 1",
  target: "a8",
  mover: "b2",
  order: 1,
  id: "rook-boxed",
};

const req = (body: unknown) =>
  new Request("http://x/api/dev/publish", {
    method: "POST",
    body: JSON.stringify(body),
  });

const fetchMock = vi.fn();

beforeEach(() => {
  for (const m of Object.values(fsMocks)) m.mockReset();
  fsMocks.existsSync.mockReturnValue(false);
  cacheMocks.revalidateTag.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/dev/publish — the baseline write invalidates the catalog", () => {
  it("revalidates even when the overlay step is off (the local setup)", async () => {
    // No ADMIN_TOKEN → publishToOverlay bails before any fetch. This is exactly
    // how the founder authors locally, and the case that was silently broken.
    const res = await POST(req({ bucket: "labyrinth", record: SOLVABLE }));
    const body = (await res.json()) as { baseline: { ok: boolean } };

    expect(body.baseline.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith("content");
  });

  it("revalidates when the overlay step fails outright", async () => {
    vi.stubEnv("ADMIN_TOKEN", "secret-token");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    });

    await POST(req({ bucket: "exercise", record: SOLVABLE }));

    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith("content");
  });

  it("does NOT revalidate when nothing was written", async () => {
    // An unsolvable record never reaches disk, so the cached catalog is still
    // the truth. Dropping it would be a pointless rebuild on every typo.
    const res = await POST(req({ bucket: "exercise", record: UNSOLVABLE }));

    expect(res.status).toBe(400);
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("survives a revalidation that throws", async () => {
    // Outside a request scope Next throws here. The content is already on disk;
    // losing the invalidation must not turn a good save into a 500.
    cacheMocks.revalidateTag.mockImplementation(() => {
      throw new Error("static generation store missing");
    });

    const res = await POST(req({ bucket: "labyrinth", record: SOLVABLE }));
    const body = (await res.json()) as { baseline: { ok: boolean } };

    expect(res.status).toBe(200);
    expect(body.baseline.ok).toBe(true);
  });
});
