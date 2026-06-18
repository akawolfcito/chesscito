/**
 * POST /api/dev/promote — content-staging-model (builder promote/demote).
 *
 * Dev-only proxy: reads ADMIN_TOKEN server-side and forwards a stage move to the
 * overlay's /api/admin/content/stage (so the builder can promote/demote without
 * the token ever reaching the browser). Mirrors /api/dev/publish.
 *
 * Fail-closed: 404 in production (NODE_ENV guard); 400 on a malformed move;
 * "not configured" when ADMIN_TOKEN / OVERLAY_PUBLISH_BASE_URL are unset. Upstream
 * errors are sanitized by status — the raw body (which may carry DB detail) and
 * the token are never echoed.
 */
import { NextResponse } from "next/server";
import type { ContentKind, ContentStage } from "@/lib/content/overlay-types";

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

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
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
  // `from` is optional — when omitted the overlay route auto-detects the freshest
  // version ("set to `to`"). When present it must be a valid stage.
  if (from !== undefined && !isStage(from)) {
    return NextResponse.json({ ok: false, errors: ["invalid from stage"] }, { status: 400 });
  }

  const token = process.env.ADMIN_TOKEN;
  const base = process.env.OVERLAY_PUBLISH_BASE_URL?.replace(/\/+$/, "");
  if (!token || !base) {
    return NextResponse.json(
      { ok: false, errors: ["overlay target not configured (set OVERLAY_PUBLISH_BASE_URL + ADMIN_TOKEN)"] },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(`${base}/api/admin/content/stage`, {
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
    console.info("[dev/promote]", { id, kind, from, to });
    return NextResponse.json({ ok: true, from: data.from ?? from, to: data.to ?? to });
  } catch {
    return NextResponse.json({
      ok: false,
      errors: ["promote failed: network error reaching the target"],
    });
  }
}
