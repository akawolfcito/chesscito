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

const VALID_ROOK_EXERCISE = {
  kind: "exercise",
  piece: "rook",
  fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
  target: "h1",
  mover: "a1",
  tier: "easy",
  tags: ["straight-line"],
  order: 2,
  id: "rook-ex",
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

function getRequest(search = ""): Request {
  return new Request(`http://x/api/dev/labyrinth${search}`);
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
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await POST(postRequest(JSON.stringify(VALID_ROOK)));
    expect(res.status).toBe(404);
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });

  /** The rule this route used to get wrong. A preview build runs with
   *  NODE_ENV="production", so the old gate 404'd the tooling exactly where the
   *  founder wants it alive (spec §Regla de entornos). Only VERCEL_ENV decides. */
  it("stays alive on preview, where NODE_ENV reads production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(postRequest(JSON.stringify(VALID_ROOK)));
    expect(res.status).not.toBe(404);
  });

  it("persists a valid solvable labyrinth record (writes json + generated module)", async () => {
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

  it("routes a kind:\"exercise\" record to exercises.json (not labyrinths.json)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(postRequest(JSON.stringify(VALID_ROOK_EXERCISE)));
    const json = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    const written = fsMocks.writeFileSync.mock.calls.map((c) => String(c[0]));
    expect(written.some((p) => p.endsWith("content/exercises.json"))).toBe(true);
    expect(written.some((p) => p.endsWith("content/labyrinths.json"))).toBe(false);
    expect(
      written.some((p) => p.endsWith("src/lib/game/generated/puzzles.generated.ts")),
    ).toBe(true);
  });

  it("preserves exercise-only fields (tier, tags) in the persisted exercises.json", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(postRequest(JSON.stringify(VALID_ROOK_EXERCISE)));
    expect(res.status).toBe(200);
    const exWrite = fsMocks.writeFileSync.mock.calls.find((c) =>
      String(c[0]).endsWith("content/exercises.json"),
    );
    expect(exWrite).toBeDefined();
    const payload = JSON.parse(String(exWrite?.[1])) as Array<Record<string, unknown>>;
    const saved = payload.find((r) => r.id === "rook-ex");
    expect(saved?.tier).toBe("easy");
    expect(saved?.tags).toEqual(["straight-line"]);
  });

  it("flows a builder-authored explanation into the generated description map", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const withExplanation = {
      ...VALID_ROOK_EXERCISE,
      explanation: "Glide your Rook straight to h1.",
    };
    const res = await POST(postRequest(JSON.stringify(withExplanation)));
    expect(res.status).toBe(200);
    // The 2nd write is the regenerated module; its GENERATED_EXERCISE_
    // DESCRIPTIONS map must carry the authored copy keyed by the id, so the
    // in-game drawer resolves it WITHOUT an i18n missing-message fallback.
    const genWrite = fsMocks.writeFileSync.mock.calls.find((c) =>
      String(c[0]).endsWith("src/lib/game/generated/puzzles.generated.ts"),
    );
    expect(genWrite).toBeDefined();
    expect(String(genWrite?.[1])).toContain("Glide your Rook straight to h1.");
  });

  it("merges an exercise edit into existing exercises.json, preserving unknown fields", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // exercises.json exists with one record that carries extra fields.
    const existing = [
      { ...VALID_ROOK_EXERCISE, tier: "medium", tags: ["old"], extra: "keep-me" },
    ];
    fsMocks.existsSync.mockImplementation((p: string) =>
      String(p).endsWith("content/exercises.json"),
    );
    fsMocks.readFileSync.mockImplementation((p: string) =>
      String(p).endsWith("content/exercises.json") ? JSON.stringify(existing) : "",
    );
    // Re-save the same id with a new target.
    const edit = { ...VALID_ROOK_EXERCISE, target: "a8" };
    const res = await POST(postRequest(JSON.stringify(edit)));
    expect(res.status).toBe(200);
    const exWrite = fsMocks.writeFileSync.mock.calls.find((c) =>
      String(c[0]).endsWith("content/exercises.json"),
    );
    const payload = JSON.parse(String(exWrite?.[1])) as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0].target).toBe("a8");
  });

  it("persists a soft-disabled record but excludes it from the generated catalog", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const disabled = { ...VALID_ROOK_EXERCISE, disabled: true };
    const res = await POST(postRequest(JSON.stringify(disabled)));
    expect(res.status).toBe(200);
    // The record is still written to exercises.json (so it can be re-enabled)…
    const exWrite = fsMocks.writeFileSync.mock.calls.find((c) =>
      String(c[0]).endsWith("content/exercises.json"),
    );
    const payload = JSON.parse(String(exWrite?.[1])) as Array<Record<string, unknown>>;
    expect(payload.find((r) => r.id === "rook-ex")?.disabled).toBe(true);
    // …but the regenerated catalog module does NOT carry its id.
    const genWrite = fsMocks.writeFileSync.mock.calls.find((c) =>
      String(c[0]).endsWith("src/lib/game/generated/puzzles.generated.ts"),
    );
    expect(String(genWrite?.[1])).not.toContain("rook-ex");
  });

  it("auto-assigns a stable generated id when the record has none", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { id: _omit, ...noId } = VALID_ROOK;
    const res = await POST(postRequest(JSON.stringify(noId)));
    const json = (await res.json()) as { ok: boolean; saved: { id?: string } };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    // The assigned id uses the build's content-addressed scheme.
    expect(json.saved.id).toMatch(/^rook-gen-/);
    // The persisted labyrinths.json payload carries the same id (no "(no id)").
    const jsonWrite = fsMocks.writeFileSync.mock.calls.find((c) =>
      String(c[0]).endsWith("content/labyrinths.json"),
    );
    expect(jsonWrite).toBeDefined();
    expect(String(jsonWrite?.[1])).toContain(json.saved.id);
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
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await GET(getRequest());
    expect(res.status).toBe(404);
    expect(fsMocks.readFileSync).not.toHaveBeenCalled();
  });

  /** Same rule as POST: preview reads NODE_ENV="production" and must stay alive. */
  it("stays alive on preview, where NODE_ENV reads production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(getRequest());
    expect(res.status).not.toBe(404);
  });

  it("returns records from both labyrinths.json and exercises.json", async () => {
    vi.stubEnv("NODE_ENV", "development");
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) =>
      String(p).endsWith("content/exercises.json")
        ? JSON.stringify([VALID_ROOK_EXERCISE])
        : JSON.stringify([VALID_ROOK]),
    );
    const res = await GET(getRequest());
    const json = (await res.json()) as {
      ok: boolean;
      records: Array<{ id: string; kind: string }>;
    };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.records).toHaveLength(2);
    const lab = json.records.find((r) => r.id === "rook-x");
    const ex = json.records.find((r) => r.id === "rook-ex");
    expect(lab?.kind).toBe("labyrinth");
    expect(ex?.kind).toBe("exercise");
  });

  it("filters by ?kind=exercise", async () => {
    vi.stubEnv("NODE_ENV", "development");
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) =>
      String(p).endsWith("content/exercises.json")
        ? JSON.stringify([VALID_ROOK_EXERCISE])
        : JSON.stringify([VALID_ROOK]),
    );
    const res = await GET(getRequest("?kind=exercise"));
    const json = (await res.json()) as {
      ok: boolean;
      records: Array<{ id: string; kind: string }>;
    };
    expect(res.status).toBe(200);
    expect(json.records).toHaveLength(1);
    expect(json.records[0].id).toBe("rook-ex");
    expect(json.records[0].kind).toBe("exercise");
  });

  it("filters by ?kind=labyrinth", async () => {
    vi.stubEnv("NODE_ENV", "development");
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockImplementation((p: string) =>
      String(p).endsWith("content/exercises.json")
        ? JSON.stringify([VALID_ROOK_EXERCISE])
        : JSON.stringify([VALID_ROOK]),
    );
    const res = await GET(getRequest("?kind=labyrinth"));
    const json = (await res.json()) as {
      ok: boolean;
      records: Array<{ id: string; kind: string }>;
    };
    expect(res.status).toBe(200);
    expect(json.records).toHaveLength(1);
    expect(json.records[0].id).toBe("rook-x");
    expect(json.records[0].kind).toBe("labyrinth");
  });

  it("returns an empty array when both files are missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    fsMocks.existsSync.mockReturnValue(false);
    const res = await GET(getRequest());
    const json = (await res.json()) as { ok: boolean; records: unknown[] };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.records).toEqual([]);
    expect(fsMocks.readFileSync).not.toHaveBeenCalled();
  });
});
