/**
 * Launch health snapshot — one read-only pass over Supabase, Vercel and Upstash.
 *
 * Usage:  pnpm ops:health
 *
 * Exit codes:
 *   0  green     · 1  yellow     · 2  red
 *   3  the MONITOR failed — distinct from red on purpose. "I could not measure"
 *      and "the system is on fire" call for different reactions, and collapsing
 *      them teaches the reader to ignore both.
 *
 * ⚠️ `pnpm run` COLLAPSES every non-zero exit to 1. Measured: this file exits 3
 * on a bad `--target`, `pnpm -C apps/web exec …` preserves the 3, and
 * `pnpm ops:health` turns it into a 1. So the convenience scripts distinguish
 * only success from failure. Automation that needs 1 vs 2 vs 3 must invoke the
 * script directly:
 *
 *     pnpm -C apps/web exec tsx ../../scripts/ops/launch-health-snapshot.ts
 *
 * The human-readable verdict is unaffected — it is printed either way.
 *
 * Read-only throughout: no writes, no DDL, no config changes, no infrastructure
 * touched. Every SQL statement passes `assertReadOnlySql` before execution.
 */

import { collectSupabase } from "./collectors/supabase";
import type { DomainProbe } from "./collectors/vercel";
import { collectUpstash } from "./collectors/upstash";
import { collectVercel } from "./collectors/vercel";
import { classify, exitCodeFor, type ClassifyInput } from "./lib/classify";
import {
  cumulativeDelta,
  eventsPerRequest,
  hoursToExhaustion,
  pointDelta,
  project,
  sizeModel,
  type Projection,
} from "./lib/derive";
import { loadOpsEnv, type OpsEnv } from "./lib/env";
import { InvalidTargetError, parseTarget, type OpsTarget } from "./lib/target";
import {
  assertNoSecrets,
  formatBytes,
  formatCount,
  formatDelta,
  formatLocal,
  renderConsole,
  renderMarkdown,
  type NotObservableEntry,
  type ReportModel,
} from "./lib/render";
import {
  SNAPSHOT_SCHEMA_VERSION,
  checkCompatibility,
  elapsedMinutes,
  readLatest,
  snapshotStamp,
  writeSnapshot,
  type SnapshotEnvelope,
} from "./lib/snapshot-store";

const REPO_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

type SupabaseResult = Awaited<ReturnType<typeof collectSupabase>>;
type VercelResult = Awaited<ReturnType<typeof collectVercel>>;
type UpstashResult = Awaited<ReturnType<typeof collectUpstash>>;

/** Projections from EVERY window plus the observed peak, never one blended rate. */
function buildProjections(supabase: SupabaseResult): Projection[] {
  if (supabase.status !== "observable") return [];
  const model = sizeModel(supabase.analytics.total_bytes, supabase.analytics.row_count);
  if (!model) return [];

  const out: Projection[] = [];
  for (const [name, w] of Object.entries(supabase.ingest_windows)) {
    const p = project(name, w.events, w.minutes, model);
    if (p) out.push(p);
  }
  // The peak is what capacity should be sized against, so it is projected too
  // — labelled as the peak, not folded into an average with the quiet hours.
  const peak = supabase.peaks.busiest_day;
  if (peak) {
    const p = project("peak_day", peak.events, 1_440, model);
    if (p) out.push(p);
  }
  return out;
}

/**
 * The score-save pair, read together.
 *
 * ⛔ NEVER REPORT `failed` ALONE. On its own, a collapse is ambiguous: either
 * the 2026-08-25 split worked (`session_required` moved to `deferred`), or
 * saves stopped being attempted at all. Only the second number separates a fix
 * from an outage, so both are printed on one line even when one is zero.
 *
 * ⚠️ A MISSING KEY IS A REAL ZERO, NOT UNKNOWN. Postgres omits a group with no
 * rows, so `score_save_deferred` is simply absent while nothing defers. It is
 * rendered as `0`, and the empty case gets its own wording — printing "0 · 0"
 * for a window with no data at all would read as a measured calm.
 */
