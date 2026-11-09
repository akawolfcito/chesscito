/**
 * Vercel collector — deployments and a short log window. Read-only.
 *
 * ── What this can and cannot see ──────────────────────────────────────────
 *
 * OBSERVABLE, from the authenticated CLI, no token needed:
 *   · the current production deployment, its state, and — importantly — the
 *     commit SHA (`meta.githubCommitSha`), which `vercel inspect` does not
 *     print. That is what lets a snapshot assert "production is running X"
 *     instead of inferring it from a branch.
 *   · a SHORT WINDOW of runtime logs: routes, status codes, 5XX by route.
 *
 * NOT OBSERVABLE without `VERCEL_TOKEN`, and possibly not even with it:
 *   · total invocations for the billing period
 *   · Fluid Active CPU and quota percentage
 *
 * `vercel usage` answers `Costs not found (404)` on this account's plan
 * (measured). So the collector calls the REST endpoint when a token exists and
 * reports the ACTUAL status code it received rather than guessing why.
 *
 * ── Two things this deliberately refuses to do ────────────────────────────
 *
 * 1. **Extrapolate the log sample to a monthly figure.** The window is minutes
 *    long and is whatever the API chose to return; multiplying it out would
 *    produce an invented invocation count. Every log-derived number is labelled
 *    with the exact window that produced it and nothing more.
 *
 * 2. **Infer Active CPU.** There is no derivation from logs to CPU-seconds
 *    that is not a guess. It stays `not_observable`.
 *
 * ── Deduplication ─────────────────────────────────────────────────────────
 *
 * The logs API emits each request TWICE — same `requestId` AND same `id` —
 * measured repeatedly across this work. Counting raw lines doubles every
 * number, so rows are deduped on the `requestId + id` pair.
 */

import { execFile } from "node:child_process";

import {
  profileFor,
  type OpsTarget,
  type TargetProfile,
  type TargetProject,
} from "../lib/target";

export type VercelProjectName = TargetProject["project"];

export const VERCEL_CLI_TIMEOUT_MS = 25_000;
/** Hard cap on concurrent `vercel` subprocesses. */
export const VERCEL_MAX_CONCURRENCY = 4;
export const VERCEL_API_TIMEOUT_MS = 15_000;
export const VERCEL_LOG_LIMIT = 100;

export type VercelDeployment = {
  url: string;
  state: string;
  target: string | null;
  commit_sha: string | null;
  commit_ref: string | null;
  ready_at: string | null;
  age_minutes: number | null;
};

/** A log window is only ever reported together with the window it came from. */
export type VercelLogSample = {
  /** Requests after deduplication on requestId + id. */
  requests: number;
  raw_rows: number;
  window_start: string | null;
  window_end: string | null;
  window_seconds: number | null;
  by_route: Array<{ route: string; requests: number; errors_5xx: number }>;
  status_counts: Record<string, number>;
  telemetry: { requests: number; errors_5xx: number };
  /** Routes whose 5XX carried an HTML gateway body — the 522 signature. */
  html_gateway_errors: string[];
};

/**
 * A read-only GET of the project's PUBLIC domain.
 *
 * Reported separately from the deployment on purpose: the internal
 * `*.vercel.app` URL answering says the build exists, while the public domain
 * answering says the alias is actually wired to it. Those fail independently —
 * a domain can point at an older deployment, or at nothing.
 *
 * Only `/`, one request, bounded timeout, no writes.
 */
export type DomainProbe =
  | {
      status: "observable";
      domain: string;
      http_status: number;
      /** After redirects; a locale prefix here is normal and expected. */
      final_url: string;
      redirected: boolean;
      latency_ms: number;
      /** 2xx, or a redirect that resolved to one. */
      healthy: boolean;
    }
  | { status: "not_observable"; domain: string; reason: string };

/**
 * The deployment Vercel returned did not match the profile that was asked for.
 *
 * Classified as NOT OBSERVABLE rather than as a warning about the system:
 * production may be perfectly healthy: what failed is that the monitor could
 * not find what it was told to look at. Treating it as yellow would file a
 * lookup problem next to real incidents.
 */
export type TargetMismatch = {
  expected_target: string;
  expected_ref: string;
  actual_target: string | null;
  actual_ref: string | null;
  reason: string;
};

