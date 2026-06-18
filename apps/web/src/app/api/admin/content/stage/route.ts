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
import type {
  ContentKind,
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

  const kind: ContentKind = body?.kind === "labyrinth" ? "labyrinth" : "exercise";
  const id = body?.id;
  const from = body?.from;
  const to = body?.to;
  if (!id || typeof id !== "string") return err(["missing id"], 400);
  if (!isStage(from) || !isStage(to)) return err(["invalid stage"], 400);
  if (from === to) return err(["from and to are the same stage (no-op)"], 400);

  const supabase = getSupabaseServer();
  if (!supabase) return err(["content store unavailable"], 503);

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
