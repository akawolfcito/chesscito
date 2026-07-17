/**
 * POST /api/admin/content/stage — content-staging-model slice 4 (promote/demote).
 *
 * Moves one puzzle version up (promote) or down (demote) the maturity ladder by
 * calling the transactional `promote_content` RPC (delete supersede + stage
 * update in ONE transaction), then revalidates THIS deployment's `content` tag.
 * There is NO cross-deployment fan-out — other envs refresh on the cache TTL.
 *
 * Founder-only: gated on the server-only ADMIN_TOKEN shared secret (never
 * NEXT_PUBLIC_) + rate-limited. Fail-closed: 503 token-unset / store-down, 403
 * bad token, 429 rate-limited, 400 malformed/no-op, 404 when the `from` version
 * is absent (the RPC returns 0 and NOTHING was deleted), 500 on a DB error.
 */
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { STAGE_RANK } from "@/lib/content/overlay-types";
import type {
  ContentBucket,
  ContentStage,
  ContentStageRequest,
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

function isStage(v: unknown): v is ContentStage {
  return v === "draft" || v === "preview" || v === "published";
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return err(["admin writes disabled"], 503);

  const provided = request.headers.get("x-admin-token");
  if (!tokenMatches(provided, expected)) return err(["forbidden"], 403);

  try {
    await enforceRateLimit(getRequestIp(request));
  } catch {
    return err(["rate limit exceeded"], 429);
  }

  let body: ContentStageRequest;
  try {
    body = (await request.json()) as ContentStageRequest;
  } catch {
    return err(["invalid JSON"], 400);
  }

  const kind: ContentBucket = body?.kind === "labyrinth" ? "labyrinth" : "exercise";
  const id = body?.id;
  let from = body?.from; // optional: auto-detected from the freshest version
  const to = body?.to;
  if (!id || typeof id !== "string") return err(["missing id"], 400);
  if (!isStage(to)) return err(["invalid target stage"], 400);
  if (from !== undefined && !isStage(from)) return err(["invalid from stage"], 400);

  const supabase = getSupabaseServer();
  if (!supabase) return err(["content store unavailable"], 503);

  // Auto-detect `from` = the freshest (lowest-rank) existing version of this id,
  // so a caller can just say "set to X" without tracking the current stage.
  if (from === undefined) {
    const { data: rows, error: selErr } = await supabase
      .from("content_overlay")
      .select("stage")
      .eq("kind", kind)
      .eq("id", id);
    if (selErr) return err([selErr.message], 500);
    const stages = ((rows ?? []) as { stage?: unknown }[])
      .map((r) => r.stage)
      .filter(isStage);
    if (stages.length === 0) {
      return err([`no overlay version of ${kind} ${id} to move`], 404);
    }
    from = stages.reduce((a, b) => (STAGE_RANK[b] < STAGE_RANK[a] ? b : a));
  }

  // Already at the target → friendly no-op (not an error), so the dropdown can
  // re-select the current stage without surprising the user.
  if (from === to) return NextResponse.json({ ok: true, from, to });

  // The whole move is one transaction inside the RPC; it returns 1 when a version
  // was moved, 0 when `from` was absent (and in that case nothing was deleted).
  const { data, error } = await supabase.rpc("promote_content", {
    p_kind: kind,
    p_id: id,
    p_from: from,
    p_to: to,
  });
  if (error) return err([error.message], 500);
  if (data === 0) {
    return err([`no '${from}' version of ${kind} ${id} to promote`], 404);
  }

  // Revalidate only THIS deployment (no fan-out); other envs pick it up on TTL.
  let revalidated = false;
  try {
    revalidateTag(CONTENT_TAG);
    revalidated = true;
  } catch {
    revalidated = false;
  }

  console.info("[admin/content/stage] move", {
    id,
    kind,
    from,
    to,
    revalidated,
    actor: createHash("sha256").update(provided ?? "").digest("hex").slice(0, 12),
  });

  return NextResponse.json({ ok: true, from, to });
}