export type VercelProjectResult =
  | {
      project: VercelProjectName;
      label: string;
      domain: string;
      status: "observable";
      deployment: VercelDeployment | null;
      domain_probe: DomainProbe;
      logs: VercelLogSample | null;
      logs_error: string | null;
    }
  | {
      project: VercelProjectName;
      label: string;
      domain: string;
      status: "target_mismatch";
      mismatch: TargetMismatch;
      domain_probe: DomainProbe;
    }
  | {
      project: VercelProjectName;
      label: string;
      domain: string;
      status: "not_observable";
      reason: string;
    };

export type ProjectUsage = {
  project: string;
  invocations: number;
  /**
   * ALWAYS null. See `CPU_PER_PROJECT_UNRELIABLE` — the API's per-project CPU
   * attribution is not deterministic, so there is no honest number to put here.
   */
  cpu_ms: null;
};

/**
 * Why Active CPU is not reported per project, measured 2026-08-04.
 *
 * Three back-to-back calls, same window, same query, seconds apart:
 *   #1 → 1 row  · chesscito-landing 659,512
 *   #2 → 3 rows · 535,102 / 77,205 / 47,205
 *   #3 → 2 rows · 526,443 / 133,069
 *
 * The row COUNT changes, the projects change, and the values move ~25%. An
 * earlier pair even reported the identical value 46,479 attributed to
 * `chesscito` in one call and `lite-chesscito` in the next.
 *
 * Invocations over the exact same grouping are stable to ±1 across the same
 * three calls, so this is specific to the CPU measure, not to `groupBy`.
 *
 * This is the Upstash `INFO` trap again: a number shaped like a metric that
 * behaves like noise. Publishing it per project would be worse than leaving
 * the axis unmeasured, because a wrong CPU figure reads as reassurance.
 */
export const CPU_PER_PROJECT_UNRELIABLE =
  "Active CPU per project: NOT OBSERVABLE — the API's per-project attribution is non-deterministic (3 identical calls returned 1, 3 and 2 rows with values moving ~25%)";

export type VercelUsage =
  | {
      status: "observable";
      source: "observability";
      /**
       * The window ACTUALLY queried. Never "the month": the billing cycle
       * rolls, and on 2026-08-04 it had rolled that same morning, so a
       * period-to-date figure covered ~8 hours. Every number here is only
       * readable next to the window that produced it.
       */
      window: { start: string; end: string; billing_cycle_start: string };
      /** Only the profile's projects, one row each. */
      by_project: ProjectUsage[];
      in_scope_total: { invocations: number; cpu_ms: null };
      /** Why `cpu_ms` is null everywhere above. */
      cpu_ms_reason: string;
      /** What the TEAM consumed outside the monitor's scope. Never summed in. */
      out_of_scope: { projects: string[]; invocations: number };
      /**
       * Always null, deliberately. A percentage needs the plan's included
       * allowance as a denominator, and no reachable API exposes it:
       * `/v1/billing/charges` answers 404 `costs_not_found`. Absolute
       * consumption is a fact; a percentage would be an invention.
       */
      cpu_percent: null;
    }
  | { status: "not_observable"; reason: string; http_status: number | null };

export type VercelResult = {
  /** Which environment this whole block describes. */
  target: OpsTarget;
  projects: VercelProjectResult[];
  /** Invocations + Active CPU. See the module header on why this is separate. */
  usage: VercelUsage;
  /** Always present: no derivation from logs to these exists. */
  not_observable: string[];
};

export const DOMAIN_PROBE_TIMEOUT_MS = 12_000;

/**
 * Validate the deployment against the requested profile.
 *
 * BOTH signals are checked because they come from different systems: `target`
 * is Vercel's own classification, `githubCommitRef` is what git reported at
 * build time. Agreeing on one while disagreeing on the other means the
 * topology changed — a branch renamed, a domain repointed — and that is worth
 * refusing rather than papering over.
 */
