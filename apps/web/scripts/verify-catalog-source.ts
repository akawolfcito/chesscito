/**
 * Verifies WHICH catalog the player actually receives.
 *
 * Runs the real production read path (`loadMergedCatalog` — baseline ⊕ Supabase
 * overlay, stage-filtered) against the configured database, and diffs the rook
 * pool it returns against `content/exercises.json`. Any drift means Git is not
 * what the player reads.
 *
 * Born from A5.5: 12 overlay rows were silently overriding the official rook
 * exercises — one of them `published`, so production served it. Deleting them is
 * not enough; the read path has to PROVE Git won.
 *
 * Run: CONTENT_STAGE=<floor> pnpm exec tsx scripts/verify-catalog-source.ts
 * Docs: docs/plans/2026-07-13-rook-curriculum-implementation-plan.md §15.5
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load .env the way Next.js would. Without this the Supabase client comes back
 * unconfigured, `fetchOverlayRows` returns null, and the run silently falls back
 * to baseline — printing a PASS that proves nothing. The first run of this script
 * did exactly that. A verification that cannot fail is not a verification.
 */
function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnv();
  const { loadMergedCatalog } = await import("@/lib/content/merged-catalog");
  const floor = process.env.CONTENT_STAGE ?? "(unset)";

  // Prove the DB was actually reached: an unconfigured client also yields an
  // empty overlay, and the two are NOT the same evidence.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("ABORT: Supabase is not configured — this run would prove nothing.");
    process.exit(2);
  }

  const merged = await loadMergedCatalog();
  const git = JSON.parse(
    readFileSync(resolve(process.cwd(), "content/exercises.json"), "utf8"),
  ) as Array<{ id: string; piece: string; title?: string; order: number }>;
  const gitRook = git.filter((e) => e.piece === "rook").sort((a, b) => a.order - b.order);

  console.log(`CONTENT_STAGE floor : ${floor}`);
  console.log(`catalog source      : ${merged.source}`);
  console.log(`overlay rows applied: ${merged.overlayCount}`);

  const pool = merged.exercises.rook;
  console.log(`\nrook pool served to the player (${pool.length}):\n`);
  console.log("  #  id                    optimal  obstacles  title (from the description map)");
  pool.forEach((ex, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}  ${ex.id.padEnd(21)} ${String(ex.optimalMoves).padStart(7)}  ` +
        `${String(ex.obstacles?.length ?? 0).padStart(9)}  ${merged.descriptions[ex.id] ?? "(NONE — falls back to 'Exercise N')"}`,
    );
  });

  const problems: string[] = [];
  // `baseline-only` means the overlay was UNREACHABLE (no client / error / timeout),
  // not that it was empty. Only `baseline+overlay` with 0 applied proves we asked
  // the database and it had nothing to say.
  if (merged.source !== "baseline+overlay") {
    problems.push(
      `source is "${merged.source}" — the overlay was not reached, so an empty result proves nothing`,
    );
  }
  if (pool.length !== gitRook.length) {
    problems.push(`pool size ${pool.length} != Git ${gitRook.length}`);
  }
  gitRook.forEach((g, i) => {
    const p = pool[i];
    if (!p) return problems.push(`slot ${i + 1}: missing (expected ${g.id})`);
    if (p.id !== g.id) problems.push(`slot ${i + 1}: id ${p.id} != Git ${g.id}`);
    if (merged.descriptions[p.id] !== g.title) {
      problems.push(`${p.id}: title "${merged.descriptions[p.id]}" != Git "${g.title}"`);
    }
    if (!p.playerPrompt) problems.push(`${p.id}: playerPrompt LOST`);
    if (!p.principle) problems.push(`${p.id}: principle LOST`);
  });

  const rook6 = pool.find((e) => e.id === "rook-6");
  const rook7 = pool.find((e) => e.id === "rook-7");
  if (rook6?.obstacles?.length !== 7) problems.push(`rook-6 has ${rook6?.obstacles?.length} obstacles, expected the trimmed 7`);
  if (rook7?.obstacles?.length !== 11) problems.push(`rook-7 has ${rook7?.obstacles?.length} obstacles, expected the trimmed 11`);

  console.log("");
  if (problems.length === 0) {
    console.log("PASS — the served catalog IS the Git catalog (ids, order, titles, prompts, trims).");
  } else {
    console.log(`FAIL — ${problems.length} divergence(s) between the served catalog and Git:`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
}

void main();
