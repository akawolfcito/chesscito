/**
 * The invalidation endpoint.
 *
 * ⚠️ It exists because a DEPLOY DOES NOT PURGE Next's Data Cache — a broken
 * census once survived 18 h 34 min *and* a full deploy. So this is the only
 * lever there is, and it has to be both usable and shut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  unstable_cache: (fn: unknown) => fn,
}));

import { GET, POST } from "../route";

const TOKEN = "phase-e-test-token-not-a-real-secret";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/revalidate-stats", {
    method: "POST",
    headers,
  });
}

const saved = process.env.STATS_REVALIDATE_TOKEN;

beforeEach(() => {
  revalidateTag.mockClear();
  process.env.STATS_REVALIDATE_TOKEN = TOKEN;
});

afterEach(() => {
  if (saved === undefined) delete process.env.STATS_REVALIDATE_TOKEN;
  else process.env.STATS_REVALIDATE_TOKEN = saved;
});

describe("rejects", () => {
  it("401 with no token at all", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401 with the wrong token", async () => {
    const res = await POST(req({ "x-stats-revalidate-token": "nope" }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401 with a token of the right LENGTH but wrong bytes", async () => {
    const wrong = "x".repeat(TOKEN.length);
    const res = await POST(req({ "x-stats-revalidate-token": wrong }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401 for an empty header", async () => {
    const res = await POST(req({ "x-stats-revalidate-token": "" }));
    expect(res.status).toBe(401);
  });

  it("405 for GET — a prefetch must not be able to flush the cache", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("fails CLOSED when unconfigured", () => {
  it("401 with the variable absent, even for the right-looking value", async () => {
    delete process.env.STATS_REVALIDATE_TOKEN;
    const res = await POST(req({ "x-stats-revalidate-token": TOKEN }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401 with the variable set to an empty string", async () => {
    process.env.STATS_REVALIDATE_TOKEN = "";
    const res = await POST(req({ "x-stats-revalidate-token": "" }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401 with the variable set to whitespace", async () => {
    // An unconfigured secret must not become an open door.
    process.env.STATS_REVALIDATE_TOKEN = "   ";
    const res = await POST(req({ "x-stats-revalidate-token": "   " }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("accepts", () => {
  it("invalidates public-stats with the right token", async () => {
    const res = await POST(req({ "x-stats-revalidate-token": TOKEN }));
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith("public-stats");
  });

  it("also accepts a Bearer authorization header", async () => {
    const res = await POST(req({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("public-stats");
  });

  it("never invalidates the content tag", async () => {
    await POST(req({ "x-stats-revalidate-token": TOKEN }));
    expect(revalidateTag).not.toHaveBeenCalledWith("content");
  });
});

describe("leaks nothing", () => {
  it("no response body ever contains the token", async () => {
    const cases: Array<Record<string, string>> = [
      {},
      { "x-stats-revalidate-token": "wrong" },
      { "x-stats-revalidate-token": TOKEN },
    ];
    for (const headers of cases) {
      const res = await POST(req(headers));
      const body = await res.text();
      expect(body).not.toContain(TOKEN);
      expect(body).not.toContain("STATS_REVALIDATE_TOKEN");
    }
  });

  it("a rejection carries no body at all — no reason, no config hint", async () => {
    // "no token" and "wrong token" must be indistinguishable, and neither may
    // reveal whether the endpoint is configured.
    const noToken = await POST(req());
    const badToken = await POST(req({ "x-stats-revalidate-token": "nope" }));
    delete process.env.STATS_REVALIDATE_TOKEN;
    const unconfigured = await POST(req({ "x-stats-revalidate-token": "nope" }));

    for (const res of [noToken, badToken, unconfigured]) {
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("");
    }
  });

  it("the source uses no NEXT_PUBLIC_ name and logs nothing", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/app/api/revalidate-stats/route.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    expect(src).not.toContain("NEXT_PUBLIC_");
    expect(src).not.toMatch(/\bconsole\s*\./);
  });
});
