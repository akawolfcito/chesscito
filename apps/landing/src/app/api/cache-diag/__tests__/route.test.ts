/**
 * The temporary production cache diagnostic.
 *
 * It is doubly shut — absent unless `STATS_DEBUG === "1"`, and token-gated even
 * then — because it ships to production for the length of one incident and a
 * diagnostic endpoint is still an endpoint.
 *
 * ⚠️ The body contract is an ALLOW-LIST, asserted key by key. A diagnostic that
 * grows a "just for debugging" field is exactly how a `session_id` reaches a
 * public URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TOKEN = "diag-test-token-not-a-real-secret";
const saved = {
  debug: process.env.STATS_DEBUG,
  token: process.env.STATS_REVALIDATE_TOKEN,
};

/** The route reads STATS_DEBUG at module load, so each case needs a fresh
 *  module registry — otherwise every test after the first sees the first
 *  value and the 404 cases pass for the wrong reason. */
async function loadRoute() {
  vi.resetModules();
  return import("../route");
}

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cache-diag", { headers });
}

beforeEach(() => {
  process.env.STATS_DEBUG = "1";
  process.env.STATS_REVALIDATE_TOKEN = TOKEN;
});

afterEach(() => {
  if (saved.debug === undefined) delete process.env.STATS_DEBUG;
  else process.env.STATS_DEBUG = saved.debug;
  if (saved.token === undefined) delete process.env.STATS_REVALIDATE_TOKEN;
  else process.env.STATS_REVALIDATE_TOKEN = saved.token;
});

describe("does not exist unless enabled", () => {
  it("404 with STATS_DEBUG absent", async () => {
    delete process.env.STATS_DEBUG;
    const { GET } = await loadRoute();
    const res = await GET(req({ "x-stats-revalidate-token": TOKEN }));
    expect(res.status).toBe(404);
  });

  it("404 with STATS_DEBUG set to something other than 1", async () => {
    // "true", "yes" and "0" are all NOT enabled. One spelling, on purpose.
    for (const value of ["0", "true", "yes", ""]) {
      process.env.STATS_DEBUG = value;
      const { GET } = await loadRoute();
      const res = await GET(req({ "x-stats-revalidate-token": TOKEN }));
      expect(res.status, `STATS_DEBUG=${JSON.stringify(value)}`).toBe(404);
    }
  });

  it("404 beats 401 — an absent route reveals less than a refused one", async () => {
    delete process.env.STATS_DEBUG;
    const { GET } = await loadRoute();
    expect((await GET(req())).status).toBe(404);
  });
});

describe("token gate", () => {
  it("401 with no token", async () => {
    const { GET } = await loadRoute();
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  });

  it("401 with the wrong token", async () => {
    const { GET } = await loadRoute();
    expect((await GET(req({ "x-stats-revalidate-token": "nope" }))).status).toBe(401);
  });

  it("401 with a token of the right length but wrong bytes", async () => {
    const { GET } = await loadRoute();
    const wrong = "x".repeat(TOKEN.length);
    expect((await GET(req({ "x-stats-revalidate-token": wrong }))).status).toBe(401);
  });

  it("401 when the shared secret itself is unconfigured", async () => {
    delete process.env.STATS_REVALIDATE_TOKEN;
    const { GET } = await loadRoute();
    expect((await GET(req({ "x-stats-revalidate-token": TOKEN }))).status).toBe(401);
  });

  it("POST is 405 — the diagnostic is a read, not a control surface", async () => {
    const { POST } = await loadRoute();
    expect((await POST()).status).toBe(405);
  });
});

