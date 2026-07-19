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
import { writeAssetTriplet, restorePreviousTriplet } from "@/lib/themes/asset-triplet";
import { THEMES, type ThemeAssetEntry } from "@/lib/themes/theme-registry";
import { resolveAssetVariant, type AssetVariant } from "@/lib/themes/asset-variant";
import { setRegistryVariant } from "@/lib/themes/registry-editor";
import { readVariantUndo, saveVariantUndo } from "@/lib/themes/variant-undo";

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
  const action = String(form.get("action") ?? "upload");
  const file = form.get("file");

  const target = resolveUploadTarget(themeId, key, variant);
  if (!target.ok) {
    return NextResponse.json({ ok: false, error: target.reason }, { status: 400 });
  }
  const typedVariant = variant as "default" | "pro";
  const entry = (THEMES[themeId].assets as Record<string, ThemeAssetEntry>)[key];
  const current = resolveAssetVariant(entry, typedVariant);

  // Undo restores both the registry state and the triplet when the last action
  // was an upload. Old triplet-only backups remain supported.
  if (action === "undo") {
    const stateUndo = await readVariantUndo(themeId, key, typedVariant);
    let restored: string[] = [];
    if (stateUndo) {
      if (stateUndo.restoreRegistry) {
        await setRegistryVariant(themeId, key, typedVariant, stateUndo.previous);
      }
      if (stateUndo.restoreTriplet && stateUndo.basename) {
        const triplet = await restorePreviousTriplet(stateUndo.basename);
        restored = triplet.restored;
      }
    } else {
      const triplet = await restorePreviousTriplet(target.basename);
      if (triplet.ok) restored = triplet.restored;
    }
    if (!stateUndo && restored.length === 0) {
      return NextResponse.json({ ok: false, error: "nothing to undo" }, { status: 409 });
    }
    console.info("[dev/theme-asset] undo", { themeId, key, variant, basename: target.basename });
    return NextResponse.json({ ok: true, basename: target.basename, restored });
  }

  if (action === "set-mode") {
    const requestedMode = String(form.get("mode") ?? "");
    const allowed = typedVariant === "default"
      ? requestedMode === "none"
      : requestedMode === "inherit" || requestedMode === "none";
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: `invalid ${typedVariant} mode: ${requestedMode}` },
        { status: 400 },
      );
    }

    const next: AssetVariant = requestedMode === "inherit"
      ? { mode: "inherit" }
      : { mode: "none" };
    if (current.mode === next.mode) {
      return NextResponse.json({ ok: true, changed: false, mode: next.mode });
    }
    await saveVariantUndo(themeId, key, typedVariant, {
      previous: current,
      restoreTriplet: false,
      restoreRegistry: true,
    });
    await setRegistryVariant(themeId, key, typedVariant, next);
    console.info("[dev/theme-asset] mode", { themeId, key, variant, mode: next.mode });
    return NextResponse.json({ ok: true, changed: true, mode: next.mode });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file too large (max 15MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveVariantUndo(themeId, key, typedVariant, {
    previous: current,
    basename: target.basename,
    restoreTriplet: true,
    restoreRegistry: !target.declaresAsset,
  });
  let result: Awaited<ReturnType<typeof writeAssetTriplet>>;
  try {
    result = await writeAssetTriplet(target.basename, buffer);
  } catch {
    // sharp throws on an undecodable image — never echo the raw error.
    return NextResponse.json(
      { ok: false, error: "could not decode image — upload a valid PNG/JPG/WebP" },
      { status: 400 },
    );
  }

  if (!target.declaresAsset) {
    try {
      await setRegistryVariant(themeId, key, typedVariant, {
        mode: "asset",
        path: target.basename,
      });
    } catch {
      await restorePreviousTriplet(target.basename);
      return NextResponse.json(
        { ok: false, error: "image was valid, but the theme registry could not be updated" },
        { status: 500 },
      );
    }
  }
  console.info("[dev/theme-asset]", { themeId, key, variant, basename: target.basename });
  return NextResponse.json({ ok: true, basename: target.basename, ...result });
}