export function validateTargetMatch(
  deployment: VercelDeployment,
  profile: TargetProfile,
): { ok: true } | { ok: false; mismatch: TargetMismatch } {
  const actualTarget = deployment.target;
  const actualRef = deployment.commit_ref;

  const targetOk = actualTarget === profile.target;
  const refOk = actualRef === profile.expectedGitRef;
  if (targetOk && refOk) return { ok: true };

  const problems: string[] = [];
  if (!targetOk) problems.push(`target is "${actualTarget ?? "unknown"}"`);
  if (!refOk) problems.push(`git ref is "${actualRef ?? "unknown"}"`);

  return {
    ok: false,
    mismatch: {
      expected_target: profile.target,
      expected_ref: profile.expectedGitRef,
      actual_target: actualTarget,
      actual_ref: actualRef,
      reason: `asked for ${profile.target} (ref ${profile.expectedGitRef}) but ${problems.join(" and ")}`,
    },
  };
}

/** GET the public domain once. Never throws. */
export async function probeDomain(
  domain: string,
  fetchImpl: typeof fetch,
  clock: () => number,
): Promise<DomainProbe> {
  const url = `https://${domain}/`;
  const startedAt = clock();
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(DOMAIN_PROBE_TIMEOUT_MS),
    });
    const latency = clock() - startedAt;

    return {
      status: "observable",
      domain,
      http_status: response.status,
      final_url: response.url || url,
      // A locale redirect (`/` → `/en`) is the app working as designed, so a
      // followed redirect ending in 2xx counts as healthy.
      redirected: Boolean(response.redirected),
      latency_ms: latency,
      healthy: response.status >= 200 && response.status < 300,
    };
  } catch (error) {
    return { status: "not_observable", domain, reason: sanitizeVercelError(error) };
  }
}

/** May return synchronously or asynchronously; the collector awaits either. */
export type CliRunner = (args: string[], timeoutMs: number) => string | Promise<string>;