export function formatScoreSaves(
  saves: Partial<Record<"score_save_failed" | "score_save_deferred", number>>
    | undefined,
): string {
  const failed = saves?.score_save_failed ?? 0;
  const deferred = saves?.score_save_deferred ?? 0;

  if (failed === 0 && deferred === 0) {
    return "guardado de score 24h: sin eventos de fallo ni de aplazado";
  }

  // The ratio is what the 2026-08-25 change predicted would move: ~96% of the
  // old `failed` volume was `session_required`, which is now `deferred`.
  const share = Math.round((deferred / (failed + deferred)) * 100);
  return (
    `guardado de score 24h: fallo=${formatCount(failed)} · ` +
    `aplazado=${formatCount(deferred)} (${share}% del total es aplazado, no fallo)`
  );
}

function supabaseSection(supabase: SupabaseResult, projections: Projection[]) {
  if (supabase.status !== "observable") {
    return {
      title: "SUPABASE  ⚠️ SHARED DATABASE",
      status: "not observable",
      lines: [`no se pudo medir: ${supabase.reason}`],
    };
  }

  const a = supabase.analytics;
  const lines: string[] = [
    `now() responde en ${supabase.latency_ms} ms · PostgreSQL ${supabase.server_version}`,
    `base ${formatBytes(supabase.db_size_bytes)} · analytics ${formatBytes(a.heap_bytes)} heap + ${formatBytes(a.index_bytes)} índices`,
    `filas ${formatCount(a.row_count)} · ventana retenida desde ${String(a.oldest).slice(0, 10)}`,
  ];

  lines.push("ritmo instantáneo por ventana (sin extrapolar a un régimen):");
  for (const [name, w] of Object.entries(supabase.ingest_windows)) {
    const perMin = (w.events / w.minutes).toFixed(1);
    lines.push(`   ${name.padEnd(9)} ${formatCount(w.events).padStart(8)} ev · ${formatCount(w.sessions).padStart(5)} ses · ${perMin} ev/min`);
  }

  const peak = supabase.peaks.busiest_day;
  if (peak) {
    lines.push(`pico observado: ${peak.day} → ${formatCount(peak.events)} ev / ${formatCount(peak.sessions)} ses`);
  }

  lines.push("proyección física (una por ventana — difieren por diseño):");
  for (const p of projections) {
    lines.push(`   ${p.window.padEnd(9)} ${formatCount(p.rows_per_day).padStart(8)} filas/día → 30d ${formatBytes(p.bytes_at_30d)} · 45d ${formatBytes(p.bytes_at_45d)} · 90d ${formatBytes(p.bytes_at_90d)}`);
  }

  const today = supabase.daily[0];
  if (today) {
    lines.push(`eventos/sesión (${today.day}): ${today.events_per_session ?? "—"}`);
  }

  const ss = supabase.session_stats_24h;
  if (ss && ss.p95_events !== null) {
    // The population size travels with the percentile on purpose: a p95 is
    // only readable next to the n it came from.
    lines.push(
      `distribución 24h · p50 ${ss.p50_events ?? "—"} · p95 ${ss.p95_events} · máx ${ss.max_events ?? "—"} ` +
        `(población completa: ${formatCount(ss.session_count)} sesiones)`,
    );
  } else {
    lines.push("distribución de eventos por sesión: NO OBSERVABLE");
  }
  const job = supabase.cron_jobs?.[0];
  if (job) {
    lines.push(`cron poda: ${String(job.jobname)} · ${String(job.schedule)} · ${job.active ? "activo" : "INACTIVO"} · ${supabase.cron_runs?.length ?? 0} corridas registradas`);
  }
  lines.push(`autovacuum: n_live ${formatCount(Number(supabase.table_stats?.n_live_tup ?? 0))} · n_dead ${formatCount(Number(supabase.table_stats?.n_dead_tup ?? 0))}`);
  lines.push(`conexiones: ${supabase.connections?.active ?? "—"} activas / ${supabase.connections?.idle ?? "—"} idle`);
  lines.push(`top eventos 24h: ${supabase.top_events_24h.slice(0, 3).map((e) => `${e.event}=${formatCount(e.events)}`).join(" · ")}`);
  lines.push(formatScoreSaves(supabase.score_saves_24h));
  if (supabase.degraded_blocks.length > 0) {
    lines.push(`bloques no disponibles en este servidor: ${supabase.degraded_blocks.join(", ")}`);
  }

  return {
    title: "SUPABASE  ⚠️ SHARED DATABASE",
    status: "observable · compartida entre production y preview",
    lines: [
      "⚠️ Esta base NO se separa por target: production y preview escriben en la MISMA.",
      "   Filas, ritmo y proyecciones de abajo son la SUMA de los dos entornos y no",
      "   son atribuibles a uno solo.",
      ...lines,
    ],
  };
}

