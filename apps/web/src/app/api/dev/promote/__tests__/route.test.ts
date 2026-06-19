/**
 * POST /api/dev/promote — dev-only proxy that adds ADMIN_TOKEN server-side and
 * forwards a stage move to /api/admin/content/stage (so the builder can promote
 * without the token ever reaching the browser). Same shape as /api/dev/publish.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

const ORIGINAL = { ...process.env };

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("NODE_ENV", "test");
  process.env.ADMIN_TOKEN = "tkn";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL };
});

function body(b: unknown) {
  return new Request("http://localhost/api/dev/promote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b),
  });
}

const VALID = { kind: "exercise", id: "rook-1", from: "draft", to: "published" };

describe("POST /api/dev/promote", () => {
  it("404 in production (never proxies)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await POST(body(VALID));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400 on missing id or target stage", async () => {
    const res = await POST(body({ kind: "exercise", id: "rook-1" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards without `from` (auto-detect) when only `to` is given", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, from: "draft", to: "published" }),
    });
    const res = await POST(body({ kind: "exercise", id: "rook-1", to: "published" }));
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ kind: "exercise", id: "rook-1", to: "published" });
    expect(sent.from).toBeUndefined();
  });

  it("reports not-configured when ADMIN_TOKEN is unset", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await POST(body(VALID));
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.errors.join(" ")).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards to /api/admin/content/stage on same origin with token + body, fans out revalidation", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, from: "draft", to: "published" }),
    });
    const res = await POST(body(VALID));
    const data = await res.json();
    expect(data).toMatchObject({ ok: true, from: "draft", to: "published" });
    // First call = stage move on same origin (localhost)
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost/api/admin/content/stage");
    expect(opts.headers["x-admin-token"]).toBe("tkn");
    expect(JSON.parse(opts.body)).toMatchObject(VALID);
    // Remaining calls = revalidation fan-out to 4 remote envs
    const revalidateCalls = fetchMock.mock.calls.slice(1).map((c: unknown[]) => c[0]);
    expect(revalidateCalls).toEqual(expect.arrayContaining([
      "https://www.chesscito.com/api/admin/content/revalidate",
      "https://lite.chesscito.com/api/admin/content/revalidate",
      "https://preview.chesscito.com/api/admin/content/revalidate",
      "https://lite-preview.chesscito.com/api/admin/content/revalidate",
    ]));
  });

  it("sanitizes an upstream 404 (absent from-version) without echoing the raw body", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ ok: false, errors: ["raw db detail leak"] }),
    });
    const res = await POST(body(VALID));
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.errors.join(" ")).toMatch(/404/);
    expect(data.errors.join(" ")).not.toMatch(/raw db detail/);
  });

  it("handles a network error without surfacing the raw error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED secret-host"));
    const res = await POST(body(VALID));
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.errors.join(" ")).not.toMatch(/secret-host/);
  });
});
