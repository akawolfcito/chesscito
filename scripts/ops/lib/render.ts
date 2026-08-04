/**
 * Rendering — console and Markdown from one source of truth.
 *
 * ── The output allow-list ─────────────────────────────────────────────────
 *
 * Renderers are where secrets escape, because a renderer's natural instinct is
 * to dump whatever it was handed. So this module never walks an arbitrary
 * object: every line is written from a named field. If a collector grows a new
 * field, it does not appear here until someone adds it deliberately.
 *
 * `assertNoSecrets` is the backstop, not the control.
 */

import type { Classification } from "./classify";
import type { Delta } from "./derive";

export const BOGOTA_TZ = "America/Bogota";

export function formatLocal(date: Date, timeZone = BOGOTA_TZ): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(date);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-US");
}

/**
 * A delta, or the reason there is not one.
 *
 * An incomparable delta prints its reason instead of a number. That is the
 * visible half of the rule that `not_observable` never enters arithmetic: the
 * reader sees "counters were reset between snapshots", not a plausible zero.
 */
export function formatDelta(delta: Delta<number>, unit = ""): string {
  if (!delta.comparable) return `not comparable (${delta.reason})`;
  const sign = delta.change > 0 ? "+" : "";
  return `${formatCount(delta.previous)} → ${formatCount(delta.current)}${unit} (${sign}${formatCount(delta.change)})`;
}

export const LEVEL_ICON = { green: "🟢", yellow: "🟡", red: "🔴" } as const;

/** One line stating the verdict, its icon, and whether it is complete. */
export function renderVerdict(classification: Classification): string {
  const icon = LEVEL_ICON[classification.level];
  const suffix = classification.partial
    ? `  ⚠️ ${classification.unmeasured_critical.length} critical axis/axes not measured`
    : "";
  return `${icon} ${classification.label}${suffix}`;
}

export type NotObservableEntry = { what: string; why: string; manual?: string };

export type ReportModel = {
  taken_at_utc: string;
  taken_at_local: string;
  duration_ms: number;
  classification: Classification;
  /** Section title → ordered lines. Built by the caller from named fields. */
  sections: Array<{ title: string; status: string; lines: string[] }>;
  changes: string[];
  capacity: string[];
  actions: string[];
  not_observable: NotObservableEntry[];
  credentials: Array<{ name: string; configured: boolean }>;
};

export function renderConsole(model: ReportModel): string {
  const out: string[] = [];
  const rule = "─".repeat(72);

  out.push(rule);
  out.push(`CHESSCITO — LAUNCH HEALTH        ${model.taken_at_utc}`);
  out.push(`                                 ${model.taken_at_local} (Bogotá)`);
  out.push(`ESTADO: ${renderVerdict(model.classification)}`);
  out.push(rule);

  for (const section of model.sections) {
    out.push("");
    out.push(`${section.title}  [${section.status}]`);
    for (const line of section.lines) out.push(`  ${line}`);
  }

  if (model.classification.triggers.length > 0) {
    out.push("");
    out.push("INDICADORES QUE DISPARARON EL ESTADO");
    for (const t of model.classification.triggers) {
      out.push(`  ${LEVEL_ICON[t.level]} ${t.axis}: ${t.detail}`);
    }
  }

  out.push("");
  out.push("CAMBIOS DESDE EL SNAPSHOT ANTERIOR");
  for (const line of model.changes.length ? model.changes : ["  (sin snapshot previo)"]) {
    out.push(model.changes.length ? `  ${line}` : line);
  }

  if (model.capacity.length > 0) {
    out.push("");
    out.push("CAPACIDAD RESTANTE");
    for (const line of model.capacity) out.push(`  ${line}`);
  }

  out.push("");
  out.push("ACCIONES RECOMENDADAS  (ninguna ejecutada)");
  for (const line of model.actions.length ? model.actions : ["ninguna"]) {
    out.push(`  ${line}`);
  }

  out.push("");
  out.push("DATOS NO OBSERVABLES");
  if (model.not_observable.length === 0) {
    out.push("  ninguno");
  }
  for (const entry of model.not_observable) {
    out.push(`  · ${entry.what} — ${entry.why}`);
    if (entry.manual) out.push(`      copiar de: ${entry.manual}`);
  }

  out.push("");
  out.push(`CREDENCIALES  ${model.credentials.map((c) => `${c.name}=${c.configured ? "sí" : "no"}`).join("  ")}`);
  out.push(`Snapshot tomado en ${model.duration_ms} ms`);

  return out.join("\n");
}

