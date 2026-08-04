/**
 * Vercel collector. The CLI and fetch are injected, so nothing here shells out
 * or reaches the network.
 *
 * The properties under test are the ones that make a monitor trustworthy:
 * it deduplicates before counting, it labels every log-derived number with the
 * window that produced it, it never turns that window into a monthly figure,
 * and one failing project never takes the other down.
 */

import { describe, expect, it, vi } from "vitest";

import {
  collectVercel,
  dedupeLogRows,
  OBSERVABILITY_GRANULARITY,
  parseCliJson,
  sanitizeVercelError,
  summarizeLogs,
} from "../collectors/vercel";

const T0 = 1_785_810_000_000;

/** Measured on the live API: the cycle that was open on 2026-08-04. */
const CYCLE_START = 1_785_826_800_000;
const CYCLE_END = 1_788_505_200_000;
const TEAM_ID = "team_0000000000000000000000000";

type ObsCall = { url: string; method: string; body: Record<string, unknown> };

/**
 * A fake that routes by URL and method, which the Observability path requires:
 * one GET for the team and two POSTs for the metrics.
 */
function vercelApiFetch(
  opts: {
    teamStatus?: number;
    teamBody?: unknown;
    /** summary rows keyed by metric id. */
    summaries?: Record<string, Array<Record<string, unknown>>>;
    queryStatus?: number;
    failMetric?: string;
  } = {},
) {
  const calls: ObsCall[] = [];
  const impl = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/v2/teams/")) {
      return new Response(
        JSON.stringify(
          opts.teamBody ?? {
            id: TEAM_ID,
            billing: { plan: "pro", period: { start: CYCLE_START, end: CYCLE_END } },
          },
        ),
        { status: opts.teamStatus ?? 200 },
      );
    }

    if (url.includes("/v2/observability/query")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, method: String(init?.method ?? "GET"), body });
      const metric = String(body.metric);
      if (opts.queryStatus && opts.queryStatus !== 200) {
        return new Response(JSON.stringify({ error: { code: "nope", message: "no" } }), {
          status: opts.queryStatus,
        });
      }
      if (opts.failMetric === metric) {
        return new Response(JSON.stringify({ error: { code: "boom", message: "metric failed" } }), {
          status: 500,
        });
      }
      return new Response(JSON.stringify({ data: [], summary: opts.summaries?.[metric] ?? [] }), {
        status: 200,
      });
    }

    return new Response("<html>ok</html>", { status: 200 });
  }) as unknown as typeof fetch;

  return { impl, calls };
}

const COUNT = "vercel.function_invocation.count";
const CPU = "vercel.function_invocation.function_cpu_time_ms";

/** The real six-project split measured on 2026-08-04. */
function realWorldSummaries() {
  return {
    [COUNT]: [
      { project_name: "chesscito", vercel_function_invocation_count_sum: 13_462 },
      { project_name: "lite-chesscito", vercel_function_invocation_count_sum: 10_370 },
      { project_name: "chesscito-landing", vercel_function_invocation_count_sum: 5_033 },
      { project_name: "furinkazan", vercel_function_invocation_count_sum: 12 },
      { project_name: "denscope-xr", vercel_function_invocation_count_sum: 6 },
      { project_name: "xymyx-dasboard", vercel_function_invocation_count_sum: 1 },
    ],
    [CPU]: [
      { project_name: "chesscito", vercel_function_invocation_function_cpu_time_ms_sum: 300_000 },
      { project_name: "lite-chesscito", vercel_function_invocation_function_cpu_time_ms_sum: 200_000 },
      { project_name: "chesscito-landing", vercel_function_invocation_function_cpu_time_ms_sum: 134_839 },
    ],
  };
}

function cliStub(args: string[]) {
  return args[0] === "ls"
    ? `{"deployments":[{"url":"u","state":"READY","target":"production","ready":${T0 - 600_000},"meta":{"githubCommitSha":"sha","githubCommitRef":"production"}}]}`
    : "";
}

