/**
 * Upstash collector — data plane facts, and an honest hole where the quota is.
 *
 * ── The measurement that shapes this file ─────────────────────────────────
 *
 * `INFO` looks like the obvious source for "commands used this period". It is
 * not. Two calls seconds apart, measured while building this, returned:
 *
 *     total_commands_processed :  67.615   then   295.319
 *     used_memory              :  16.355   then    32.685
 *
 * Upstash routes REST calls across nodes and those counters are PER NODE. A
 * percentage derived from them would move by 4x between consecutive snapshots
 * for no reason, and a delta between snapshots would be pure noise. That is
 * worse than a gap: a gap is visibly missing, a wrong number gets acted on.
 *
 * So `INFO` is not read at all here. What IS read:
 *
 *   · `DBSIZE`  — deterministic; the keyspace is global, not per node.
 *   · `PING`    — round-trip latency, measured locally, not self-reported.
 *
 * Everything about the 500 K monthly quota requires the Management API
 * (`UPSTASH_EMAIL` + `UPSTASH_API_KEY`), which is not configured. Without it,
 * commands, percentage, bandwidth and projections are `not_observable`, with
 * the exact panel path to copy them from.
 *
 * ── Secrets ───────────────────────────────────────────────────────────────
 *
 * The REST URL is itself sensitive (it embeds the database identity) and the
 * token more so. Neither is returned, rendered, or included in an error — see
 * `sanitizeUpstashError`, which strips both plus the email.
 */

export const UPSTASH_TIMEOUT_MS = 10_000;
/** Free-tier monthly command allowance, for the renderer to compare against. */
export const UPSTASH_MONTHLY_COMMAND_QUOTA = 500_000;

/**
 * Latency from a small sample, never a single shot.
 *
 * The first PING of a run pays TLS setup and reads far above steady state — 395
 * ms against a ~40 ms warm round trip, measured here. Reporting that one number
 * would make every snapshot look like a latency spike. Median is the headline;
 * p95 is what catches a real tail.
 *
 * This is a health signal only. It is never used as, or converted into, a quota
 * figure — see the module header on why nothing from the data plane can be.
 */
export type UpstashLatency = {
  samples: number[];
  median_ms: number;
  p95_ms: number;
  /** Kept separately so a warm-up outlier is visible rather than averaged away. */
  first_ms: number;
};

export const UPSTASH_LATENCY_SAMPLES = 5;

export type UpstashDataPlane =
  | {
      status: "observable";
      /** Total keys. Global and deterministic, unlike anything from INFO. */
      keys: number;
      latency: UpstashLatency;
    }
  | { status: "not_observable"; reason: string; missing: string[] };

export type UpstashQuota =
  | {
      status: "observable";
      source: "management_api";
      commands_period: number | null;
      quota: number;
      percent_used: number | null;
      bandwidth_bytes: number | null;
    }
  | {
      status: "not_observable";
      reason: string;
      missing: string[];
      http_status: number | null;
      /** Where a human can read this by hand instead. */
      manual_source: string;
    };

export type UpstashResult = {
  data_plane: UpstashDataPlane;
  quota: UpstashQuota;
  not_observable: string[];
};

export type UpstashDeps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/**
 * Strip credentials from an external error. Upstash echoes the endpoint in some
 * failures, and the endpoint identifies the database.
 */
export function sanitizeUpstashError(raw: unknown, secrets: string[] = []): string {
  let text = raw instanceof Error ? raw.message : String(raw);
  for (const secret of secrets) {
    if (secret && secret.length > 3) {
      text = text.split(secret).join("[REDACTED]");
    }
  }
  return text
    .replace(/https:\/\/[a-z0-9-]+\.upstash\.io[^\s"']*/gi, "https://[REDACTED].upstash.io")
    .replace(/Bearer\s+[A-Za-z0-9_=-]+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" | ")
    .slice(0, 200);
}

/**
 * Nearest-rank percentile. No interpolation: with five samples an interpolated
 * p95 would be a number that no request actually took.
 */
export function summarizeLatency(samples: number[]): UpstashLatency {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted.length === 0
      ? 0
      : sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
  return {
    samples,
    median_ms: at(0.5),
    p95_ms: at(0.95),
    first_ms: samples[0] ?? 0,
  };
}

async function restCommand(
  url: string,
  token: string,
  command: string[],
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`REST command ${command[0]} returned ${response.status}`);
  }

  const body = (await response.json()) as { result?: unknown; error?: unknown };
  if (body.error) throw new Error(`REST error: ${String(body.error)}`);
  return body.result;
}