/** The public domain probe, rendered separately from the deployment. */
function domainLine(probe: DomainProbe): string {
  if (probe.status !== "observable") {
    return `   dominio    ${probe.domain} · NO RESPONDE — ${probe.reason}`;
  }
  const mark = probe.healthy ? "✓" : "✗";
  const redirect = probe.redirected ? ` → ${probe.final_url}` : "";
  return `   dominio    ${probe.domain} · HTTP ${probe.http_status} ${mark} · ${probe.latency_ms} ms${redirect}`;
}

function vercelSection(vercel: VercelResult, supabase: SupabaseResult) {
  const lines: string[] = [];

  for (const p of vercel.projects) {
    if (p.status === "not_observable") {
      lines.push(`${p.label} · ${p.domain}: no observable — ${p.reason}`);
      continue;
    }

    if (p.status === "target_mismatch") {
      // Not a warning about the system: the monitor could not find what it was
      // told to look at. Both sides are printed so the reader can see which
      // signal disagreed.
      const m = p.mismatch;
      lines.push(`${p.label} · ${p.domain}`);
      lines.push(`   ⛔ TARGET MISMATCH — deployment NO corresponde al perfil pedido`);
      lines.push(`      esperado : target=${m.expected_target} ref=${m.expected_ref}`);
      lines.push(`      recibido : target=${m.actual_target ?? "?"} ref=${m.actual_ref ?? "?"}`);
      lines.push(domainLine(p.domain_probe));
      continue;
    }

    const d = p.deployment;
    lines.push(`${p.label} · ${p.domain}`);
    lines.push(domainLine(p.domain_probe));
    lines.push(`   deployment ${d?.url ?? "?"}`);
    lines.push(`   target     ${d?.target ?? "?"} ✓ · ref ${d?.commit_ref ?? "?"} ✓`);
    lines.push(`   commit     ${d?.commit_sha?.slice(0, 12) ?? "?"} · ${d?.state} · hace ${d?.age_minutes ?? "?"} min`);

    if (p.logs) {
      const l = p.logs;
      lines.push(`   muestra de logs: ${l.requests} requests (de ${l.raw_rows} filas crudas) en ${l.window_seconds}s`);
      const errs = l.by_route.filter((r) => r.errors_5xx > 0);
      lines.push(`   5XX por ruta: ${errs.length ? errs.map((r) => `${r.route}=${r.errors_5xx}`).join(" · ") : "ninguno"}`);
      lines.push(`   /api/telemetry: ${l.telemetry.requests} req · ${l.telemetry.errors_5xx} err`);
    } else {
      lines.push(`   logs no disponibles${p.logs_error ? ` — ${p.logs_error}` : ""}`);
    }
  }

  const usage = vercel.usage;
  if (usage.status === "observable") {
    lines.push(
      `consumo (Observability) · ventana ${usage.window.start} → ${usage.window.end}`,
    );
    lines.push(`   ciclo de facturación desde ${usage.window.billing_cycle_start}`);
    for (const p of usage.by_project) {
      lines.push(`   ${p.project}: ${formatCount(p.invocations)} invocaciones`);
    }
    lines.push(
      `   TOTAL in-scope: ${formatCount(usage.in_scope_total.invocations)} invocaciones`,
    );
    // Printed separately and never added in: the team runs projects the
    // monitor deliberately excludes (chesscito-landing among them), and
    // folding them into the total would inflate Chesscito's consumption.
    lines.push(
      usage.out_of_scope.projects.length
        ? `   fuera de alcance (NO sumado): ${usage.out_of_scope.projects.join(", ")} — ${formatCount(usage.out_of_scope.invocations)} invocaciones`
        : "   fuera de alcance: ninguno",
    );
    lines.push(
      "   ⚠️ es consumo POR PROYECTO, no separado por environment: production y preview comparten nombre de proyecto",
    );
    lines.push(`   ${usage.cpu_ms_reason}`);
    lines.push("   % de cuota y días hasta agotamiento: NO OBSERVABLE — ninguna API expone lo incluido en el plan");
  } else {
    lines.push(`invocations y Active CPU: NO OBSERVABLE — ${usage.reason}`);
  }

  return {
    title: "VERCEL",
    // Never fully observable: even with consumption measured, the quota
    // percentage has no denominator, so the CPU axis stays unmeasured.
    status: "parcial",
    lines,
  };
}

