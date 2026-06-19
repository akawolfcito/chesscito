/**
 * POST /api/admin/content/revalidate — cache-only invalidation.
 *
 * Lightweight endpoint: calls revalidateTag("content") on this deployment and
 * returns. Called by the dev promote proxy to fan-out cache invalidation across
 * all deployments (www, lite, preview, lite-preview) after a stage move.
 *
 * Gated on ADMIN_TOKEN (same auth as /api/admin/content). No DB writes.
 */
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/merged-catalog";

export const runtime = "nodejs";

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const sha = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(sha(provided), sha(expected));
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ ok: false }, { status: 503 });
  const provided = request.headers.get("x-admin-token");
  if (!tokenMatches(provided, expected)) return NextResponse.json({ ok: false }, { status: 403 });
  revalidateTag(CONTENT_TAG);
  return NextResponse.json({ ok: true });
}
