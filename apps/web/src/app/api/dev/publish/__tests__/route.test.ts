import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs so writeBaselineRecord never touches the real filesystem.
const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock("node:fs", () => ({ ...fsMocks, default: fsMocks }));

import { POST } from "../route";

const SOLVABLE_EXERCISE = {
  piece: "rook",
  fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
  target: "h1",
  mover: "a1",
  tier: "easy",
  order: 1,
  id: "rook-pub",
};

// Boxed rook → unsolvable.
const UNSOLVABLE = {
  piece: "rook",
  fen: "8/8/8/8/8/1R6/RRR5/1R6 w - - 0 1",
  target: "a8",
  mover: "b2",
  order: 1,
  id: "rook-boxed",
};

function req(body: unknown): Request {
  return new Request("http://x/api/dev/publish", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fsMocks.readFileSync.mockReset();
  fsMocks.writeFileSync.mockReset();
  fsMocks.existsSync.mockReset();
  fsMocks.mkdirSync.mockReset();
  fsMocks.existsSync.mockReturnValue(false);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ADMIN_TOKEN", "secret-token");
  vi.stubEnv("OVERLAY_PUBLISH_BASE_URL", "https://preview.chesscito.com/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/dev/publish", () => {
  it("404s in production and never writes or fetches", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(req({ kind: "exercise", record: SOLVABLE_EXERCISE }));
    expect(res.status).toBe(404);
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dual-writes: baseline + overlay publish, normalizing the base URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, revalidated: true }),
    });
    const res = await POST(req({ kind: "exercise", record: SOLVABLE_EXERCISE }));
    const body = (await res.json()) as {
      ok: boolean;
      baseline: { ok: boolean; id?: string };
      overlay: { ok: boolean; revalidated?: boolean };
    };
    expect(body.baseline.ok).toBe(true);
    expect(body.baseline.id).toBe("rook-pub");
    expect(body.overlay.ok).toBe(true);
    expect(body.overlay.revalidated).toBe(true);
    expect(body.ok).toBe(true);
    // Trailing slash normalized, correct path + token header.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://preview.chesscito.com/api/admin/content");
    expect((init.headers as Record<string, string>)["x-admin-token"]).toBe("secret-token");
  });

  it("baseline succeeds but overlay is skipped when the target is not configured", async () => {
    vi.stubEnv("OVERLAY_PUBLISH_BASE_URL", "");
    const res = await POST(req({ kind: "exercise", record: SOLVABLE_EXERCISE }));
    const body = (await res.json()) as {
      ok: boolean;
      baseline: { ok: boolean };
      overlay: { ok: boolean; errors: string[] };
    };
    expect(body.baseline.ok).toBe(true);
    expect(body.overlay.ok).toBe(false);
    expect(body.overlay.errors.join(" ")).toMatch(/not configured/i);
    expect(body.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails the baseline write on an unsolvable record and never attempts overlay", async () => {
    const res = await POST(req({ kind: "labyrinth", record: UNSOLVABLE }));
    const body = (await res.json()) as {
      ok: boolean;
      baseline: { ok: boolean; errors: string[] };
      overlay: { ok: boolean };
    };
    expect(res.status).toBe(400);
    expect(body.baseline.ok).toBe(false);
    expect(body.baseline.errors.some((e) => e.includes("unsolvable"))).toBe(true);
    expect(body.overlay.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });

  it("sanitizes overlay failures (no raw upstream body / secrets leaked)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        ok: false,
        errors: ["postgresql://user:pa55w0rd@db.internal:5432 connection refused"],
      }),
    });
    const res = await POST(req({ kind: "exercise", record: SOLVABLE_EXERCISE }));
    const body = (await res.json()) as { overlay: { ok: boolean; errors: string[] } };
    expect(body.overlay.ok).toBe(false);
    const joined = body.overlay.errors.join(" ");
    expect(joined).not.toContain("pa55w0rd");
    expect(joined).not.toContain("db.internal");
    expect(joined).toMatch(/500/);
  });

  it("never echoes the admin token back to the client", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, revalidated: true }),
    });
    const res = await POST(req({ kind: "exercise", record: SOLVABLE_EXERCISE }));
    const raw = await res.text();
    expect(raw).not.toContain("secret-token");
  });
});