function upstashSection(upstash: UpstashResult) {
  const lines: string[] = [];
  const dp = upstash.data_plane;

  if (dp.status === "observable") {
    lines.push(`claves (DBSIZE): ${formatCount(dp.keys)}`);
    lines.push(`latencia PING: mediana ${dp.latency.median_ms} ms · p95 ${dp.latency.p95_ms} ms · primera ${dp.latency.first_ms} ms (TLS)`);
    lines.push(`   muestras: ${dp.latency.samples.join(", ")} ms`);
  } else {
    lines.push(`data plane no observable — ${dp.reason}`);
  }

  const q = upstash.quota;
  if (q.status === "observable") {
    lines.push(`comandos del período: ${formatCount(q.commands_period)} / ${formatCount(q.quota)} (${q.percent_used}%)`);
  } else {
    lines.push(`comandos y cuota: NO OBSERVABLE — ${q.reason}`);
    lines.push(`   copiar de: ${q.manual_source}`);
  }

  return {
    title: "UPSTASH",
    status: q.status === "observable" ? "observable" : "parcial",
    lines,
  };
}

/** Changes since the previous snapshot, or the reason there are none. */
function buildChanges(
  previous: SnapshotEnvelope | null,
  current: SnapshotEnvelope,
  supabase: SupabaseResult,
  upstash: UpstashResult,
): string[] {
  const verdict = checkCompatibility(previous, current);
  if (!verdict.comparable) return [`sin diff: ${verdict.reason}`];

  const prev = previous!;
  const prevSupabase = prev.supabase as SupabaseResult | undefined;
  const prevUpstash = prev.upstash as UpstashResult | undefined;
  const lines: string[] = [`ventana entre snapshots: ${elapsedMinutes(prev, current)} min`];

  const prevRows =
    prevSupabase?.status === "observable" ? prevSupabase.analytics.row_count : null;
  const rows = supabase.status === "observable" ? supabase.analytics.row_count : null;
  lines.push(`filas analytics: ${formatDelta(pointDelta(prevRows, rows))}`);

  const prevBytes =
    prevSupabase?.status === "observable" ? prevSupabase.analytics.total_bytes : null;
  const bytes = supabase.status === "observable" ? supabase.analytics.total_bytes : null;
  const bytesDelta = pointDelta(prevBytes, bytes);
  lines.push(
    bytesDelta.comparable
      ? `tamaño analytics: ${formatBytes(bytesDelta.previous)} → ${formatBytes(bytesDelta.current)}`
      : `tamaño analytics: ${formatDelta(bytesDelta)}`,
  );

  const prevKeys = prevUpstash?.data_plane.status === "observable" ? prevUpstash.data_plane.keys : null;
  const keys = upstash.data_plane.status === "observable" ? upstash.data_plane.keys : null;
  lines.push(`claves Upstash: ${formatDelta(pointDelta(prevKeys, keys))}`);

  // Cumulative counters: only across a matching stats_reset.
  const prevWal =
    prevSupabase?.status === "observable" && prevSupabase.wal
      ? { value: Number(prevSupabase.wal.wal_records ?? 0), stats_reset: prevSupabase.wal.stats_reset }
      : null;
  const wal =
    supabase.status === "observable" && supabase.wal
      ? { value: Number(supabase.wal.wal_records ?? 0), stats_reset: supabase.wal.stats_reset }
      : null;
  lines.push(`WAL records: ${formatDelta(cumulativeDelta(prevWal, wal))}`);

  return lines;
}

