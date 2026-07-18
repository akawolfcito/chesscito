/**
 * POST /api/dev/theme-asset — upload a new image for a theme slot and write
 * its PNG/WebP/AVIF triplet (phase 2 of the theme-builder).
 *
 * Two gates, mirroring the builder:
 *  - isDevSurfaceEnabled() → 404 in production.
 *  - canWriteBaseline()    → 503 when running on Vercel. The write targets the
 *    working tree (public/art/**), and Vercel's fs is read-only, so Save is
 *    LOCAL-ONLY. Preview renders the tool but says why Save is off, never 500.
 *
 * SECURITY: the write path is derived from the registry via resolveUploadTarget,
 * NEVER from the request. The client only picks (theme, slot, variant).
 */
import { NextResponse } from "next/server";
import { isDevSurfaceEnabled, canWriteBaseline } from "@/lib/dev/dev-surface";
import { resolveUploadTarget } from "@/lib/themes/upload-target";
import { writeAssetTriplet } from "@/lib/themes/asset-triplet";

export const runtime = "nodejs";

/** Reject uploads larger than this — a theme asset is never this big. */
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isDevSurfaceEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!canWriteBaseline()) {
    return NextResponse.json(
      { ok: false, error: "Save is local-only — the Vercel filesystem is read-only." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 });
  }

  const themeId = String(form.get("themeId") ?? "");
  const key = String(form.get("key") ?? "");
  const variant = String(form.get("variant") ?? "");
  const file = form.get("file");

  const target = resolveUploadTarget(themeId, key, variant);
  if (!target.ok) {
    return NextResponse.json({ ok: false, error: target.reason }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file too large (max 15MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const result = await writeAssetTriplet(target.basename, buffer);
    console.info("[dev/theme-asset]", { themeId, key, variant, basename: target.basename });
    return NextResponse.json({ ok: true, basename: target.basename, ...result });
  } catch {
    // sharp throws on an undecodable image — never echo the raw error.
    return NextResponse.json(
      { ok: false, error: "could not decode image — upload a valid PNG/JPG/WebP" },
      { status: 400 },
    );
  }
}
