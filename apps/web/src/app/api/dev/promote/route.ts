/**
 * POST /api/dev/promote — content-staging-model (builder promote/demote).
 *
 * Dev-only proxy: reads ADMIN_TOKEN server-side and forwards a stage move to the
 * overlay's /api/admin/content/stage (so the builder can promote/demote without
 * the token ever reaching the browser). Mirrors /api/dev/publish.
 *
 * After a successful move, fans out revalidateTag("content") to all remote envs
 * (www, learn, play, and legacy Lite) via /api/admin/content/revalidate so players
 * see the change without waiting for the 60s TTL.
 *
 * Fail-closed: 404 in production (isDevSurfaceEnabled); 400 on a malformed move;
 * "not configured" when ADMIN_TOKEN is unset. Upstream errors are sanitized by
 * status — the raw body (which may carry DB detail) and the token are never echoed.
 */
import { NextResponse } from "next/server";
import type { ContentKind, ContentStage } from "@/lib/content/overlay-types";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

export const runtime = "nodejs";

type PromoteBody = {
  kind?: ContentKind;
  id?: string;
  from?: ContentStage;
  to?: ContentStage;
};

function isStage(v: unknown): v is ContentStage {
  return v === "draft" || v === "preview" || v === "published";
}

function stageErrorForStatus(status: number): string {
  switch (status) {
    case 403:
      return "promote rejected: admin token rejected (403)";
    case 404:
      return "promote rejected: that 'from' version does not exist (404)";
    case 429:
      return "promote rejected: rate limited (429)";
    case 400:
      return "promote rejected: invalid move (400)";
    case 503:
      return "promote unavailable: store or admin writes disabled (503)";
    case 500:
      return "promote failed: server error (500)";
    default:
      return `promote failed: HTTP ${status}`;
  }
}

/** All remote deployments that need cache invalidation after a stage move. */
const REMOTE_REVALIDATE_URLS = [
  "https://www.chesscito.com",
  "https://learn.chesscito.com",
  "https://learn-preview.chesscito.com",
  "https://play.chesscito.com",
  "https://lite.chesscito.com",
  "https://preview.chesscito.com",
  "https://lite-preview.chesscito.com",
];

export async function POST(req: Request) {
  if (!isDevSurfaceEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  let b: PromoteBody;
  try {
    b = (await req.json()) as PromoteBody;
  } catch {
    return NextResponse.json({ ok: false, errors: ["invalid JSON"] }, { status: 400 });
  }

  const kind: ContentKind = b.kind === "labyrinth" ? "labyrinth" : "exercise";
  const { id, from, to } = b;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ ok: false, errors: ["missing id"] }, { status: 400 });
  }
  if (!isStage(to)) {
    return NextResponse.json({ ok: false, errors: ["invalid target stage"] }, { status: 400 });
  }
  if (from !== undefined && !isStage(from)) {
    return NextResponse.json({ ok: false, errors: ["invalid from stage"] }, { status: 400 });
  }

  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, errors: ["overlay target not configured (set ADMIN_TOKEN)"] },
      { status: 200 },
    );
  }

  const origin = new URL(req.url).origin;
  try {
    const res = await fetch(`${origin}/api/admin/content/stage`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ kind, id, from, to }),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, errors: [stageErrorForStatus(res.status)] });
    }
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; from?: string; to?: string }
      | null;
    if (!data?.ok) {
      return NextResponse.json({ ok: false, errors: [stageErrorForStatus(res.status)] });
    }

    // Fan-out cache invalidation to public and legacy deployments.
    await Promise.allSettled(
      REMOTE_REVALIDATE_URLS.map((url) =>
        fetch(`${url}/api/admin/content/revalidate`, {
          method: "POST",
          headers: { "x-admin-token": token },
        }).catch(() => undefined),
      ),
    );

    console.info("[dev/promote]", { id, kind, from, to });
    return NextResponse.json({ ok: true, from: data.from ?? from, to: data.to ?? to });
  } catch {
    return NextResponse.json({
      ok: false,
      errors: ["promote failed: network error reaching the target"],
    });
  }
}