function buildNotObservable(
  vercel: VercelResult,
  upstash: UpstashResult,
  supabase: SupabaseResult,
): NotObservableEntry[] {
  const out: NotObservableEntry[] = [];

  for (const what of vercel.not_observable) {
    out.push({
      what,
      why:
        vercel.usage.status === "observable"
          ? "el consumo se mide; lo INCLUIDO en el plan no lo expone ninguna API (/v1/billing/charges → 404 costs_not_found)"
          : vercel.usage.reason,
      manual: "Vercel → Usage → Fluid Active CPU / Function Invocations",
    });
  }
  if (upstash.quota.status !== "observable") {
    for (const what of upstash.not_observable) {
      out.push({ what, why: upstash.quota.reason, manual: upstash.quota.manual_source });
    }
  } else {
    for (const what of upstash.not_observable) {
      out.push({ what, why: "la REST API no expone serie temporal" });
    }
  }
  if (supabase.status === "observable" && supabase.degraded_blocks.length > 0) {
    out.push({
      what: `bloques Supabase: ${supabase.degraded_blocks.join(", ")}`,
      why: "el servidor no expone esas relaciones",
    });
  }

  // Batching ratio. The mismatch is STRUCTURAL, not a transient gap: the log
  // sample spans ~70–90 s while the shortest window the database can answer is
  // 15 min, so the two can never fall within tolerance of each other. Dividing
  // them anyway is the single most tempting wrong number in this monitor — it
  // yields ~290 ev/req and reads as proof that batching works. It is reported
  // as missing, with the condition that would make it computable.
  const ratio = batchingRatio(supabase, vercel);
  if (!ratio) {
    out.push({
      what: "eventos por request de telemetría (ratio de batching)",
      why:
        "la muestra de logs dura ~90 s y la ventana más corta de la base es 15 min; " +
        "dividir ventanas de distinto span no es un ratio",
      manual:
        "computable con VERCEL_TOKEN: invocations de /api/telemetry sobre un período real, " +
        "contra las filas de analytics_events del MISMO período",
    });
  }
  return out;
}

/**
 * Events per telemetry request, or null when the windows are incomparable.
 *
 * Kept as a function rather than inlined so the guard is one decision in one
 * place: any future caller gets the same refusal.
 */
function batchingRatio(supabase: SupabaseResult, vercel: VercelResult) {
  if (supabase.status !== "observable") return null;

  const logs = vercel.projects.flatMap((p) =>
    p.status === "observable" && p.logs ? [p.logs] : [],
  );
  if (logs.length === 0) return null;

  const requests = logs.reduce((sum, l) => sum + l.telemetry.requests, 0);
  const seconds = logs.reduce((sum, l) => sum + (l.window_seconds ?? 0), 0) / logs.length;

  return eventsPerRequest({
    events: supabase.ingest_windows.last_15m.events,
    eventsWindowSeconds: supabase.ingest_windows.last_15m.minutes * 60,
    requests,
    requestsWindowSeconds: seconds,
  });
}