function lsJson(
  sha: string,
  opts: { target?: string; ref?: string; url?: string } = {},
) {
  return `Vercel CLI 58.4.4\nFetching deployments\n${JSON.stringify({
    deployments: [
      {
        url: opts.url ?? "chesscito-abc-goodwolf.vercel.app",
        state: "READY",
        target: opts.target ?? "production",
        ready: T0 - 600_000,
        meta: {
          githubCommitSha: sha,
          githubCommitRef: opts.ref ?? "production",
        },
      },
    ],
  })}`;
}

/** Answers both the domain probe and the usage endpoint. */
function fetchFor(opts: { usageStatus?: number; domainStatus?: number } = {}) {
  return vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes("api.vercel.com")) {
      return new Response(JSON.stringify({}), { status: opts.usageStatus ?? 200 });
    }
    return new Response("<html>ok</html>", { status: opts.domainStatus ?? 200 });
  }) as unknown as typeof fetch;
}

function logLines(rows: unknown[]) {
  return `Vercel CLI 58.4.4\n${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;
}

function okFetch(body: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  ) as unknown as typeof fetch;
}

describe("CLI parsing", () => {
  it("skips the CLI banner that precedes the JSON", () => {
    expect(parseCliJson("Vercel CLI 58.4.4\nFetching…\n{\"a\":1}")).toEqual({ a: 1 });
  });

  it("throws when there is no JSON at all", () => {
    expect(() => parseCliJson("Error: not logged in")).toThrow(/no JSON/);
  });

  it("reads the commit SHA, which `vercel inspect` does not print", async () => {
    const sha = "986bb38320d99a49807803e48f4d5390250a47cb";
    const result = await collectVercel(undefined, "production", {
      cli: (args) => (args[0] === "ls" ? lsJson(sha) : logLines([])),
      fetchImpl: fetchFor(),
      now: () => T0,
    });

    const project = result.projects[0]!;
    expect(project.status).toBe("observable");
    if (project.status !== "observable") return;
    // Without this the monitor can only infer the deployed commit from a branch.
    expect(project.deployment?.commit_sha).toBe(sha);
    expect(project.deployment?.age_minutes).toBe(10);
  });
});

describe("log deduplication", () => {
  it("collapses the API's duplicate emission of the same request", () => {
    // Measured repeatedly: the logs API returns each request twice, with the
    // same requestId AND the same id. Counting raw lines doubles everything.
    const row = { requestId: "r1", id: "i1", requestPath: "/api/x", responseStatusCode: 200 };
    expect(dedupeLogRows([row, { ...row }])).toHaveLength(1);
  });

  it("keeps distinct rows that share a requestId but differ in id", () => {
    expect(
      dedupeLogRows([
        { requestId: "r1", id: "i1" },
        { requestId: "r1", id: "i2" },
      ]),
    ).toHaveLength(2);
  });

  it("reports raw_rows alongside the deduplicated count", () => {
    const row = { requestId: "r1", id: "i1", requestPath: "/a", responseStatusCode: 200, timestamp: T0 };
    const summary = summarizeLogs([row, { ...row }]);
    expect(summary.requests).toBe(1);
    expect(summary.raw_rows).toBe(2);
  });
});

describe("log summary", () => {
  const rows = [
    { requestId: "1", id: "a", timestamp: T0, requestPath: "/api/telemetry", responseStatusCode: 204 },
    { requestId: "2", id: "b", timestamp: T0 + 30_000, requestPath: "/api/telemetry", responseStatusCode: 413 },
    {
      requestId: "3",
      id: "c",
      timestamp: T0 + 60_000,
      requestPath: "/api/welcome-pack/status",
      responseStatusCode: 500,
      logs: [{ message: '{"errMessage":"<!DOCTYPE html><html>"}' }],
    },
  ];

  it("states the exact window the sample came from", () => {
    const s = summarizeLogs(rows);
    expect(s.window_start).toBe(new Date(T0).toISOString());
    expect(s.window_end).toBe(new Date(T0 + 60_000).toISOString());
    expect(s.window_seconds).toBe(60);
  });

  it("counts 5XX per route", () => {
    const s = summarizeLogs(rows);
    const wp = s.by_route.find((r) => r.route === "/api/welcome-pack/status");
    expect(wp).toMatchObject({ requests: 1, errors_5xx: 1 });
    // A 413 is a rejection, not a server fault.
    expect(s.by_route.find((r) => r.route === "/api/telemetry")?.errors_5xx).toBe(0);
  });

  it("flags the HTML-gateway signature of a Supabase 522", () => {
    expect(summarizeLogs(rows).html_gateway_errors).toEqual(["/api/welcome-pack/status"]);
  });

  it("breaks out /api/telemetry, which is the batching signal", () => {
    expect(summarizeLogs(rows).telemetry).toEqual({ requests: 2, errors_5xx: 0 });
  });

  it("survives an empty window without inventing a range", () => {
    const s = summarizeLogs([]);
    expect(s).toMatchObject({ requests: 0, window_start: null, window_seconds: null });
  });

  it("emits NO monthly or extrapolated field", () => {
    // The window is minutes long and is whatever the API chose to return.
    // Scaling it to a month would invent an invocation count.
    const keys = Object.keys(summarizeLogs(rows));
    for (const forbidden of ["monthly", "invocations_total", "projected", "per_month", "cpu"]) {
      expect(keys.some((k) => k.includes(forbidden))).toBe(false);
    }
  });
});

describe("usage endpoint", () => {
  it("is not_observable without a token, and says so", async () => {
    const r = await collectVercel(undefined, "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: fetchFor(),
      now: () => T0,
    });
    expect(r.usage.status).toBe("not_observable");
    if (r.usage.status !== "not_observable") return;
    expect(r.usage.reason).toMatch(/VERCEL_TOKEN/);
    expect(r.usage.http_status).toBeNull();
  });

  it.each([401, 403, 404])("reports the REAL status code on %i", async (status) => {
    // `vercel usage` answers 404 on this plan. 401 (bad token) and 403 (plan
    // or scope) need different fixes, so the code must survive to the report.
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: fetchFor({ usageStatus: status }),
      now: () => T0,
    });

    expect(r.usage.status).toBe("not_observable");
    if (r.usage.status !== "not_observable") return;
    expect(r.usage.http_status).toBe(status);
    expect(r.usage.reason).toContain(String(status));
  });

  it("lists CPU and invocations as not observable whenever usage fails", async () => {
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: fetchFor({ usageStatus: 403 }),
      now: () => T0,
    });
    expect(r.not_observable.join(" ")).toMatch(/Active CPU/);
    expect(r.not_observable.join(" ")).toMatch(/invocations/);
  });

  it("surfaces the error code and message Vercel put in the body", async () => {
    // The defect that cost three sessions: the collector read the status and
    // threw the body away, so `missing required property \`from\`` — which
    // names the cause outright — never reached the report.
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async (u: unknown) =>
        String(u).includes("api.vercel.com")
          ? new Response(
              JSON.stringify({
                error: { code: "bad_request", message: "Invalid request: missing required property `from`." },
              }),
              { status: 400, headers: { "content-type": "application/json" } },
            )
          : new Response("ok", { status: 200 }),
      ) as unknown as typeof fetch,
      now: () => T0,
    });

    expect(r.usage.status).toBe("not_observable");
    if (r.usage.status !== "not_observable") return;
    expect(r.usage.http_status).toBe(400);
    expect(r.usage.reason).toContain("400");
    expect(r.usage.reason).toContain("bad_request");
    expect(r.usage.reason).toContain("missing required property");
  });

  it("degrades to the plain message when the error body is not JSON", async () => {
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async (u: unknown) =>
        String(u).includes("api.vercel.com")
          ? new Response("<!DOCTYPE html><html><body>gateway</body></html>", { status: 502 })
          : new Response("ok", { status: 200 }),
      ) as unknown as typeof fetch,
      now: () => T0,
    });

    if (r.usage.status !== "not_observable") throw new Error("expected not_observable");
    expect(r.usage.reason).toContain("502");
    // An HTML body must never be dumped into the report.
    expect(r.usage.reason).not.toContain("DOCTYPE");
  });

  it("never leaks the token even when the error body echoes it", async () => {
    const r = await collectVercel("super-secret-token", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async (u: unknown) =>
        String(u).includes("api.vercel.com")
          ? new Response(
              JSON.stringify({
                error: { code: "forbidden", message: "Bearer super-secret-token is not allowed" },
              }),
              { status: 403 },
            )
          : new Response("ok", { status: 200 }),
      ) as unknown as typeof fetch,
      now: () => T0,
    });

    expect(JSON.stringify(r)).not.toContain("super-secret-token");
  });

  it("bounds the reason length so a large body cannot flood the report", async () => {
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async (u: unknown) =>
        String(u).includes("api.vercel.com")
          ? new Response(
              JSON.stringify({ error: { code: "bad_request", message: "x".repeat(5_000) } }),
              { status: 400 },
            )
          : new Response("ok", { status: 200 }),
      ) as unknown as typeof fetch,
      now: () => T0,
    });

    if (r.usage.status !== "not_observable") throw new Error("expected not_observable");
    expect(r.usage.reason.length).toBeLessThanOrEqual(260);
  });

  it("survives a body that throws while being read", async () => {
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async (u: unknown) => {
        if (!String(u).includes("api.vercel.com")) return new Response("ok", { status: 200 });
        return {
          ok: false,
          status: 400,
          text: () => Promise.reject(new Error("stream closed")),
          json: () => Promise.reject(new Error("stream closed")),
        } as unknown as Response;
      }) as unknown as typeof fetch,
      now: () => T0,
    });

    if (r.usage.status !== "not_observable") throw new Error("expected not_observable");
    expect(r.usage.http_status).toBe(400);
    expect(r.usage.reason).toContain("400");
  });

  it("handles a network failure without throwing", async () => {
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async () => { throw new Error("ETIMEDOUT"); }) as unknown as typeof fetch,
      now: () => T0,
    });
    expect(r.usage.status).toBe("not_observable");
  });

  it("handles a malformed body without throwing", async () => {
    const r = await collectVercel("tok", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async (u: unknown) =>
        String(u).includes("api.vercel.com")
          ? new Response("not json", { status: 200 })
          : new Response("ok", { status: 200 }),
      ) as unknown as typeof fetch,
      now: () => T0,
    });
    expect(r.usage.status).toBe("not_observable");
  });
});

