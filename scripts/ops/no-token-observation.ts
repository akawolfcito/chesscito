/**
 * `pnpm ops:no-token` — the daily read of the PRO balance-read observation window.
 *
 * Answers one question and refuses to answer more: **what is the `no-token` gate
 * actually seeing?** Read-only, no writes, no identifiers in the output.
 *
 *   pnpm ops:no-token                  # default 1s dedup window
 *   pnpm ops:no-token --window 5       # widen the burst window
 *   pnpm ops:no-token --target 200     # change the observation threshold
 *
 * ⚠️ **Raw rows are not attempts.** Production emits bursts: on 2026-08-17 one
 * wallet produced three rows sharing `created_at` to the MICROSECOND — one batch
 * insert, not three instants. Counting rows would inflate every rate computed
 * here. So this tool always reports rows, deduplicated attempts and wallets
 * side by side, and prints the window it used. The window is a DECLARED choice,
 * never a silent one.
 *
 * ⛔ It reports; it does not recommend. The decision table lives in
 * `docs/plans/2026-08-16-evidence-instrumentation-execution-plan.md`, and what
 * to do at the threshold is the founder's call, not this script's.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadOpsEnv, parseSupabaseRef } from "./lib/env";
import { assertReadOnlySql } from "./lib/read-only-guard";
import { childEnv } from "./lib/child-env";

const POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com";
const POOLER_PORT = 5432;
const DOCKER_PG_IMAGE = "postgres:16-alpine";
const TIMEOUT_MS = 60_000;

/** §11.1 of the evidence pass: the n at which the window can be read. */
const DEFAULT_TARGET = 200;
/** Bursts observed so far share a timestamp to the microsecond, so one second
 *  already merges them. Kept as a flag because the right window is an empirical
 *  question and this tool must not decide it quietly. */
const DEFAULT_WINDOW_SECONDS = 1;

export type AttemptRow = {
  /** md5-truncated wallet. Pairable across runs, identifies nobody. */
  row_tag: string;
  at: string;
  raw_rows: number;
  /** How many DIFFERENT read combinations the dedup window swallowed. >1 means
   *  the window merged attempts that were not the same observation. */
  distinct_combos: number;
  read_usdc: string | null;
  read_usdt: string | null;
  read_cusd: string | null;
};

export type Outcome =
  | "payable_blocked"
  | "any_failure"
  | "all_absent"
  | "all_success_under"
  | "mixed_other";

const OUTCOME_LABEL: Record<Outcome, string> = {
  payable_blocked: "any payable but blocked  ⛔ P0",
  any_failure: "any read failure",
  all_absent: "all reads absent",
  all_success_under: "read fine, under price",
  mixed_other: "mixed / other",
};

/** A key that never arrived is `absent`: the read did not land, and calling that
 *  a zero balance is exactly the confusion this instrumentation removed. */
function valueOf(raw: string | null): string {
  return raw ?? "absent";
}

/**
 * Precedence, and why each step outranks the next:
 *  1. `payable` while blocked is a CORRECTNESS bug and must never hide inside
 *     an aggregate.
 *  2. A failure names a cause (transport); an absent names a timing. Different
 *     answers, so a failure is not allowed to be swallowed by an absent.
 *  3. All-absent and all-read are the two clean readings.
 *  4. Everything else stays `mixed_other` ON PURPOSE — collapsing a mixed state
 *     into a neighbour is how a distribution starts lying.
 */
export function classifyAttempt(row: AttemptRow): Outcome {
  const values = [valueOf(row.read_usdc), valueOf(row.read_usdt), valueOf(row.read_cusd)];
  if (values.some((v) => v === "success:payable")) return "payable_blocked";
  if (values.some((v) => v === "failure")) return "any_failure";
  if (values.every((v) => v === "absent")) return "all_absent";
  if (values.every((v) => v.startsWith("success:"))) return "all_success_under";
  return "mixed_other";
}

export type OutcomeSummary = {
  outcome: Outcome;
  label: string;
  rawRows: number;
  attempts: number;
  wallets: number;
  pctAttempts: number;
};

export type Summary = {
  rawRows: number;
  attempts: number;
  wallets: number;
  outcomes: OutcomeSummary[];
  payableBlocked: number;
  /** Attempts whose burst contained more than one read combination. */
  suspiciousMerges: number;
  /** The outcome above half the attempts, or `null`. Half is a threshold, not a
   *  verdict: it says "this is what the gate mostly sees", nothing more. */
  dominant: Outcome | null;
};