function buildClassifyInput(
  supabase: SupabaseResult,
  vercel: VercelResult,
  upstash: UpstashResult,
  projections: Projection[],
): ClassifyInput {
  // Capacity is judged on the worst of the two STABLE measures: the last full
  // day, and the busiest day on record. The short windows are shown in the
  // report but excluded from the verdict — a 15-minute burst does not sustain
  // for 90 days, and one measured here (74 ev/min against 36 over 24 h)
  // projects to 5.8 GB where the day says 2.8. Letting that decide the level
  // would turn the monitor yellow every time someone opens the app twice.
  const stable = projections.filter(
    (p) => p.window === "last_24h" || p.window === "peak_day",
  );
  const worstProjection =
    stable.length > 0
      ? stable.reduce((a, b) => (b.bytes_at_90d > a.bytes_at_90d ? b : a))
      : null;

  return {
    supabase:
      supabase.status === "observable"
        ? {
            observed: true,
            latency_ms: supabase.latency_ms,
            events_per_hour: supabase.events_per_hour,
            events_per_session: supabase.daily[0]?.events_per_session ?? null,
            // From the server-side population block. NOT from
            // `top_sessions_1h`, which is a top-20 sample and can only
            // describe itself.
            session_events_p95_24h: supabase.session_stats_24h?.p95_events ?? null,
            session_population_24h: supabase.session_stats_24h?.session_count ?? null,
            projection_90d_bytes: worstProjection?.bytes_at_90d ?? null,
          }
        : {
            observed: false,
            // `missing` is populated only when a credential was absent, so it
            // is what separates "never asked" from "asked and got nothing".
            reason: supabase.missing.length > 0 ? "not_configured" : "unreachable",
          },
    vercel: {
      // No derivation from logs to CPU exists; absent means absent.
      cpu_percent: null,
      gateway_error_routes: new Set(
        vercel.projects.flatMap((p) =>
          p.status === "observable" ? (p.logs?.html_gateway_errors ?? []) : [],
        ),
      ).size,
        logs_observed: vercel.projects.some(
        (p) => p.status === "observable" && p.logs !== null,
      ),
    },
    upstash: {
      percent_used: upstash.quota.status === "observable" ? upstash.quota.percent_used : null,
      hours_to_exhaustion:
        upstash.quota.status === "observable" && upstash.quota.commands_period !== null
          ? hoursToExhaustion(upstash.quota.commands_period, upstash.quota.quota, 0)
          : null,
    },
  };
}

