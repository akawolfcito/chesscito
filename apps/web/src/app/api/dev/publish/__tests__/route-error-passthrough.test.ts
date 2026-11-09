/**
 * The overlay's own error text must reach the builder.
 *
 * This seam used to map the HTTP status to a fixed string and throw the body
 * away, so every 400 read "overlay publish rejected: record rejected by
 * validation (400)" — true, and useless. The Star Sweep refusal names the level,
 * says why the table cannot hold it, and points at `content/exercises.json` +
 * `pnpm import-puzzles`; none of that survived, so the person who most needed
 * the instructions was the one who could not see them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock("node:fs", () => ({ ...fsMocks, default: fsMocks }));

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

const req = (body: unknown) =>
  new Request("http://x/api/dev/publish", {
    method: "POST",
    body: JSON.stringify(body),
  });

const fetchMock = vi.fn();

beforeEach(() => {
  for (const m of Object.values(fsMocks)) m.mockReset();
  fsMocks.existsSync.mockReturnValue(false);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ADMIN_TOKEN", "secret-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** What `/api/admin/content` answers when it refuses a Star Sweep. */
const SWEEP_REFUSAL =
  '"rook-2" is a Star Sweep (3 goals, optimal 3) and this table cannot store ' +
  "one: it has no columns for multiple targets. Edit it in " +
  "content/exercises.json and run `pnpm import-puzzles`.";

describe("overlay errors reach the caller", () => {
  it("forwards the route's own message instead of a status blurb", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, errors: [SWEEP_REFUSAL] }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await POST(req({ bucket: "exercise", record: SOLVABLE }));
    const body = (await res.json()) as { overlay?: { errors?: string[] } };
    const text = (body.overlay?.errors ?? []).join(" ");

    expect(text).toContain("Star Sweep");
    expect(text).toContain("content/exercises.json");
    expect(text).toContain("import-puzzles");
    // The generic blurb must NOT be what the builder shows here.
    expect(text).not.toMatch(/record rejected by validation/);
  });

  it("falls back to the status blurb when the body carries no message", async () => {
    // A body-less failure still has to say something.
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));

    const res = await POST(req({ bucket: "exercise", record: SOLVABLE }));
    const body = (await res.json()) as { overlay?: { errors?: string[] } };

    expect((body.overlay?.errors ?? []).join(" ")).toMatch(/500/);
  });

  it("NEVER forwards a 500 body — it can carry Supabase internals", async () => {
    // The admin route answers 500 with `[error.message]` straight from the
    // driver, which may hold a connection string or a host. Only 400 bodies are
    // validation text we authored and therefore safe to relay.
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          errors: ["connect to db.internal failed: password=pa55w0rd"],
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );

    const res = await POST(req({ bucket: "exercise", record: SOLVABLE }));
    const body = (await res.json()) as { overlay?: { errors?: string[] } };
    const text = (body.overlay?.errors ?? []).join(" ");

    expect(text).not.toContain("pa55w0rd");
    expect(text).not.toContain("db.internal");
    expect(text).toMatch(/500/);
  });

  it("still reports success when the overlay accepts", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, revalidated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await POST(req({ bucket: "exercise", record: SOLVABLE }));
    const body = (await res.json()) as { overlay?: { ok?: boolean } };

    expect(body.overlay?.ok).toBe(true);
  });
});
