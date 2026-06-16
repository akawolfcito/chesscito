import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs so the route never touches the real filesystem and we can
// assert exactly when (and whether) it writes.
const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:fs", () => ({ ...fsMocks, default: fsMocks }));

import { GET, POST } from "../route";

const VALID_ROOK = {
  piece: "rook",
  fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
  target: "h8",
  mover: "a1",
  order: 1,
  id: "rook-x",
};

// A boxed rook with no path from b2 to a8 — verified unsolvable by the
// existing buildCatalog suite (scripts/__tests__/import-puzzles.test.ts).
const UNSOLVABLE_ROOK = {
  piece: "rook",
  fen: "8/8/8/8/8/1R6/RRR5/1R6 w - - 0 1",
  target: "a8",
  mover: "b2",
  order: 1,
  id: "rook-boxed",
};

function postRequest(body: string): Request {
  return new Request("http://x/api/dev/labyrinth", { method: "POST", body });
}

describe("POST /api/dev/labyrinth", () => {
  beforeEach(() => {
    fsMocks.readFileSync.mockReset();
    fsMocks.writeFileSync.mockReset();
    fsMocks.existsSync.mockReset();
    fsMocks.mkdirSync.mockReset();
    // Default: start from an empty catalog (no on-disk files).
    fsMocks.existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 in production and never writes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(postRequest(JSON.stringify(VALID_ROOK)));
    expect(res.status).toBe(404);
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });

  it("persists a valid solvable record (writes json + generated module)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(postRequest(JSON.stringify(VALID_ROOK)));
    const json = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    // Two writes: labyrinths.json and the generated module.
    expect(fsMocks.writeFileSync).toHaveBeenCalledTimes(2);
    const written = fsMocks.writeFileSync.mock.calls.map((c) => String(c[0]));
    expect(written.some((p) => p.endsWith("content/labyrinths.json"))).toBe(true);
    expect(
      written.some((p) => p.endsWith("src/lib/game/generated/puzzles.generated.ts")),
    ).toBe(true);
  });

  it("rejects an unsolvable record with 400 and never writes", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(postRequest(JSON.stringify(UNSOLVABLE_ROOK)));
    const json = (await res.json()) as { ok: boolean; errors: string[] };
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.errors.some((e) => e.includes("unsolvable"))).toBe(true);
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(postRequest("{not json"));
    expect(res.status).toBe(400);
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });
});

describe("GET /api/dev/labyrinth", () => {
  beforeEach(() => {
    fsMocks.readFileSync.mockReset();
    fsMocks.writeFileSync.mockReset();
    fsMocks.existsSync.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 in production and never reads", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET();
    expect(res.status).toBe(404);
    expect(fsMocks.readFileSync).not.toHaveBeenCalled();
  });

  it("returns the existing records when the file exists", async () => {
    vi.stubEnv("NODE_ENV", "development");
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(JSON.stringify([VALID_ROOK]));
    const res = await GET();
    const json = (await res.json()) as { ok: boolean; records: unknown[] };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.records).toEqual([VALID_ROOK]);
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });

  it("returns an empty array when the file is missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    fsMocks.existsSync.mockReturnValue(false);
    const res = await GET();
    const json = (await res.json()) as { ok: boolean; records: unknown[] };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.records).toEqual([]);
    expect(fsMocks.readFileSync).not.toHaveBeenCalled();
  });
});