function buildActions(classification: ReturnType<typeof classify>, env: OpsEnv): string[] {
  const actions: string[] = [];
  for (const trigger of classification.triggers) {
    actions.push(`[${trigger.level}] ${trigger.axis}: ${trigger.detail}`);
  }
  if (!env.has("VERCEL_TOKEN")) {
    actions.push("definir VERCEL_TOKEN para desbloquear invocations y Active CPU");
  }
  if (!env.has("UPSTASH_EMAIL") || !env.has("UPSTASH_API_KEY")) {
    actions.push("definir UPSTASH_EMAIL + UPSTASH_API_KEY para desbloquear la cuota");
  }
  return actions;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const startedAt = Date.now();
  // Throws on an unknown value; the caller turns that into exit 3. A silent
  // fallback would let `--target prod` report production while the operator
  // believes they are looking at preview.
  const target: OpsTarget = parseTarget(argv);
  const env = loadOpsEnv(REPO_ROOT);

  // Collectors are independent: one provider failing must not abort the others.
  const [supabaseOutcome, vercelOutcome, upstashOutcome] = await Promise.allSettled([
    collectSupabase(env),
    collectVercel(env.get("VERCEL_TOKEN"), target),
    collectUpstash({
      restUrl: env.get("UPSTASH_REDIS_REST_URL"),
      restToken: env.get("UPSTASH_REDIS_REST_TOKEN"),
      email: env.get("UPSTASH_EMAIL"),
      apiKey: env.get("UPSTASH_API_KEY"),
    }),
  ]);

  const supabase: SupabaseResult =
    supabaseOutcome.status === "fulfilled"
      ? supabaseOutcome.value
      : { status: "not_observable", reason: "collector threw", missing: [] };
  const vercel: VercelResult =
    vercelOutcome.status === "fulfilled"
      ? vercelOutcome.value
      : { target, projects: [], usage: { status: "not_observable", reason: "collector threw", http_status: null }, not_observable: [] };
  const upstash: UpstashResult =
    upstashOutcome.status === "fulfilled"
      ? upstashOutcome.value
      : {
          data_plane: { status: "not_observable", reason: "collector threw", missing: [] },
          quota: { status: "not_observable", reason: "collector threw", missing: [], http_status: null, manual_source: "Upstash Console" },
          not_observable: [],
        };

  const projections = buildProjections(supabase);
  const classification = classify(buildClassifyInput(supabase, vercel, upstash, projections));

  const takenAt = new Date();
  const envelope: SnapshotEnvelope = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    target,
    taken_at_utc: takenAt.toISOString(),
    taken_at_local: formatLocal(takenAt),
    duration_ms: Date.now() - startedAt,
    credentials: env.statuses(),
    supabase,
    vercel,
    upstash,
    classification,
  };

  const previous = readLatest(REPO_ROOT, target);
  const model: ReportModel = {
    target,
    taken_at_utc: envelope.taken_at_utc,
    taken_at_local: envelope.taken_at_local,
    duration_ms: envelope.duration_ms,
    classification,
    sections: [
      supabaseSection(supabase, projections),
      vercelSection(vercel, supabase),
      upstashSection(upstash),
    ],
    changes: buildChanges(previous, envelope, supabase, upstash),
    capacity:
      supabase.status === "observable"
        ? [`base ${formatBytes(supabase.db_size_bytes)} · analytics ${formatBytes(supabase.analytics.total_bytes)}`]
        : [],
    actions: buildActions(classification, env),
    not_observable: buildNotObservable(vercel, upstash, supabase),
    credentials: env.statuses(),
  };

  const consoleText = renderConsole(model);
  const markdown = renderMarkdown(model);

  // Backstop before anything touches disk or the terminal.
  const knownSecrets = [
    env.get("SUPABASE_DB_PASSWORD"),
    env.get("UPSTASH_REDIS_REST_TOKEN"),
    env.get("UPSTASH_API_KEY"),
    env.get("VERCEL_TOKEN"),
  ].filter((v): v is string => Boolean(v));

  const payload = `${JSON.stringify(envelope)}\n${markdown}\n${consoleText}`;
  assertNoSecrets(payload, knownSecrets);

  writeSnapshot(REPO_ROOT, snapshotStamp(takenAt), envelope, markdown);
  console.log(consoleText);

  return exitCodeFor(classification);
}

// Exit 3 is the monitor's own failure, never the system's state.
main()
  .then((code) => process.exit(code))
  .catch((error) => {
    // An invalid --target is an operator error, reported as a monitor failure
    // rather than a statement about the system. Same exit code, clearer text.
    if (error instanceof InvalidTargetError) {
      console.error(`\n  ✖ ${error.message}\n`);
      console.error("  Uso: pnpm ops:health [-- --target production|preview]");
      console.error("       pnpm ops:health:preview\n");
      process.exit(3);
    }
    console.error("monitor failed:", error instanceof Error ? error.message : String(error));
    process.exit(3);
  });
