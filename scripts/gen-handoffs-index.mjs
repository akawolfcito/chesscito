#!/usr/bin/env node
/**
 * Regenerates docs/handoffs/README.md — an index of every handoff, newest
 * first, grouped by month.
 *
 * Why an index and not a purge: CLAUDE.md places the historical handoff inside
 * the authority chain (código → spec vigente → handoff actual → topic de
 * memoria → handoff histórico → backlog), and MEMORY.md is only a pointer file
 * whose detail lives here. Deleting old handoffs would leave the index of
 * record pointing at nothing. Noise is a discovery problem, so it gets a
 * discovery fix.
 *
 * Run: node scripts/gen-handoffs-index.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "docs/handoffs";
const OUT = join(DIR, "README.md");
const SKIP = new Set(["README.md", "_next-session-prompt.md"]);

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;

/** First markdown H1, cleaned of a trailing date that the group header already
 *  shows. Falls back to a de-slugged filename when a file has no heading. */
function titleOf(body, slug) {
  const heading = body.split("\n").find((l) => l.startsWith("# "));
  if (!heading) {
    return slug.replace(/\.md$/, "").replace(DATE_RE, "").replace(/^-+|-+$/g, "").replace(/-/g, " ");
  }
  return heading
    .replace(/^#\s+/, "")
    // "Handoff — X" / "Session Handoff — X": the folder already says handoff,
    // and repeating it on 180 lines buries the part that distinguishes them.
    .replace(/^(session\s+)?handoff\s*[—–-]?\s*/i, "")
    // A trailing date duplicates the one this line already prints.
    .replace(/\s*\((\d{4}-\d{2}-\d{2})\)\s*$/, "")
    .replace(/\s*[—–-]\s*\d{4}-\d{2}-\d{2}\s*$/, "")
    .trim();
}

/** Filename date wins; otherwise the first date written inside the document. */
function dateOf(name, body) {
  return (name.match(DATE_RE) ?? body.match(DATE_RE))?.[0] ?? null;
}

const entries = readdirSync(DIR)
  .filter((f) => f.endsWith(".md") && !SKIP.has(f))
  .map((name) => {
    const body = readFileSync(join(DIR, name), "utf8");
    return { name, date: dateOf(name, body), title: titleOf(body, name) };
  })
  .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.name.localeCompare(b.name));

const groups = new Map();
for (const e of entries) {
  const key = e.date ? e.date.slice(0, 7) : "sin fecha";
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(e);
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const label = (k) => {
  if (k === "sin fecha") return "Sin fecha en el nombre";
  const [y, m] = k.split("-");
  return `${MONTHS[Number(m) - 1][0].toUpperCase()}${MONTHS[Number(m) - 1].slice(1)} ${y}`;
};

const lines = [
  "# Handoffs — índice",
  "",
  "> Generado por `scripts/gen-handoffs-index.mjs`. **No editar a mano**: regenerá con",
  "> `node scripts/gen-handoffs-index.mjs` después de agregar un handoff.",
  "",
  "Un handoff por línea, del más nuevo al más viejo. El detalle vive en cada archivo.",
  "",
  "**No borrar handoffs viejos.** `CLAUDE.md` los ubica dentro de la cadena de autoridad",
  "(código → spec vigente → handoff actual → topic de memoria → **handoff histórico** → backlog),",
  "y `MEMORY.md` es un índice que apunta acá para el detalle. Purgarlos deja la memoria",
  "apuntando al vacío — que es justo lo que este índice evita tener que hacer.",
  "",
  `**Total:** ${entries.length} handoffs.`,
  "",
];

for (const [key, list] of groups) {
  lines.push(`## ${label(key)} · ${list.length}`, "");
  for (const e of list) {
    const day = e.date ? `\`${e.date}\` ` : "";
    lines.push(`- ${day}[${e.title}](${e.name})`);
  }
  lines.push("");
}

writeFileSync(OUT, lines.join("\n"));
console.log(`${OUT}: ${entries.length} handoffs across ${groups.size} groups`);