export type VercelDeps = {
  /** Injected so tests never shell out. Returns stdout. */
  cli?: CliRunner;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/**
 * Async spawn with a per-call timeout. Not `execFileSync`: that blocks the
 * process, so two projects could never overlap and the collector measured ~17 s
 * for four calls that each take ~4 s.
 */
function defaultCli(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "vercel",
      args,
      { encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        // A non-zero exit still carries usable stdout in some CLI paths, but a
        // timeout does not — surface the error and let the caller degrade.
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

/** The CLI prints a banner before the JSON; take everything from the first `{`. */
export function parseCliJson(raw: string): unknown {
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("no JSON object in CLI output");
  return JSON.parse(raw.slice(start));
}

/**
 * Deduplicate log rows.
 *
 * The pair is the key, not `requestId` alone: a single request legitimately
 * produces several rows in some shapes, and `id` distinguishes those, while the
 * API's duplicate emission repeats BOTH fields identically.
 */
export function dedupeLogRows<T extends { requestId?: unknown; id?: unknown }>(
  rows: T[],
): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const key = `${String(row.requestId ?? "")}|${String(row.id ?? "")}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

type RawLogRow = {
  requestId?: unknown;
  id?: unknown;
  timestamp?: unknown;
  requestPath?: unknown;
  responseStatusCode?: unknown;
  source?: unknown;
  logs?: Array<{ message?: unknown }>;
};

export function summarizeLogs(rows: RawLogRow[]): VercelLogSample {
  const deduped = dedupeLogRows(rows);

  const timestamps = deduped
    .map((r) => (typeof r.timestamp === "number" ? r.timestamp : null))
    .filter((t): t is number => t !== null);
  const start = timestamps.length ? Math.min(...timestamps) : null;
  const end = timestamps.length ? Math.max(...timestamps) : null;

  const byRoute = new Map<string, { requests: number; errors_5xx: number }>();
  const statusCounts: Record<string, number> = {};
  const htmlGatewayRoutes = new Set<string>();
  let telemetryRequests = 0;
  let telemetryErrors = 0;

  for (const row of deduped) {
    const route = typeof row.requestPath === "string" ? row.requestPath : "unknown";
    const status = typeof row.responseStatusCode === "number" ? row.responseStatusCode : 0;
    const is5xx = status >= 500;

    const entry = byRoute.get(route) ?? { requests: 0, errors_5xx: 0 };
    entry.requests += 1;
    if (is5xx) entry.errors_5xx += 1;
    byRoute.set(route, entry);

    statusCounts[String(status)] = (statusCounts[String(status)] ?? 0) + 1;

    if (route === "/api/telemetry") {
      telemetryRequests += 1;
      if (is5xx) telemetryErrors += 1;
    }

    // The 522 signature: Supabase's gateway answers HTML where JSON is due.
    if (is5xx) {
      const blob = JSON.stringify(row.logs ?? []);
      if (blob.includes("DOCTYPE html") || blob.includes("html_gateway_error")) {
        htmlGatewayRoutes.add(route);
      }
    }
  }

  return {
    requests: deduped.length,
    raw_rows: rows.length,
    window_start: start === null ? null : new Date(start).toISOString(),
    window_end: end === null ? null : new Date(end).toISOString(),
    window_seconds: start === null || end === null ? null : Math.round((end - start) / 1000),
    by_route: [...byRoute.entries()]
      .map(([route, v]) => ({ route, ...v }))
      .sort((a, b) => b.requests - a.requests),
    status_counts: statusCounts,
    telemetry: { requests: telemetryRequests, errors_5xx: telemetryErrors },
    html_gateway_errors: [...htmlGatewayRoutes],
  };
}

/** Truncate and strip anything token-shaped from an external error. */
export function sanitizeVercelError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw);
  return text
    .replace(/Bearer\s+[A-Za-z0-9_-]+/gi, "Bearer [REDACTED]")
    .replace(/[?&]token=[^\s&"']+/gi, "?token=[REDACTED]")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" | ")
    .slice(0, 200);
}

/**
 * Vercel's encoding of the deployment target.
 *
 * Measured against the live API: a production deployment carries
 * `target: "production"`, and a preview deployment carries `target: null` —
 * the key is present, the value is null. So `null` is not a missing field, it
 * IS the preview marker, and reading it as "unknown" makes every preview run
 * report a mismatch against itself. Caught by the first real `--target preview`
 * run (2026-08-04).
 *
 * Anything else is passed through unchanged so it fails validation loudly
 * rather than being coerced into one of the two known values.
 */
export function normalizeDeploymentTarget(raw: unknown): string | null {
  if (raw === null || raw === undefined) return "preview";
  return typeof raw === "string" ? raw : null;
}

function toDeployment(raw: Record<string, unknown>, nowMs: number): VercelDeployment {
  const meta = (raw.meta ?? {}) as Record<string, unknown>;
  const ready = typeof raw.ready === "number" ? raw.ready : null;
  return {
    url: typeof raw.url === "string" ? raw.url : "unknown",
    state: typeof raw.state === "string" ? raw.state : "unknown",
    target: normalizeDeploymentTarget(raw.target),
    commit_sha: typeof meta.githubCommitSha === "string" ? meta.githubCommitSha : null,
    commit_ref: typeof meta.githubCommitRef === "string" ? meta.githubCommitRef : null,
    ready_at: ready === null ? null : new Date(ready).toISOString(),
    age_minutes: ready === null ? null : Math.round((nowMs - ready) / 60_000),
  };
}

function parseLogRows(raw: string): RawLogRow[] {
  const rows: RawLogRow[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      // A partial line at the tail of the stream is normal; skip it.
    }
  }
  return rows;
}

/**
 * A CLI call, off the event loop, with its OWN timeout.
 *
 * `execFileSync` blocks the whole process, which is why the sequential version
 * of this collector took ~17 s for two projects: four calls of ~4 s each, none
 * able to overlap. Running them concurrently needs the async spawn.
 */
async function runCli(
  cli: CliRunner,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return cli(args, timeoutMs);
}

/**
 * Fetch a project's deployment and its log window CONCURRENTLY.
 *
 * The two calls are independent — the log fetch needs a deployment URL, so it
 * is issued after `ls` resolves, but the two PROJECTS overlap fully. With a
 * concurrency cap of 4 (see `VERCEL_MAX_CONCURRENCY`) that keeps the collector
 * bounded whether there are two projects or ten.
 */
async function collectProject(
  entry: TargetProject,
  profile: TargetProfile,
  cli: CliRunner,
  fetchImpl: typeof fetch,
  nowMs: number,
  clock: () => number,
): Promise<VercelProjectResult> {
  const { project, domain, label } = entry;

  // The public domain is probed regardless of how the deployment lookup goes:
  // "the alias answers but the monitor cannot identify the build behind it" is
  // a state worth being able to report.
  const domainProbe = await probeDomain(domain, fetchImpl, clock);

  let deployment: VercelDeployment | null = null;

  try {
    const raw = await runCli(
      cli,
      // `--environment` replaces the hardcoded `--prod`; the profile decides.
      ["ls", project, "--environment", profile.target, "--json", "--limit", "1"],
      VERCEL_CLI_TIMEOUT_MS,
    );
    const parsed = parseCliJson(raw) as { deployments?: Array<Record<string, unknown>> };
    const first = parsed.deployments?.[0];
    if (first) deployment = toDeployment(first, nowMs);
  } catch (error) {
    return {
      project,
      label,
      domain,
      status: "not_observable",
      reason: sanitizeVercelError(error),
    };
  }

  if (deployment) {
    const verdict = validateTargetMatch(deployment, profile);
    if (!verdict.ok) {
      // Stop here: reading logs from the wrong environment would produce
      // numbers labelled with a target they do not belong to.
      return {
        project,
        label,
        domain,
        status: "target_mismatch",
        mismatch: verdict.mismatch,
        domain_probe: domainProbe,
      };
    }
  }

  // Logs are a bonus, not a precondition: a project whose deployment is known
  // is still worth reporting even if the log window cannot be fetched. The log
  // call carries its own timeout, so a slow log stream cannot consume the
  // budget that already produced the deployment.
  let logs: VercelLogSample | null = null;
  let logsError: string | null = null;
  if (deployment) {
    try {
      const raw = await runCli(
        cli,
        ["logs", `https://${deployment.url}`, "--json", "--limit", String(VERCEL_LOG_LIMIT)],
        VERCEL_CLI_TIMEOUT_MS,
      );
      logs = summarizeLogs(parseLogRows(raw));
    } catch (error) {
      logsError = sanitizeVercelError(error);
    }
  }

  return {
    project,
    label,
    domain,
    status: "observable",
    deployment,
    domain_probe: domainProbe,
    logs,
    logs_error: logsError,
  };
}

