/**
 * CLI entrypoint: regenerate src/lib/game/generated/puzzles.generated.ts from
 * content/puzzles.csv + content/labyrinths.json + content/exercises.json.
 * Run: `pnpm import-puzzles`.
 *
 * The pure FEN→catalog builder lives in src/lib/content/catalog.ts (prod-safe,
 * importable by app/ routes). This file re-exports it for back-compat with the
 * scripts + tests that import from "scripts/import-puzzles", and adds the
 * node:fs CLI (`main()` below).
 */
export {
  parseCsv,
  buildCatalog,
  renderGeneratedModule,
  type LabyrinthRecord,
  type ExerciseRecord,
  type BuiltCatalog,
} from "@/lib/content/catalog";

import { parseCsv, buildCatalog, renderGeneratedModule } from "@/lib/content/catalog";

async function main() {
  const { readFileSync, writeFileSync, mkdirSync, existsSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");
  const csvPath = resolve("content/puzzles.csv");
  const labsPath = resolve("content/labyrinths.json");
  const exercisesPath = resolve("content/exercises.json");
  const outPath = resolve("src/lib/game/generated/puzzles.generated.ts");
  const rows = existsSync(csvPath) ? parseCsv(readFileSync(csvPath, "utf8")) : [];
  const labs = existsSync(labsPath) ? JSON.parse(readFileSync(labsPath, "utf8")) : [];
  const exes = existsSync(exercisesPath) ? JSON.parse(readFileSync(exercisesPath, "utf8")) : [];
  const cat = buildCatalog(rows, labs, exes);
  if (cat.errors.length) {
    console.error(`import-puzzles: ${cat.errors.length} error(s):`);
    for (const e of cat.errors) console.error("  - " + e);
    process.exit(1);
  }
  if (cat.warnings.length) {
    console.warn(`import-puzzles: ${cat.warnings.length} warning(s):`);
    for (const w of cat.warnings) console.warn("  - " + w);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderGeneratedModule(cat));
  const n = Object.values(cat.exercises).flat().length + Object.values(cat.labyrinths).flat().length;
  console.log(`import-puzzles: wrote ${n} puzzles to ${outPath}`);
}
if (process.argv[1] && process.argv[1].endsWith("import-puzzles.ts")) void main();
