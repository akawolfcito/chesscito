/**
 * Upstash collector.
 *
 * The property this file exists to defend: the collector must NOT derive a
 * quota percentage from `INFO`. Two `INFO` calls seconds apart returned
 * 67.615 and 295.319 commands, and 16 KB then 32 KB of memory, because Upstash
 * routes across nodes and those counters are per node. A monitor that reports
 * such a number is worse than one that reports a gap.
 */

import { describe, expect, it, vi } from "vitest";

import {
  UPSTASH_MONTHLY_COMMAND_QUOTA,
  collectUpstash,
  sanitizeUpstashError,
} from "../collectors/upstash";

const REST_URL = "https://fake-db-12345.upstash.io";
const REST_TOKEN = "AX1sASQgN2Y3-secret-token";
const EMAIL = "ops@example.com";
const API_KEY = "mgmt-api-key-secret";

const FULL = { restUrl: REST_URL, restToken: REST_TOKEN, email: EMAIL, apiKey: API_KEY };
const DATA_ONLY = { restUrl: REST_URL, restToken: REST_TOKEN };

/** Answers PING/DBSIZE on the REST URL and the database list on the mgmt API. */
function fakeFetch(opts: {
  dbsize?: number;
  restStatus?: number;
  mgmtStatus?: number;
  mgmtBody?: unknown;
  throwOn?: "rest" | "mgmt";
} = {}) {
  return vi.fn(async (input: unknown) => {
    const url = String(input);
    const isMgmt = url.includes("api.upstash.com");

    if (opts.throwOn === "mgmt" && isMgmt) throw new Error(`connect ${url} failed`);
    if (opts.throwOn === "rest" && !isMgmt) throw new Error(`connect ${url} failed`);

    if (isMgmt) {
      const status = opts.mgmtStatus ?? 200;
      const body = opts.mgmtBody ?? [{ daily_requests: 125_000, monthly_bandwidth: 2_048 }];
      return new Response(JSON.stringify(body), { status });
    }

    const status = opts.restStatus ?? 200;
    // PING returns "PONG"; DBSIZE returns a number. One handler serves both.
    const body = { result: opts.dbsize ?? 5_799 };
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe("data plane", () => {
  it("reports DBSIZE and a locally measured ping", async () => {
    let tick = 0;
    const r = await collectUpstash(DATA_ONLY, {
      fetchImpl: fakeFetch({ dbsize: 5_799 }),
      now: () => (tick += 41),
    });

    expect(r.data_plane.status).toBe("observable");
    if (r.data_plane.status !== "observable") return;
    expect(r.data_plane.keys).toBe(5_799);
    expect(r.data_plane.ping_ms).toBeGreaterThan(0);
  });

  it("never calls INFO — it is per node and cannot be trusted", async () => {
    const fetchImpl = fakeFetch();
    await collectUpstash(DATA_ONLY, { fetchImpl });

    const commands = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((call) => String((call[1] as { body?: string } | undefined)?.body ?? ""))
      .join(" ");
    expect(commands).not.toContain("INFO");
    expect(commands).toContain("PING");
    expect(commands).toContain("DBSIZE");
  });

  it("is not_observable without REST credentials", async () => {
    const r = await collectUpstash({}, { fetchImpl: fakeFetch() });
    expect(r.data_plane.status).toBe("not_observable");
    if (r.data_plane.status !== "not_observable") return;
    expect(r.data_plane.missing).toEqual([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
  });

  it.each([401, 403, 404])("degrades on REST %i without throwing", async (status) => {
    const r = await collectUpstash(DATA_ONLY, { fetchImpl: fakeFetch({ restStatus: status }) });
    expect(r.data_plane.status).toBe("not_observable");
    if (r.data_plane.status !== "not_observable") return;
    expect(r.data_plane.reason).toContain(String(status));
  });

  it("degrades on a timeout", async () => {
    const r = await collectUpstash(DATA_ONLY, { fetchImpl: fakeFetch({ throwOn: "rest" }) });
    expect(r.data_plane.status).toBe("not_observable");
  });

  it("degrades when DBSIZE is not a number", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ result: "unexpected" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await collectUpstash(DATA_ONLY, { fetchImpl });
    expect(r.data_plane.status).toBe("not_observable");
    if (r.data_plane.status !== "not_observable") return;
    expect(r.data_plane.reason).toMatch(/non-numeric/);
  });

  it("degrades on a malformed body", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    const r = await collectUpstash(DATA_ONLY, { fetchImpl });
    expect(r.data_plane.status).toBe("not_observable");
  });
});

describe("quota", () => {
  it("is not_observable without management credentials, with the manual path", async () => {
    const r = await collectUpstash(DATA_ONLY, { fetchImpl: fakeFetch() });

    expect(r.quota.status).toBe("not_observable");
    if (r.quota.status !== "not_observable") return;
    expect(r.quota.missing).toEqual(["UPSTASH_EMAIL", "UPSTASH_API_KEY"]);
    // A gap must tell the reader how to close it by hand.
    expect(r.quota.manual_source).toMatch(/Upstash Console/);
  });

  it("activates automatically once the credentials appear", async () => {
    const r = await collectUpstash(FULL, { fetchImpl: fakeFetch() });

    expect(r.quota.status).toBe("observable");
    if (r.quota.status !== "observable") return;
    expect(r.quota.source).toBe("management_api");
    expect(r.quota.commands_period).toBe(125_000);
    expect(r.quota.quota).toBe(UPSTASH_MONTHLY_COMMAND_QUOTA);
    expect(r.quota.percent_used).toBe(25);
  });

  it.each([401, 403, 404])("reports the real status on management %i", async (status) => {
    const r = await collectUpstash(FULL, { fetchImpl: fakeFetch({ mgmtStatus: status }) });
    expect(r.quota.status).toBe("not_observable");
    if (r.quota.status !== "not_observable") return;
    expect(r.quota.http_status).toBe(status);
  });

  it("degrades on a timeout", async () => {
    const r = await collectUpstash(FULL, { fetchImpl: fakeFetch({ throwOn: "mgmt" }) });
    expect(r.quota.status).toBe("not_observable");
  });

  it("degrades when the API returns no databases", async () => {
    const r = await collectUpstash(FULL, { fetchImpl: fakeFetch({ mgmtBody: [] }) });
    expect(r.quota.status).toBe("not_observable");
    if (r.quota.status !== "not_observable") return;
    expect(r.quota.reason).toMatch(/no databases/);
  });

  it("keeps percent null rather than guess when the count is absent", async () => {
    const r = await collectUpstash(FULL, { fetchImpl: fakeFetch({ mgmtBody: [{ name: "db" }] }) });
    if (r.quota.status !== "observable") throw new Error("expected observable");
    expect(r.quota.commands_period).toBeNull();
    expect(r.quota.percent_used).toBeNull();
  });
});

describe("independence", () => {
  it("a dead data plane does not hide the quota", async () => {
    const r = await collectUpstash(FULL, { fetchImpl: fakeFetch({ throwOn: "rest" }) });
    expect(r.data_plane.status).toBe("not_observable");
    expect(r.quota.status).toBe("observable");
  });

  it("a dead management API does not hide the data plane", async () => {
    const r = await collectUpstash(FULL, { fetchImpl: fakeFetch({ throwOn: "mgmt" }) });
    expect(r.data_plane.status).toBe("observable");
    expect(r.quota.status).toBe("not_observable");
  });

  it("always flags the missing time series, credentials or not", async () => {
    // The REST API exposes no per-hour history at any privilege level.
    for (const creds of [DATA_ONLY, FULL]) {
      const r = await collectUpstash(creds, { fetchImpl: fakeFetch() });
      expect(r.not_observable.join(" ")).toMatch(/per hour\/day/);
    }
  });
});

describe("secret redaction", () => {
  it("never leaks the REST URL, token, email or API key", async () => {
    const r = await collectUpstash(FULL, {
      fetchImpl: vi.fn(async (input: unknown) => {
        throw new Error(`failed ${String(input)} token=${REST_TOKEN} user=${EMAIL} key=${API_KEY}`);
      }) as unknown as typeof fetch,
    });

    const dump = JSON.stringify(r);
    for (const secret of [REST_TOKEN, EMAIL, API_KEY, "fake-db-12345"]) {
      expect(dump, `leaked ${secret}`).not.toContain(secret);
    }
  });

  it("sanitizeUpstashError redacts hosts, bearers and emails", () => {
    expect(sanitizeUpstashError(new Error(`x ${REST_URL}/pipeline y`))).not.toContain("fake-db-12345");
    expect(sanitizeUpstashError(new Error("Bearer abc123"))).toContain("[REDACTED]");
    expect(sanitizeUpstashError(new Error("mail ops@example.com"))).not.toContain("ops@example.com");
  });

  it("redacts explicitly supplied secrets even in odd shapes", () => {
    expect(sanitizeUpstashError(new Error(`prefix${API_KEY}suffix`), [API_KEY])).not.toContain(API_KEY);
  });

  it("bounds the output", () => {
    expect(sanitizeUpstashError(new Error("e".repeat(2_000))).length).toBeLessThanOrEqual(200);
  });
});