/** Run `tasks` with at most `limit` in flight. */
export async function withConcurrency<T>(
  limit: number,
  tasks: Array<() => Promise<T>>,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= tasks.length) return;
      try {
        results[index] = { status: "fulfilled", value: await tasks[index]!() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker),
  );
  return results;
}

/**
 * Read the structured error Vercel puts in a non-2xx body.
 *
 * This exists because of a measured failure: the collector used to report only
 * `usage endpoint returned 400` while the body said, verbatim,
 * `Invalid request: missing required property \`from\``. The cause was on the
 * wire the whole time and the monitor threw it away, turning a self-explaining
 * error into three sessions of investigation (audit 2026-08-04).
 *
 * Never throws, never returns a raw body: an HTML gateway page or a
 * five-thousand-character message must not reach the report, and neither must
 * anything token-shaped.
 */
export async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    if (!text) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // HTML or plain text: there is no field worth quoting, and dumping the
      // body would flood the report. The status code alone stands.
      return null;
    }

    const error = (parsed as { error?: unknown })?.error;
    if (!error || typeof error !== "object") return null;

    const { code, message } = error as { code?: unknown; message?: unknown };
    const parts = [
      typeof code === "string" ? code : null,
      typeof message === "string" ? message : null,
    ].filter((p): p is string => Boolean(p));
    if (!parts.length) return null;

    return sanitizeVercelError(parts.join(": ")).slice(0, 200);
  } catch {
    // A body that fails mid-read must not take the run down; the status code
    // is already known and is enough to report.
    return null;
  }
}

/** The team every monitored project lives under. */
export const VERCEL_TEAM_SLUG = "goodwolf";

/**
 * Hourly buckets, fixed — NOT a knob.
 *
 * MEASURED TRAP (2026-08-04): coarse buckets are calendar-aligned and the
 * `summary` sums the WHOLE bucket, including time before `startTime`. Same
 * window, same metric: `{minutes:60}` returned 28,881 invocations and
 * `{hours:24}` returned 53,897 — an 87% overstatement, HTTP 200, no warning.
 * `{hours:24}` is exactly what one would reach for to get "the period total".
 */