async function collectDataPlane(
  url: string | undefined,
  token: string | undefined,
  fetchImpl: typeof fetch,
  clock: () => number,
  /** EVERY known secret, not just this path's. See `collectUpstash`. */
  allSecrets: string[],
): Promise<UpstashDataPlane> {
  const missing: string[] = [];
  if (!url) missing.push("UPSTASH_REDIS_REST_URL");
  if (!token) missing.push("UPSTASH_REDIS_REST_TOKEN");
  if (missing.length > 0) {
    return { status: "not_observable", reason: "credentials not configured", missing };
  }

  try {
    // A small PING sample. Sequential on purpose: parallel requests would
    // measure our own concurrency, not the service's round trip.
    const samples: number[] = [];
    for (let i = 0; i < UPSTASH_LATENCY_SAMPLES; i++) {
      const startedAt = clock();
      await restCommand(url!, token!, ["PING"], fetchImpl);
      samples.push(clock() - startedAt);
    }

    const dbsize = await restCommand(url!, token!, ["DBSIZE"], fetchImpl);
    if (typeof dbsize !== "number") {
      return {
        status: "not_observable",
        reason: "DBSIZE returned a non-numeric payload",
        missing: [],
      };
    }

    return { status: "observable", keys: dbsize, latency: summarizeLatency(samples) };
  } catch (error) {
    return {
      status: "not_observable",
      reason: sanitizeUpstashError(error, allSecrets),
      missing: [],
    };
  }
}

const MANUAL_QUOTA_SOURCE =
  "Upstash Console → your database → Usage → Commands (period) and Bandwidth";

/**
 * Monthly commands and quota. The Management API is the ONLY trustworthy
 * source; see the module header on why `INFO` is not an acceptable substitute.
 */
async function collectQuota(
  email: string | undefined,
  apiKey: string | undefined,
  fetchImpl: typeof fetch,
  /** EVERY known secret, not just this path's. See `collectUpstash`. */
  allSecrets: string[],
): Promise<UpstashQuota> {
  const missing: string[] = [];
  if (!email) missing.push("UPSTASH_EMAIL");
  if (!apiKey) missing.push("UPSTASH_API_KEY");
  if (missing.length > 0) {
    return {
      status: "not_observable",
      reason: "Management API credentials not configured",
      missing,
      http_status: null,
      manual_source: MANUAL_QUOTA_SOURCE,
    };
  }

  const auth = Buffer.from(`${email}:${apiKey}`).toString("base64");
  try {
    const response = await fetchImpl("https://api.upstash.com/v2/redis/databases", {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        status: "not_observable",
        reason: `management API returned ${response.status}`,
        missing: [],
        http_status: response.status,
        manual_source: MANUAL_QUOTA_SOURCE,
      };
    }

    const body = (await response.json()) as Array<Record<string, unknown>>;
    const database = Array.isArray(body) ? body[0] : undefined;
    if (!database) {
      return {
        status: "not_observable",
        reason: "management API returned no databases",
        missing: [],
        http_status: response.status,
        manual_source: MANUAL_QUOTA_SOURCE,
      };
    }

    const commands =
      typeof database.daily_requests === "number"
        ? database.daily_requests
        : typeof database.monthly_requests === "number"
          ? database.monthly_requests
          : null;
    const bandwidth =
      typeof database.monthly_bandwidth === "number" ? database.monthly_bandwidth : null;

    return {
      status: "observable",
      source: "management_api",
      commands_period: commands,
      quota: UPSTASH_MONTHLY_COMMAND_QUOTA,
      percent_used:
        commands === null
          ? null
          : Math.round((commands / UPSTASH_MONTHLY_COMMAND_QUOTA) * 1000) / 10,
      bandwidth_bytes: bandwidth,
    };
  } catch (error) {
    return {
      status: "not_observable",
      reason: sanitizeUpstashError(error, allSecrets),
      missing: [],
      http_status: null,
      manual_source: MANUAL_QUOTA_SOURCE,
    };
  }
}

export async function collectUpstash(
  credentials: {
    restUrl?: string;
    restToken?: string;
    email?: string;
    apiKey?: string;
  },
  deps: UpstashDeps = {},
): Promise<UpstashResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clock = deps.now ?? Date.now;

  // Redaction takes the FULL set, not each path's own. An error raised on one
  // path can quote a credential belonging to the other — a test caught exactly
  // that — and "this secret cannot appear here" is not an assumption a monitor
  // should carry when the cost of being wrong is a leaked key in a report.
  const allSecrets = [
    credentials.restUrl,
    credentials.restToken,
    credentials.email,
    credentials.apiKey,
  ].filter((v): v is string => Boolean(v));

  // Independent: a dead data plane must not hide the quota, or vice versa.
  const [dataPlane, quota] = await Promise.all([
    collectDataPlane(credentials.restUrl, credentials.restToken, fetchImpl, clock, allSecrets),
    collectQuota(credentials.email, credentials.apiKey, fetchImpl, allSecrets),
  ]);

  const notObservable: string[] = [];
  if (quota.status !== "observable") {
    notObservable.push(
      "commands used this period",
      "percentage of the 500K quota",
      "bandwidth",
      "projection to quota exhaustion (1h / 6h / 24h)",
    );
  }
  // True regardless of credentials: the REST API exposes no time series.
  notObservable.push("commands per hour/day (no time series in the REST API)");

  return { data_plane: dataPlane, quota, not_observable: notObservable };
}