export function renderMarkdown(model: ReportModel): string {
  const out: string[] = [];

  out.push("# Chesscito — Launch Health");
  out.push("");
  out.push(`**${renderVerdict(model.classification)}**`);
  out.push("");
  out.push(`- UTC: \`${model.taken_at_utc}\``);
  out.push(`- Bogotá: \`${model.taken_at_local}\``);
  out.push(`- Duración del snapshot: ${model.duration_ms} ms`);
  out.push("");

  for (const section of model.sections) {
    out.push(`## ${section.title} — ${section.status}`);
    out.push("");
    for (const line of section.lines) out.push(`- ${line}`);
    out.push("");
  }

  out.push("## Indicadores que dispararon el estado");
  out.push("");
  if (model.classification.triggers.length === 0) {
    out.push("Ninguno.");
  }
  for (const t of model.classification.triggers) {
    out.push(`- ${LEVEL_ICON[t.level]} **${t.axis}** — ${t.detail}`);
  }
  out.push("");

  out.push("## Cambios desde el snapshot anterior");
  out.push("");
  if (model.changes.length === 0) out.push("Sin snapshot previo comparable.");
  for (const line of model.changes) out.push(`- ${line}`);
  out.push("");

  if (model.capacity.length > 0) {
    out.push("## Capacidad restante");
    out.push("");
    for (const line of model.capacity) out.push(`- ${line}`);
    out.push("");
  }

  out.push("## Acciones recomendadas");
  out.push("");
  out.push("_Ninguna ejecutada por el monitor._");
  out.push("");
  for (const line of model.actions) out.push(`- ${line}`);
  out.push("");

  out.push("## Datos no observables");
  out.push("");
  if (model.not_observable.length === 0) out.push("Ninguno.");
  for (const entry of model.not_observable) {
    out.push(`- **${entry.what}** — ${entry.why}`);
    if (entry.manual) out.push(`  - Copiar de: ${entry.manual}`);
  }
  out.push("");

  out.push("## Credenciales");
  out.push("");
  out.push("| Variable | Configurada |");
  out.push("|---|---|");
  for (const c of model.credentials) {
    out.push(`| \`${c.name}\` | ${c.configured ? "sí" : "no"} |`);
  }
  out.push("");

  return out.join("\n");
}

/**
 * Backstop against a leak, run over every artefact before it is written.
 *
 * Patterns, not a list of known secrets: the point is to catch a shape that
 * should never appear, including one nobody thought to register.
 */
export function findSecrets(text: string, extra: string[] = []): string[] {
  const hits: string[] = [];
  const patterns: Array<[string, RegExp]> = [
    ["postgres connection string", /postgresql:\/\/[^\s"']*:[^\s"']*@/i],
    ["wallet address", /0x[0-9a-fA-F]{40}/],
    ["upstash host", /[a-z0-9-]+\.upstash\.io/i],
    ["bearer token", /Bearer\s+[A-Za-z0-9_-]{12,}/],
    ["jwt", /eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/],
    ["supabase project url", /https:\/\/[a-z0-9]{15,}\.supabase\.co/i],
  ];

  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) hits.push(label);
  }
  for (const secret of extra) {
    if (secret && secret.length > 6 && text.includes(secret)) hits.push("known credential");
  }
  return [...new Set(hits)];
}

export function assertNoSecrets(text: string, extra: string[] = []): void {
  const hits = findSecrets(text, extra);
  if (hits.length > 0) {
    throw new Error(`refusing to write an artefact containing: ${hits.join(", ")}`);
  }
}
