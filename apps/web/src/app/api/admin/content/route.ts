/**
 * POST /api/admin/content — db-backed-content Phase 1 (write side only).
 *
 * Founder-only write path for the content overlay. Gated on a server-only
 * ADMIN_TOKEN shared secret (never NEXT_PUBLIC_), rate-limited, and BFS-validated
 * by reusing the same `buildCatalog` validator as the build/dev-route. A valid
 * write upserts one `content_overlay` row keyed by (kind, id) and calls
 * revalidateTag("content") so the (future, Phase 2) merged read path rebuilds.
 *
 * Fail-closed: 503 when ADMIN_TOKEN unset, 403 on a bad token, 400 on an
 * unsolvable/malformed record, 503 when Supabase is unconfigured — never an
 * upsert in any of those branches. The read path still serves the baseline.
 *
 * See docs/specs/db-backed-content.md (Architecture decisions 3, 5, 6).
 */
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { buildCatalog, type LabyrinthRecord } from "@/lib/content/catalog";
import { exceedsPoolCap, projectedPoolSize } from "@/lib/content/pool-capacity";
// The compiled baseline pools, NOT `getBaseline()` from merged-catalog: that
// module pulls `unstable_cache` and the Supabase reader in at import time, and
// this route needs one lookup, not the read path's machinery.
import { EXERCISES } from "@/lib/game/exercises";
import { exerciseTargets, isSweep } from "@/lib/game/targets";
import { MAX_EXERCISES_PER_PIECE } from "@/lib/game/score";
import { getSupabaseServer } from "@/lib/supabase/server";
import { enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type {
  ContentBucket,
  ContentOverlayRow,
  ContentWriteRequest,
} from "@/lib/content/overlay-types";

export const runtime = "nodejs";

const CONTENT_TAG = "content";

/** Constant-time compare via fixed-length sha256 digests (length not leaked). */
function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const sha = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(sha(provided), sha(expected));
}

function err(errors: string[], status: number) {
  return NextResponse.json({ ok: false, errors }, { status });
}