describe("the response", () => {
  it("200 with debug on and the right token", async () => {
    const { GET } = await loadRoute();
    const res = await GET(req({ "x-stats-revalidate-token": TOKEN }));
    expect(res.status).toBe(200);
  });

  it("is never cached", async () => {
    const { GET } = await loadRoute();
    const res = await GET(req({ "x-stats-revalidate-token": TOKEN }));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("carries EXACTLY the allowed keys — no more", async () => {
    const { GET } = await loadRoute();
    const body = await (await GET(req({ "x-stats-revalidate-token": TOKEN }))).json();
    expect(Object.keys(body).sort()).toEqual([
      "censusReads",
      "commit",
      "instanceId",
      "lastGeneratedAt",
      "onchainReads",
      "renders",
      "rpcCalls",
      "snapshotReads",
    ]);
  });

  it("the counters are integers and the ids are opaque", async () => {
    const { GET } = await loadRoute();
    const body = await (await GET(req({ "x-stats-revalidate-token": TOKEN }))).json();
    for (const k of ["renders", "snapshotReads", "rpcCalls", "onchainReads", "censusReads"]) {
      expect(Number.isInteger(body[k]), k).toBe(true);
    }
    expect(typeof body.instanceId).toBe("string");
    expect(body.instanceId.length).toBeGreaterThan(3);
  });

  it("leaks nothing sensitive", async () => {
    const { GET } = await loadRoute();
    const raw = await (await GET(req({ "x-stats-revalidate-token": TOKEN }))).text();
    expect(raw).not.toContain(TOKEN);
    for (const forbidden of [
      "supabase.co",
      "SERVICE_ROLE",
      "STATS_REVALIDATE_TOKEN",
      "session_id",
      "account_ref",
      "wallet",
      "0x",
    ]) {
      expect(raw, forbidden).not.toContain(forbidden);
    }
  });
});

describe("counters move only on REAL work", () => {
  it("bump is inert while STATS_DEBUG is off", async () => {
    delete process.env.STATS_DEBUG;
    vi.resetModules();
    const { bump, readCounters } = await import("@/lib/stats/instrument");
    const before = readCounters().snapshotReads;
    bump("snapshotReads");
    bump("rpcCalls");
    expect(readCounters().snapshotReads).toBe(before);
  });

  it("a cache HIT moves none of the four work counters", async () => {
    process.env.STATS_DEBUG = "1";
    vi.resetModules();
    const { readCounters } = await import("@/lib/stats/instrument");
    const { createSnapshotLoader } = await import("@/lib/stats/snapshot");

    // A memoizer that really stores, so the second call must NOT run the read.
    const store = new Map<string, unknown>();
    const factory = ((read: () => Promise<unknown>, keyParts: string[]) => {
      const key = keyParts.join("::");
      return async () => {
        if (store.has(key)) return store.get(key);
        const v = await read();
        store.set(key, v);
        return v;
      };
    }) as never;

    const load = createSnapshotLoader(factory, { surface: "all", container: "all" }, async () => {
      const { bump } = await import("@/lib/stats/instrument");
      bump("snapshotReads");
      bump("rpcCalls");
      return {} as never;
    });

    await load();
    const afterMiss = readCounters();
    await load();
    const afterHit = readCounters();

    expect(afterMiss.snapshotReads).toBe(1);
    expect(afterHit.snapshotReads).toBe(1); // ⬅ the whole point
    expect(afterHit.rpcCalls).toBe(afterMiss.rpcCalls);
    expect(afterHit.onchainReads).toBe(afterMiss.onchainReads);
    expect(afterHit.censusReads).toBe(afterMiss.censusReads);
  });

  it("instanceId is minted once per module instance", async () => {
    vi.resetModules();
    const mod = await import("@/lib/stats/instrument");
    expect(mod.readCounters().instanceId).toBe(mod.readCounters().instanceId);
    expect(mod.readCounters().instanceId).toBe(mod.INSTANCE_ID);
  });

  it("lastGeneratedAt comes from the snapshot, never from Date.now()", async () => {
    process.env.STATS_DEBUG = "1";
    vi.resetModules();
    const { noteGeneratedAt, readCounters } = await import("@/lib/stats/instrument");
    noteGeneratedAt("2026-01-01T00:00:00.000Z");
    // A stamp from the past could not come from a clock read at diagnostic time.
    expect(readCounters().lastGeneratedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