describe("Observability usage", () => {
  async function run(
    fake: ReturnType<typeof vercelApiFetch>,
    target: "production" | "preview" = "production",
  ) {
    return collectVercel("tok", target, {
      cli: cliStub,
      fetchImpl: fake.impl,
      now: () => T0,
    });
  }

  it("scopes by the canonical team id, never the slug", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    await run(fake);

    for (const call of fake.calls) {
      expect(call.body.scope).toEqual({ type: "owner", ownerId: TEAM_ID });
      // Measured: the slug is rejected with invalid_union_discriminator.
      expect(JSON.stringify(call.body.scope)).not.toContain("goodwolf");
    }
  });

  it("POSTs JSON", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    await run(fake);
    expect(fake.calls.length).toBeGreaterThan(0);
    for (const call of fake.calls) expect(call.method).toBe("POST");
  });

  it("asks for hourly buckets, never a 24h one", async () => {
    // MEASURED TRAP: {hours:24} is calendar-aligned and its `summary` counts
    // the WHOLE bucket — 53,897 vs 28,881 for the same window, an 87%
    // overstatement, with HTTP 200 and no warning.
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    await run(fake);

    for (const call of fake.calls) {
      expect(call.body.granularity).toEqual({ minutes: 60 });
      expect(JSON.stringify(call.body)).not.toContain('"hours"');
    }
    expect(OBSERVABILITY_GRANULARITY).toEqual({ minutes: 60 });
  });

  it("groups by project_name", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    await run(fake);
    for (const call of fake.calls) expect(call.body.groupBy).toContain("project_name");
  });

  it("totals ONLY the two projects the profile declares", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    const r = await run(fake);

    if (r.usage.status !== "observable") throw new Error("expected observable");
    expect(r.usage.in_scope_total.invocations).toBe(13_462 + 10_370);
  });

  it("never queries the CPU measure, whose per-project attribution is noise", async () => {
    // MEASURED (2026-08-04): three back-to-back identical CPU queries returned
    // 1, 3 and 2 rows, with values moving ~25% and the SAME value attributed
    // to a different project between calls. Invocations over the identical
    // grouping were stable to ±1. So the CPU measure is not asked for at all.
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    await run(fake);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.body.metric).toBe(COUNT);
    for (const call of fake.calls) expect(call.body.metric).not.toBe(CPU);
  });

  it("reports cpu_ms as null with the reason, never as a number or a zero", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    const r = await run(fake);

    if (r.usage.status !== "observable") throw new Error("expected observable");
    expect(r.usage.in_scope_total.cpu_ms).toBeNull();
    for (const p of r.usage.by_project) expect(p.cpu_ms).toBeNull();
    expect(r.usage.cpu_ms_reason).toMatch(/non-deterministic/i);
    // Active CPU must stay on the unmeasured list even on a successful run.
    expect(r.not_observable.join(" ")).toMatch(/Active CPU/);
  });

  it("keeps chesscito-landing out of the total — it is out of scope by decision", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    const r = await run(fake);

    if (r.usage.status !== "observable") throw new Error("expected observable");
    expect(r.usage.out_of_scope.projects).toContain("chesscito-landing");
    expect(r.usage.by_project.map((p) => p.project)).not.toContain("chesscito-landing");
    expect(r.usage.in_scope_total.invocations).not.toBe(13_462 + 10_370 + 5_033);
  });

  it("puts every undeclared project out of scope, including future ones", async () => {
    const fake = vercelApiFetch({
      summaries: {
        [COUNT]: [
          { project_name: "chesscito", vercel_function_invocation_count_sum: 100 },
          { project_name: "a-project-invented-tomorrow", vercel_function_invocation_count_sum: 999 },
        ],
        [CPU]: [],
      },
    });
    const r = await run(fake);

    if (r.usage.status !== "observable") throw new Error("expected observable");
    expect(r.usage.in_scope_total.invocations).toBe(100);
    expect(r.usage.out_of_scope.projects).toEqual(["a-project-invented-tomorrow"]);
    expect(r.usage.out_of_scope.invocations).toBe(999);
  });

  it("uses the same two projects on preview, and claims no environment split", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    const r = await run(fake, "preview");

    if (r.usage.status !== "observable") throw new Error("expected observable");
    // Project names are shared across environments, so this is project
    // consumption, NOT per-environment attribution.
    expect(r.usage.in_scope_total.invocations).toBe(13_462 + 10_370);
    for (const call of fake.calls) {
      expect(call.body.groupBy).not.toContain("environment");
    }
  });

  it("leaves cpu_percent null: there is no denominator to divide by", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    const r = await run(fake);

    if (r.usage.status !== "observable") throw new Error("expected observable");
    // /v1/billing/charges answers 404 costs_not_found, so the plan allowance
    // is unknown. Inventing one to render a percentage is the exact class of
    // truth-shaped number this monitor exists not to produce.
    expect(r.usage.cpu_percent).toBeNull();
  });

  it("still lists quota and exhaustion as not observable when usage IS observable", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    const r = await run(fake);

    const joined = r.not_observable.join(" ");
    expect(joined).toMatch(/quota|cuota/i);
    expect(joined).toMatch(/exhaustion/i);
    // But the two that ARE measured now must be gone from the list.
    expect(joined).not.toMatch(/invocations for the billing period/);
  });

  it("reports the window and the billing cycle start", async () => {
    const fake = vercelApiFetch({ summaries: realWorldSummaries() });
    const r = await run(fake);

    if (r.usage.status !== "observable") throw new Error("expected observable");
    expect(r.usage.window.start).toBe(new Date(CYCLE_START).toISOString());
    expect(r.usage.window.billing_cycle_start).toBe(new Date(CYCLE_START).toISOString());
    // T0 is before the cycle end, so the window closes at now, not at the end.
    expect(r.usage.window.end).toBe(new Date(T0).toISOString());
  });

  it("clamps the window end to the cycle end when the cycle already closed", async () => {
    const fake = vercelApiFetch({
      teamBody: {
        id: TEAM_ID,
        billing: { plan: "pro", period: { start: T0 - 200_000, end: T0 - 100_000 } },
      },
      summaries: realWorldSummaries(),
    });
    const r = await run(fake);

    if (r.usage.status !== "observable") throw new Error("expected observable");
    expect(r.usage.window.end).toBe(new Date(T0 - 100_000).toISOString());
  });

  it("treats an empty summary as not observable, NOT as zero", async () => {
    // Absence of data and a measured zero are different facts, and reporting
    // the first as the second would say "nothing ran" about a live system.
    const fake = vercelApiFetch({ summaries: { [COUNT]: [], [CPU]: [] } });
    const r = await run(fake);

    expect(r.usage.status).toBe("not_observable");
    if (r.usage.status !== "not_observable") return;
    expect(r.usage.reason).toMatch(/empty|no rows|sin datos/i);
  });

  it("is not_observable when the team cannot be resolved", async () => {
    const fake = vercelApiFetch({ teamStatus: 403 });
    const r = await run(fake);

    expect(r.usage.status).toBe("not_observable");
    if (r.usage.status !== "not_observable") return;
    expect(r.usage.http_status).toBe(403);
  });

  it("is not_observable when the team payload has no id", async () => {
    const fake = vercelApiFetch({ teamBody: { billing: {} } });
    const r = await run(fake);
    expect(r.usage.status).toBe("not_observable");
  });

  it("produces NO partial data when the metric query fails", async () => {
    // Numbers that survived a failed query, labelled as if they were the whole
    // picture, are worse than none.
    const fake = vercelApiFetch({ summaries: realWorldSummaries(), failMetric: COUNT });
    const r = await run(fake);

    expect(r.usage.status).toBe("not_observable");
    expect(JSON.stringify(r.usage)).not.toContain("13462");
  });

  it("never echoes the token through the Observability path", async () => {
    const fake = vercelApiFetch({ teamStatus: 401, teamBody: { error: { code: "x", message: "Bearer tok" } } });
    const r = await collectVercel("tok", "production", {
      cli: cliStub,
      fetchImpl: fake.impl,
      now: () => T0,
    });
    expect(JSON.stringify(r)).not.toContain("Bearer tok");
  });
});