export const OBSERVABILITY_GRANULARITY = { minutes: 60 } as const;

const METRIC_INVOCATIONS = "vercel.function_invocation.count";
const METRIC_CPU_MS = "vercel.function_invocation.function_cpu_time_ms";

type BillingWindow = {
  ownerId: string;
  cycleStart: number;
  cycleEnd: number;
};

type UsageFailure = { reason: string; http_status: number | null };

function failure(reason: string, http_status: number | null = null): UsageFailure {
  return { reason, http_status };
}

/**
 * Resolve the team's canonical id and billing cycle.
 *
 * The id matters: the Observability API rejects the slug with
 * `invalid_union_discriminator`, so `ownerId` must be the `team_…` value.
 */
async function resolveTeam(
  token: string,
  fetchImpl: typeof fetch,
): Promise<BillingWindow | UsageFailure> {
  const response = await fetchImpl(
    `https://api.vercel.com/v2/teams/${VERCEL_TEAM_SLUG}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(VERCEL_API_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return failure(
      detail
        ? `team lookup returned ${response.status}: ${detail}`
        : `team lookup returned ${response.status}`,
      response.status,
    );
  }

  const body = (await response.json()) as {
    id?: unknown;
    billing?: { period?: { start?: unknown; end?: unknown } };
  };
  const ownerId = typeof body.id === "string" ? body.id : null;
  const start = body.billing?.period?.start;
  const end = body.billing?.period?.end;

  if (!ownerId || typeof start !== "number" || typeof end !== "number") {
    return failure("team payload carried no id or billing period");
  }
  return { ownerId, cycleStart: start, cycleEnd: end };
}

type SummaryRow = Record<string, unknown>;

/** One metric, grouped by project. Returns the `summary` rows or a failure. */
async function queryMetric(
  token: string,
  fetchImpl: typeof fetch,
  metric: string,
  window: BillingWindow,
  startIso: string,
  endIso: string,
  aggregation?: string,
): Promise<SummaryRow[] | UsageFailure> {
  const response = await fetchImpl(
    `https://api.vercel.com/v2/observability/query?teamId=${VERCEL_TEAM_SLUG}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        metric,
        scope: { type: "owner", ownerId: window.ownerId },
        startTime: startIso,
        endTime: endIso,
        granularity: OBSERVABILITY_GRANULARITY,
        groupBy: ["project_name"],
        ...(aggregation ? { aggregation } : {}),
      }),
      signal: AbortSignal.timeout(VERCEL_API_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return failure(
      detail
        ? `observability query for ${metric} returned ${response.status}: ${detail}`
        : `observability query for ${metric} returned ${response.status}`,
      response.status,
    );
  }

  const body = (await response.json()) as { summary?: unknown };
  return Array.isArray(body.summary) ? (body.summary as SummaryRow[]) : [];
}

function isFailure(value: unknown): value is UsageFailure {
  return Boolean(value) && typeof (value as UsageFailure).reason === "string";
}

/** Fold `summary` rows into project → number, reading the metric's own key. */
function byProjectFrom(rows: SummaryRow[], suffix: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const project = typeof row.project_name === "string" ? row.project_name : null;
    if (!project) continue;
    const key = Object.keys(row).find((k) => k.endsWith(suffix));
    const value = key ? Number(row[key]) : Number.NaN;
    if (!Number.isFinite(value)) continue;
    out.set(project, (out.get(project) ?? 0) + value);
  }
  return out;
}

/**
 * Invocations and Active CPU, from the DOCUMENTED Observability API.
 *
 * `GET /v1/usage` used to be called here. It is absent from Vercel's official
 * OpenAPI spec and rejects every time range tried — including the account's
 * real billing cycle — so it was retired rather than kept as a fallback
 * (audit 2026-08-04).
 */
