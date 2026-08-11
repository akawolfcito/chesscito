/**
 * POST /api/dev/publish — db-content overlay-full (Stage 6).
 *
 * Dev-only "todo en 1" publish: writes the baseline `content/*.json` (so the
 * puzzle is versioned in git) AND publishes it to the live overlay (so it is
 * live without a redeploy), in one action. The ADMIN_TOKEN is read server-side
 * and forwarded to the overlay write route — it NEVER reaches the browser.
 *
 * Fail-closed + partial-failure aware:
 *  - 404 in production (NODE_ENV guard) — same as /api/dev/labyrinth.
 *  - Baseline write first (local, reliable). If it fails (e.g. unsolvable),
 *    NOTHING is published and the overlay step is skipped.
 *  - Overlay second (network). A baseline success + overlay failure is a
 *    PARTIAL result, not fatal — the founder can retry publish or commit json.
 *  - Overlay errors are sanitized (curated by status) — the raw upstream body
 *    (which may carry DB connection strings) and the token are never echoed.
 */
import { NextResponse } from "next/server";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import type { ContentBucket } from "@/lib/content/overlay-types";
import { writeBaselineRecord } from "@/lib/content/baseline-write";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

export const runtime = "nodejs";

/** `bucket` = which file. NOT the record's `kind` (which game), which rides
 *  inside `record` and is forwarded untouched. The two used to share the name
 *  `kind`, which put two different meanings in one payload. */
type PublishBody = { bucket?: ContentBucket; record?: LabyrinthRecord };

type OverlayResult = { ok: boolean; revalidated?: boolean; errors: string[] };

/** Curated, leak-free message per upstream status. We never echo the raw
 *  admin-route body (it may include DB error detail) or the token. */
function overlayErrorForStatus(status: number): string {
  switch (status) {
    case 403:
      return "overlay publish rejected: admin token rejected (403)";
    case 429:
      return "overlay publish rejected: rate limited (429)";
    case 400:
      return "overlay publish rejected: record rejected by validation (400)";
    case 503:
      return "overlay publish unavailable: store or admin writes disabled (503)";
    case 500:
      return "overlay publish failed: server error (500)";
    default:
      return `overlay publish failed: HTTP ${status}`;
  }
}

/** ⚠️ Boundary: the admin overlay contract still calls the bucket `kind` on the
 *  wire (it is token-authed network input, out of scope to rename here), so the
 *  mapping happens at this seam and nowhere else. Inside the dev surfaces the
 *  axis is `bucket`. */
async function publishToOverlay(
  bucket: ContentBucket,
  record: LabyrinthRecord,
  origin: string,
): Promise<OverlayResult> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return { ok: false, errors: ["overlay target not configured (set ADMIN_TOKEN)"] };
  }
  try {
    const res = await fetch(`${origin}/api/admin/content`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      // `kind:` here is the ADMIN wire's name for the bucket — see the note above.
      body: JSON.stringify({ kind: bucket, record }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; revalidated?: boolean; errors?: unknown }
      | null;
    // ⚠️ Forward the route's own message ONLY on 400, and map every other status
    // to the fixed blurb.
    //
    // A 400 body is VALIDATION text we authored — the Star Sweep refusal names
    // the level, says why the table cannot hold it, and points at
    // `content/exercises.json` + `pnpm import-puzzles`. Flattening it to "record
    // rejected by validation" was true and useless, and hid the instructions
    // from the one person who needed them.
    //
    // ⛔ Any OTHER status must keep the blurb. A 500 body is
    // `[error.message]` straight from Supabase, which can carry a connection
    // string or a host — forwarding that verbatim is a leak, and the existing
    // "never surfaces credentials" test caught exactly that when this passed
    // every status through.
    const detail =
      res.status === 400 && Array.isArray(data?.errors)
        ? data.errors.filter((e): e is string => typeof e === "string")
        : [];
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        errors: detail.length ? detail : [overlayErrorForStatus(res.status)],
      };
    }
    return { ok: true, revalidated: Boolean(data.revalidated), errors: [] };
  } catch {
    // Network/abort — never surface the underlying error object.
    return { ok: false, errors: ["overlay publish failed: network error reaching the target"] };
  }
}

export async function POST(req: Request) {
  if (!isDevSurfaceEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        baseline: { ok: false, errors: ["invalid JSON"] },
        overlay: { ok: false, errors: ["skipped: invalid request"] },
      },
      { status: 400 },
    );
  }

  const bucket: ContentBucket = body.bucket === "exercise" ? "exercise" : "labyrinth";
  const record = body.record;
  if (!record || typeof record !== "object") {
    return NextResponse.json(
      {
        ok: false,
        baseline: { ok: false, errors: ["missing record"] },
        overlay: { ok: false, errors: ["skipped: no record"] },
      },
      { status: 400 },
    );
  }

  // Step 1 — baseline (local, reliable). On failure, do NOT publish.
  const baseline = writeBaselineRecord(bucket, record);
  if (!baseline.ok) {
    return NextResponse.json(
      {
        ok: false,
        baseline: { ok: false, errors: baseline.errors },
        overlay: { ok: false, errors: ["skipped: baseline write failed"] },
      },
      { status: 400 },
    );
  }

  // Step 2 — overlay (network). The id comes off the result (the writer does not
  // mutate `record`), so pin it on explicitly.
  const origin = new URL(req.url).origin;
  const overlay = await publishToOverlay(bucket, { ...record, id: baseline.id }, origin);

  // Audit — never log the token.
  console.info("[dev/publish]", {
    id: baseline.id,
    bucket,
    baseline: baseline.ok,
    overlay: overlay.ok,
  });

  return NextResponse.json({
    ok: overlay.ok,
    baseline: { ok: true, id: baseline.id, warnings: baseline.warnings },
    overlay,
  });
}