export function summarize(rows: readonly AttemptRow[]): Summary {
  const byOutcome = new Map<Outcome, { raw: number; attempts: number; wallets: Set<string> }>();
  const wallets = new Set<string>();
  let rawRows = 0;
  let suspiciousMerges = 0;

  for (const row of rows) {
    const outcome = classifyAttempt(row);
    const bucket = byOutcome.get(outcome) ?? { raw: 0, attempts: 0, wallets: new Set<string>() };
    bucket.raw += row.raw_rows;
    bucket.attempts += 1;
    bucket.wallets.add(row.row_tag);
    byOutcome.set(outcome, bucket);
    wallets.add(row.row_tag);
    rawRows += row.raw_rows;
    if (row.distinct_combos > 1) suspiciousMerges += 1;
  }

  const attempts = rows.length;
  const outcomes: OutcomeSummary[] = [...byOutcome.entries()]
    .map(([outcome, b]) => ({
      outcome,
      label: OUTCOME_LABEL[outcome],
      rawRows: b.raw,
      attempts: b.attempts,
      wallets: b.wallets.size,
      pctAttempts: attempts === 0 ? 0 : Math.round((b.attempts / attempts) * 1000) / 10,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const top = outcomes[0];
  return {
    rawRows,
    attempts,
    wallets: wallets.size,
    outcomes,
    payableBlocked: byOutcome.get("payable_blocked")?.attempts ?? 0,
    suspiciousMerges,
    dominant: top && attempts > 0 && top.attempts / attempts > 0.5 ? top.outcome : null,
  };
}

export type Combination = {
  read_usdc: string;
  read_usdt: string;
  read_cusd: string;
  attempts: number;
};

export function topCombinations(rows: readonly AttemptRow[], limit: number): Combination[] {
  const counts = new Map<string, Combination>();
  for (const row of rows) {
    const combo = {
      read_usdc: valueOf(row.read_usdc),
      read_usdt: valueOf(row.read_usdt),
      read_cusd: valueOf(row.read_cusd),
    };
    const key = `${combo.read_usdc}|${combo.read_usdt}|${combo.read_cusd}`;
    const hit = counts.get(key);
    if (hit) hit.attempts += 1;
    else counts.set(key, { ...combo, attempts: 1 });
  }
  return [...counts.values()].sort((a, b) => b.attempts - a.attempts).slice(0, limit);
}

/**
 * One statement, SELECT-shaped, guarded by the same function the health monitor
 * uses. Rows are selected by the PRESENCE of `read_usdc` rather than by a
 * hardcoded deploy date: the pre-instrumentation build never emitted that key,
 * so it cannot dilute the denominator and nobody has to maintain a timestamp.
 */
export function buildObservationSql(windowSeconds: number): string {
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    throw new Error(`dedup window must be a positive number of seconds, got ${windowSeconds}`);
  }
  return `WITH ev AS (
  SELECT
    left(md5(coalesce(account_ref, 'anon')), 8) AS row_tag,
    created_at,
    props->>'read_usdc' AS u,
    props->>'read_usdt' AS t,
    props->>'read_cusd' AS c
  FROM analytics_events
  WHERE event = 'pro_purchase_failed'
    AND props->>'kind' = 'no-token'
    AND props ? 'read_usdc'
), att AS (
  SELECT
    row_tag,
    floor(extract(epoch FROM created_at) / ${windowSeconds}) AS win,
    min(created_at) AS at,
    count(*) AS raw_rows,
    count(DISTINCT concat_ws('|', u, t, c)) AS distinct_combos,
    min(u) AS read_usdc,
    min(t) AS read_usdt,
    min(c) AS read_cusd
  FROM ev
  GROUP BY 1, 2
)
SELECT coalesce(json_agg(json_build_object(
  'row_tag', row_tag,
  'at', at,
  'raw_rows', raw_rows,
  'distinct_combos', distinct_combos,
  'read_usdc', read_usdc,
  'read_usdt', read_usdt,
  'read_cusd', read_cusd
) ORDER BY at), '[]'::json)::text AS payload
FROM att`;
}

function runQuery(sql: string): string {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const env = loadOpsEnv(repoRoot);
  const ref = parseSupabaseRef(env.get("SUPABASE_URL"));
  if (!env.has("SUPABASE_DB_PASSWORD") || !ref) {
    throw new Error("missing credentials: need SUPABASE_URL (parseable) + SUPABASE_DB_PASSWORD");
  }
  const password = encodeURIComponent(env.get("SUPABASE_DB_PASSWORD")!);
  const conn =
    `postgresql://postgres.${ref}:${password}` +
    `@${POOLER_HOST}:${POOLER_PORT}/postgres?sslmode=require`;

  return execFileSync(
    "docker",
    [
      "run", "--rm", "-i",
      // ⛔ Names only. This comment used to say the values "never travel in
      // argv" while `-e NAME=value` put them there — see lib/child-env.ts.
      "-e", "PGCONN",
      "-e", "PGQUERY",
      DOCKER_PG_IMAGE,
      "sh", "-c",
      // `-q` so the read-only preamble does not echo "SET" ahead of the JSON.
      'printf %s "$PGQUERY" | psql "$PGCONN" -q -v ON_ERROR_STOP=1 -t -A -f -',
    ],
    {
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv({
        PGCONN: conn,
        PGQUERY: `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;\n${sql}`,
      }),
    },
  );
}

function pad(value: string | number, width: number): string {
  return String(value).padStart(width);
}

export function renderReport(
  rows: readonly AttemptRow[],
  windowSeconds: number,
  target: number,
): string {
  const s = summarize(rows);
  const out: string[] = [];

  out.push("");
  out.push("PRO no-token — observation window");
  out.push(`dedup rule: same wallet + same event within ${windowSeconds}s = ONE attempt`);
  out.push("");
  out.push(`progress: ${s.attempts} / ${target} attempts   (${s.rawRows} raw rows, ${s.wallets} wallets)`);
  if (s.attempts < target) {
    out.push(`           ⏳ below threshold — collecting, no reading yet`);
  } else {
    out.push(`           ✅ threshold reached — bring the evidence to the founder`);
  }
  out.push("");

  out.push("| outcome                      | raw | attempts | wallets |    % |");
  out.push("|------------------------------|----:|---------:|--------:|-----:|");
  for (const o of s.outcomes) {
    out.push(
      `| ${o.label.padEnd(28)} | ${pad(o.rawRows, 3)} | ${pad(o.attempts, 8)} | ${pad(o.wallets, 7)} | ${pad(o.pctAttempts, 4)} |`,
    );
  }
  if (s.outcomes.length === 0) out.push("| (no observations yet)        |   0 |        0 |       0 |    0 |");
  out.push("");

  out.push("TOP READ COMBINATIONS");
  out.push("| read_usdc            | read_usdt            | read_cusd            | attempts |");
  out.push("|----------------------|----------------------|----------------------|---------:|");
  for (const c of topCombinations(rows, 8)) {
    out.push(
      `| ${c.read_usdc.padEnd(20)} | ${c.read_usdt.padEnd(20)} | ${c.read_cusd.padEnd(20)} | ${pad(c.attempts, 8)} |`,
    );
  }
  out.push("");

  const pct = (o: Outcome) => s.outcomes.find((x) => x.outcome === o)?.pctAttempts ?? 0;
  const verdict = (label: string, answer: string) => out.push(`${label.padEnd(38)} ${answer}`);

  out.push("READINGS");
  verdict(
    "WHAT THE NO-TOKEN GATE IS SEEING",
    s.dominant ? OUTCOME_LABEL[s.dominant] : "no single outcome above half — mixed",
  );
  verdict("ABSENT DOMINATES?", s.dominant === "all_absent" ? `YES (${pct("all_absent")}%)` : `no (${pct("all_absent")}%)`);
  verdict("RPC FAILURE DOMINATES?", s.dominant === "any_failure" ? `YES (${pct("any_failure")}%)` : `no (${pct("any_failure")}%)`);
  verdict(
    "REAL LOW BALANCE DOMINATES?",
    s.dominant === "all_success_under" ? `YES (${pct("all_success_under")}%)` : `no (${pct("all_success_under")}%)`,
  );
  verdict(
    "ANY PAYABLE USER BLOCKED?",
    s.payableBlocked > 0 ? `⛔ YES — ${s.payableBlocked} attempt(s). CORRECTNESS P0, report now` : "no",
  );
  out.push("");

  if (s.suspiciousMerges > 0) {
    out.push(
      `⚠️  ${s.suspiciousMerges} attempt(s) merged rows with DIFFERENT reads — the ${windowSeconds}s window may be too wide. Re-run with --window 1.`,
    );
    out.push("");
  }
  out.push("⛔ This tool reports. It does not recommend, and it changes nothing.");
  out.push("");
  return out.join("\n");
}

export function main(argv: readonly string[]): number {
  const flag = (name: string, fallback: number) => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return fallback;
    const parsed = Number(argv[i + 1]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const windowSeconds = flag("window", DEFAULT_WINDOW_SECONDS);
  const target = flag("target", DEFAULT_TARGET);

  try {
    const sql = assertReadOnlySql(buildObservationSql(windowSeconds));
    // Last non-empty line: belt and braces against any banner psql may print
    // ahead of the payload. The query returns exactly one row, one column.
    const payload =
      runQuery(sql)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .pop() ?? "[]";
    const rows = JSON.parse(payload) as AttemptRow[];
    process.stdout.write(renderReport(rows, windowSeconds, target));
    return 0;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    console.error(
      text
        .replace(/postgresql:\/\/[^\s"']+/gi, "postgresql://[REDACTED]")
        .replace(/password=[^\s"'&]+/gi, "password=[REDACTED]")
        .slice(0, 800),
    );
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