async function collectUsage(
  token: string | undefined,
  profile: TargetProfile,
  fetchImpl: typeof fetch,
  nowMs: number,
): Promise<VercelUsage> {
  if (!token) {
    return {
      status: "not_observable",
      reason: "VERCEL_TOKEN not configured",
      http_status: null,
    };
  }

  try {
    const window = await resolveTeam(token, fetchImpl);
    if (isFailure(window)) {
      return { status: "not_observable", ...window };
    }

    // The window never runs past the cycle it belongs to, and never past now.
    const startIso = new Date(window.cycleStart).toISOString();
    const endIso = new Date(Math.min(nowMs, window.cycleEnd)).toISOString();

    // Only invocations are queried. The CPU measure is deliberately NOT
    // requested per project — see CPU_PER_PROJECT_UNRELIABLE.
    const invocationRows = await queryMetric(
      token,
      fetchImpl,
      METRIC_INVOCATIONS,
      window,
      startIso,
      endIso,
    );
    if (isFailure(invocationRows)) return { status: "not_observable", ...invocationRows };

    const invocations = byProjectFrom(invocationRows, "_count_sum");

    if (invocations.size === 0) {
      // Absence is not a measured zero. Reporting it as zero would say
      // "nothing ran" about a system that is plainly serving traffic.
      return {
        status: "not_observable",
        reason: "observability returned an empty summary (no rows)",
        http_status: null,
      };
    }

    const inScopeNames = new Set<string>(profile.projects.map((p) => p.project));

    const byProject: ProjectUsage[] = [...inScopeNames].map((project) => ({
      project,
      invocations: invocations.get(project) ?? 0,
      cpu_ms: null,
    }));

    const outOfScopeNames = [...invocations.keys()]
      .filter((project) => !inScopeNames.has(project))
      .sort();

    return {
      status: "observable",
      source: "observability",
      window: { start: startIso, end: endIso, billing_cycle_start: startIso },
      by_project: byProject,
      in_scope_total: {
        invocations: byProject.reduce((sum, p) => sum + p.invocations, 0),
        cpu_ms: null,
      },
      cpu_ms_reason: CPU_PER_PROJECT_UNRELIABLE,
      out_of_scope: {
        projects: outOfScopeNames,
        invocations: outOfScopeNames.reduce(
          (sum, project) => sum + (invocations.get(project) ?? 0),
          0,
        ),
      },
      cpu_percent: null,
    };
  } catch (error) {
    return {
      status: "not_observable",
      reason: sanitizeVercelError(error),
      http_status: null,
    };
  }
}

export async function collectVercel(
  token: string | undefined,
  target: OpsTarget,
  deps: VercelDeps = {},
): Promise<VercelResult> {
  const cli = deps.cli ?? defaultCli;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clock = deps.now ?? Date.now;
  const nowMs = clock();
  const profile = profileFor(target);

  // Projects run concurrently under a hard subprocess cap, and one failing
  // project must not take the other down with it.
  const settled = await withConcurrency(
    VERCEL_MAX_CONCURRENCY,
    profile.projects.map(
      (entry) => () => collectProject(entry, profile, cli, fetchImpl, nowMs, clock),
    ),
  );

  const projects: VercelProjectResult[] = settled.map((outcome, index) => {
    const entry = profile.projects[index]!;
    return outcome.status === "fulfilled"
      ? outcome.value
      : {
          project: entry.project,
          label: entry.label,
          domain: entry.domain,
          status: "not_observable" as const,
          reason: sanitizeVercelError(outcome.reason),
        };
  });

  const usage = await collectUsage(token, profile, fetchImpl, nowMs);

  const notObservable: string[] = [];
  if (usage.status !== "observable") {
    notObservable.push(
      "invocations for the billing period",
      "Fluid Active CPU and quota %",
      "days until CPU exhaustion",
    );
  } else {
    // Invocations are measured now; CPU is not, and neither is the ALLOWANCE
    // that a percentage would need. All three stay listed on a successful run.
    notObservable.push(
      "Fluid Active CPU (per-project attribution is non-deterministic)",
      "Active CPU as a % of the plan quota (no allowance is exposed by any API)",
      "days until CPU exhaustion (depends on the two above)",
    );
  }
  for (const p of projects) {
    if (p.status === "target_mismatch") {
      notObservable.push(`${p.label} deployment (${p.mismatch.reason})`);
    }
  }

  return { target, projects, usage, not_observable: notObservable };
}
