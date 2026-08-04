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

import { execFileSync } from "node:child_process";

export const VERCEL_PROJECTS = ["chesscito", "lite-chesscito"] as const;
export type VercelProjectName = (typeof VERCEL_PROJECTS)[number];

export const VERCEL_CLI_TIMEOUT_MS = 25_000;
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

export type VercelProjectResult =
  | {
      project: VercelProjectName;
      status: "observable";
      deployment: VercelDeployment | null;
      logs: VercelLogSample | null;
      logs_error: string | null;
    }
  | {
      project: VercelProjectName;
      status: "not_observable";
      reason: string;
    };

export type VercelUsage =
  | { status: "observable"; source: "rest"; data: Record<string, unknown> }
  | { status: "not_observable"; reason: string; http_status: number | null };

export type VercelResult = {
  projects: VercelProjectResult[];
  /** Invocations + Active CPU. See the module header on why this is separate. */
  usage: VercelUsage;
  /** Always present: no derivation from logs to these exists. */
  not_observable: string[];
};

export type VercelDeps = {
  /** Injected so tests never shell out. Returns stdout. */
  cli?: (args: string[], timeoutMs: number) => string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

function defaultCli(args: string[], timeoutMs: number): string {
  return execFileSync("vercel", args, {
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["pipe", "pipe", "pipe"],
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

function toDeployment(raw: Record<string, unknown>, nowMs: number): VercelDeployment {
  const meta = (raw.meta ?? {}) as Record<string, unknown>;
  const ready = typeof raw.ready === "number" ? raw.ready : null;
  return {
    url: typeof raw.url === "string" ? raw.url : "unknown",
    state: typeof raw.state === "string" ? raw.state : "unknown",
    target: typeof raw.target === "string" ? raw.target : null,
    commit_sha: typeof meta.githubCommitSha === "string" ? meta.githubCommitSha : null,
    commit_ref: typeof meta.githubCommitRef === "string" ? meta.githubCommitRef : null,
    ready_at: ready === null ? null : new Date(ready).toISOString(),
    age_minutes: ready === null ? null : Math.round((nowMs - ready) / 60_000),
  };
}

async function collectProject(
  project: VercelProjectName,
  cli: (args: string[], timeoutMs: number) => string,
  nowMs: number,
): Promise<VercelProjectResult> {
  let deployment: VercelDeployment | null = null;

  try {
    const raw = cli(
      ["ls", project, "--prod", "--json", "--limit", "1"],
      VERCEL_CLI_TIMEOUT_MS,
    );
    const parsed = parseCliJson(raw) as { deployments?: Array<Record<string, unknown>> };
    const first = parsed.deployments?.[0];
    if (first) deployment = toDeployment(first, nowMs);
  } catch (error) {
    return {
      project,
      status: "not_observable",
      reason: sanitizeVercelError(error),
    };
  }

  // Logs are a bonus, not a precondition: a project whose deployment is known
  // is still worth reporting even if the log window cannot be fetched.
  let logs: VercelLogSample | null = null;
  let logsError: string | null = null;
  if (deployment) {
    try {
      const raw = cli(
        ["logs", `https://${deployment.url}`, "--json", "--limit", String(VERCEL_LOG_LIMIT)],
        VERCEL_CLI_TIMEOUT_MS,
      );
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
      logs = summarizeLogs(rows);
    } catch (error) {
      logsError = sanitizeVercelError(error);
    }
  }

  return { project, status: "observable", deployment, logs, logs_error: logsError };
}

/**
 * Billing usage. Reports the real HTTP status when the call is refused, because
 * "403 on this plan" and "401 bad token" need different fixes and a generic
 * "not available" hides which one it is.
 */
async function collectUsage(
  token: string | undefined,
  fetchImpl: typeof fetch,
): Promise<VercelUsage> {
  if (!token) {
    return {
      status: "not_observable",
      reason: "VERCEL_TOKEN not configured",
      http_status: null,
    };
  }

  try {
    const response = await fetchImpl("https://api.vercel.com/v1/usage", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(VERCEL_API_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        status: "not_observable",
        reason: `usage endpoint returned ${response.status}`,
        http_status: response.status,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    return { status: "observable", source: "rest", data };
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
  deps: VercelDeps = {},
): Promise<VercelResult> {
  const cli = deps.cli ?? defaultCli;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const nowMs = (deps.now ?? Date.now)();

  // One failing project must not take the other down with it.
  const settled = await Promise.allSettled(
    VERCEL_PROJECTS.map((project) => collectProject(project, cli, nowMs)),
  );

  const projects: VercelProjectResult[] = settled.map((outcome, index) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : {
          project: VERCEL_PROJECTS[index]!,
          status: "not_observable" as const,
          reason: sanitizeVercelError(outcome.reason),
        },
  );

  const usage = await collectUsage(token, fetchImpl);

  const notObservable: string[] = [];
  if (usage.status !== "observable") {
    notObservable.push(
      "invocations for the billing period",
      "Fluid Active CPU and quota %",
      "days until CPU exhaustion",
    );
  }

  return { projects, usage, not_observable: notObservable };
}