export async function POST(request: Request) {
  // 1. Server-only secret. Absent env → route disabled (red-team P0).
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return err(["admin writes disabled"], 503);

  // 2. Auth gate.
  const provided = request.headers.get("x-admin-token");
  if (!tokenMatches(provided, expected)) return err(["forbidden"], 403);

  // 3. Rate limit (reuse the shared token-bucket limiter).
  try {
    await enforceRateLimit(getRequestIp(request));
  } catch {
    return err(["rate limit exceeded"], 429);
  }

  // 4. Transport.
  let body: ContentWriteRequest;
  try {
    body = (await request.json()) as ContentWriteRequest;
  } catch {
    return err(["invalid JSON"], 400);
  }
  const kind: ContentBucket = body?.kind === "labyrinth" ? "labyrinth" : "exercise";
  const record = body?.record;
  if (!record || typeof record !== "object") return err(["missing record"], 400);
  if (!record.id) return err(["missing record id"], 400);

  // 5. BFS-validate the puzzle by reusing buildCatalog. We force `disabled:false`
  //    for validation (a disabled record is excluded from the catalog, so it
  //    would yield no BFS result) and persist the real flag afterwards.
  const labRecord: LabyrinthRecord = {
    id: record.id,
    piece: record.piece,
    fen: record.fen,
    target: record.target,
    // Star Sweep. Every rule about them — two to five squares, no repeats, none
    // on the start, `target === targets[0]`, the bishop's colour, the cheap
    // first leg, the pawn's refusal, the labyrinth bucket's refusal — is
    // enforced by `buildCatalog` below, which is the SAME validator
    // `pnpm import-puzzles` runs. A second copy of them here is how the JSON
    // path and the builder start disagreeing months later, in a published row.
    targets: record.targets ?? undefined,
    starFloor: record.starFloor ?? undefined,
    mover: record.mover ?? undefined,
    tier: record.tier,
    tags: record.tags ?? undefined,
    explanation: record.explanation ?? undefined,
    order: record.order ?? 0,
  };
  const cat = buildCatalog(
    [],
    kind === "labyrinth" ? [labRecord] : [],
    kind === "exercise" ? [labRecord] : [],
  );
  if (cat.errors.length) return err(cat.errors, 400);
  const pool = kind === "labyrinth" ? cat.labyrinths : cat.exercises;
  const built = pool[record.piece]?.find((e) => e.id === record.id);
  if (!built) return err(["validation produced no puzzle"], 400);

  const supabase = getSupabaseServer();
  if (!supabase) return err(["content store unavailable"], 503);

  // 5b. Pool capacity. A piece grown past MAX_EXERCISES_PER_PIECE lets the client
  //     compute a score above MAX_SUBMITTABLE_SCORE, and every on-chain save for
  //     that piece starts failing with a 400 — for the player, not for us. Refuse
  //     here instead, where the author reads the message and reacts. Labyrinths
  //     are exempt: they never feed the score.
  if (kind === "exercise") {
    const { data: storedIds, error: capacityError } = await supabase
      .from("content_overlay")
      .select("id")
      .eq("kind", "exercise")
      .eq("piece", record.piece)
      .eq("disabled", false);

    // Fail closed: without a reliable count we cannot promise the invariant.
    if (capacityError || !storedIds) {
      return err([capacityError?.message ?? "capacity check failed"], 500);
    }

    const capacity = {
      piece: record.piece,
      recordId: record.id,
      disabled: Boolean(record.disabled),
      overlayIds: storedIds.map((r: { id: string }) => r.id),
    };
    if (exceedsPoolCap(capacity)) {
      return err(
        [
          `pool for "${record.piece}" would reach ${projectedPoolSize(capacity)} exercises, ` +
            `over the ${MAX_EXERCISES_PER_PIECE} allowed per piece. ` +
            `Raise MAX_EXERCISES_PER_PIECE in lib/game/score.ts (it also raises the ` +
            `score ceiling the signer validates), or disable an exercise first.`,
        ],
        400,
      );
    }
  }

  // 5c. Star Sweep DEGRADATION. The table can now store a multi-goal board
  //     (`targets`, `star_floor`), so an edit that carries its stars is a
  //     legitimate save and falls through. What is refused is a ONE-GOAL row
  //     landing on a multi-goal baseline: it would store a single target with
  //     `optimal_moves` measured to that one square, and the screen treats
  //     `optimalMoves === 1` as "any non-target move is an instant loss" — the
  //     level ships unplayable and fails the player for trying.
  //
  //     The read path refuses it too (`mergeOverlay` keeps the baseline), so the
  //     game is safe either way. But refusing only there makes the SAVE a silent
  //     no-op: the builder reports success, the row lands, and the edit never
  //     appears — the author is left debugging their own content against a
  //     system that ignored them. Guard the grantor: fail where somebody reads.
  //
  //     Checked against the BASELINE, not a hardcoded id list, so every sweep
  //     authored from now on is covered without touching this route again.
  if (kind === "exercise") {
    const baselineEntry = EXERCISES[record.piece]?.find(
      (e) => e.id === record.id,
    );
    const rowIsSweep = (record.targets?.length ?? 0) > 1;
    if (baselineEntry && isSweep(baselineEntry) && !record.disabled && !rowIsSweep) {
      const goals = exerciseTargets(baselineEntry);
      return err(
        [
          `"${record.id}" is a Star Sweep (${goals.length} goals, optimal ` +
            `${baselineEntry.optimalMoves}) and this row carries one target. Saving it ` +
            `would downgrade the level to a single goal with an optimum of 1, which the ` +
            `screen plays as "any non-target move loses" — so the read path ignores the ` +
            `row and your edit would never appear. Send all ${goals.length} squares in ` +
            `\`targets\` (the builder's multi-star mode), or disable it, which still works.`,
        ],
        400,
      );
    }
  }

  // 6. Persist the delta. optimal_moves is BFS-verified (trusted by read path).
  const updated_at = new Date().toISOString();
  const row: ContentOverlayRow = {
    id: record.id,
    kind,
    piece: record.piece,
    fen: record.fen,
    target: record.target,
    mover: record.mover ?? null,
    tier: record.tier,
    tags: record.tags ?? null,
    explanation: record.explanation ?? null,
    order: record.order ?? 0,
    disabled: Boolean(record.disabled),
    // NULL, never `[]` and never the single target repeated: a one-goal board is
    // what every row written before the migration is, and it has to keep meaning
    // exactly that. `isSweep` reads "more than one", so an empty array would be
    // harmless here and a lie in the table.
    targets: record.targets?.length ? record.targets : null,
    star_floor: record.starFloor ?? null,
    // ⛔ Always the SERVER's number. For a sweep it is the cheapest ORDER over
    //    every target (`computeSweepOptimal`), not the leg to the first star:
    //    the client's `optimalMoves`, if it sent one, is ignored right here.
    optimal_moves: built.optimalMoves,
    updated_at,
    // Save always lands at `draft` (content-staging-model Behavior 1); promotion
    // is a separate step on /api/admin/content/stage.
    stage: "draft",
  };

  const { error } = await supabase
    .from("content_overlay")
    .upsert(row, { onConflict: "kind,id,stage" });
  if (error) return err([error.message], 500);

  // 7. On-demand revalidation so players see the change without a redeploy.
  let revalidated = false;
  try {
    revalidateTag(CONTENT_TAG);
    revalidated = true;
  } catch {
    revalidated = false;
  }

  // 8. Audit (never log the token itself — only a short hash of the actor).
  console.info("[admin/content] write", {
    id: row.id,
    kind: row.kind,
    actor: createHash("sha256").update(provided ?? "").digest("hex").slice(0, 12),
    updated_at,
  });

  return NextResponse.json({ ok: true, saved: row, revalidated });
}