describe("fault tolerance", () => {
  it("one failing project does not take the other down", async () => {
    const r = await collectVercel(undefined, "production", {
      cli: (args) => {
        if (args.includes("lite-chesscito")) throw new Error("project not found");
        return args[0] === "ls" ? lsJson("sha") : logLines([]);
      },
      fetchImpl: fetchFor(),
      now: () => T0,
    });

    expect(r.projects.map((p) => p.status)).toEqual(["observable", "not_observable"]);
  });

  it("a failing log fetch still reports the deployment", async () => {
    const r = await collectVercel(undefined, "production", {
      cli: (args) => {
        if (args[0] === "logs") throw new Error("logs unavailable");
        return lsJson("sha");
      },
      fetchImpl: fetchFor(),
      now: () => T0,
    });

    const p = r.projects[0]!;
    expect(p.status).toBe("observable");
    if (p.status !== "observable") return;
    expect(p.deployment).not.toBeNull();
    expect(p.logs).toBeNull();
    expect(p.logs_error).toMatch(/logs unavailable/);
  });

  it("skips malformed log lines instead of failing the window", async () => {
    const r = await collectVercel(undefined, "production", {
      cli: (args) =>
        args[0] === "ls"
          ? lsJson("sha")
          : `{"requestId":"1","id":"a","requestPath":"/a","responseStatusCode":200}\n{ truncated`,
      fetchImpl: fetchFor(),
      now: () => T0,
    });

    const p = r.projects[0]!;
    if (p.status !== "observable") throw new Error("expected observable");
    expect(p.logs?.requests).toBe(1);
  });
});

describe("secret redaction", () => {
  it("never echoes a bearer token from an error", async () => {
    const r = await collectVercel("super-secret-token", "production", {
      cli: (a) => (a[0] === "ls" ? lsJson("sha") : logLines([])),
      fetchImpl: vi.fn(async () => {
        throw new Error("failed: Bearer super-secret-token");
      }) as unknown as typeof fetch,
      now: () => T0,
    });

    expect(JSON.stringify(r)).not.toContain("super-secret-token");
  });

  it("sanitizeVercelError strips tokens and bounds length", () => {
    expect(sanitizeVercelError(new Error("Bearer abc123"))).toContain("[REDACTED]");
    expect(sanitizeVercelError(new Error("x?token=abc123"))).not.toContain("abc123");
    expect(sanitizeVercelError(new Error("e".repeat(1_000))).length).toBeLessThanOrEqual(200);
  });
});
