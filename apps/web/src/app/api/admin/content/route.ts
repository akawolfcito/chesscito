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
import { getSupabaseServer } from "@/lib/supabase/server";
import { enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type {
  ContentKind,
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
  const kind: ContentKind = body?.kind === "labyrinth" ? "labyrinth" : "exercise";
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
    optimal_moves: built.optimalMoves,
    updated_at,
    // Save always lands at `draft` (content-staging-model Behavior 1); promotion
    // is a separate step on /api/admin/content/stage.
    stage: "draft",
  };

  const supabase = getSupabaseServer();
  if (!supabase) return err(["content store unavailable"], 503);
  const { error } = await supabase
    .from("content_overlay")
    .upsert(row, { onConflict: "kind,id" });
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
