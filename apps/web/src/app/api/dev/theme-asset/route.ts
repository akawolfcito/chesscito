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
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { isDevSurfaceEnabled, canWriteBaseline } from "@/lib/dev/dev-surface";
import { resolveUploadTarget } from "@/lib/themes/upload-target";
import {
  AssetFamilyError,
  replaceAssetFamilyAtomic,
  restorePreviousAssetFamilyAtomic,
} from "@/lib/themes/asset-triplet";
import { THEMES, type ThemeAssetEntry } from "@/lib/themes/theme-registry";
import { resolveAssetVariant, type AssetVariant } from "@/lib/themes/asset-variant";
import { setRegistryVariant } from "@/lib/themes/registry-editor";
import { readVariantUndo, saveVariantUndo } from "@/lib/themes/variant-undo";
import { resolveAppRoot } from "@/lib/themes/asset-roots";

export const runtime = "nodejs";

/** Reject uploads larger than this — a theme asset is never this big. */
const MAX_BYTES = 15 * 1024 * 1024;

function assetFamilyError(error: unknown): NextResponse {
  if (!(error instanceof AssetFamilyError)) {
    return NextResponse.json(
      { ok: false, error: "asset family update failed" },
      { status: 500 },
    );
  }
  const messages: Record<AssetFamilyError["code"], string> = {
    "invalid-image": "could not decode image — upload a valid PNG/JPG/WebP",
    "source-too-small": "source image is too small for this responsive slot",
    "generation-failed": "one or more optimized image variants could not be generated",
    "validation-failed": "generated image family failed final validation",
    "registry-failed": "theme registry could not be updated",
    "metadata-failed": "asset family metadata could not be persisted",
    "write-failed": "image family could not be written atomically",
    "rollback-failed": "image family update failed and rollback needs attention",
    "undo-missing": "nothing to undo",
    "undo-failed": "previous image family could not be restored atomically",
  };
  const clientError = error.code === "invalid-image" || error.code === "source-too-small";
  return NextResponse.json(
    { ok: false, error: messages[error.code], code: error.code },
    { status: clientError ? 400 : 500 },
  );
}

/** Probe order matches the catalog's, so the preview shows the same file the
 *  catalog reports dimensions for. A single-file slot narrows this to its own
 *  container — see the `format` filter in GET. */
const PREVIEW_FORMATS = [
  { extension: "png", type: "image/png" },
  { extension: "webp", type: "image/webp" },
  { extension: "avif", type: "image/avif" },
  { extension: "jpg", type: "image/jpeg" },
  { extension: "ico", type: "image/x-icon" },
] as const;

/**
 * GET /api/dev/theme-asset?themeId=&key=&variant= — stream a slot's current
 * image.
 *
 * Only reason this exists: `apps/web`'s dev server serves `apps/web/public`,
 * so a landing-rooted slot has no URL the catalog page could point an <img>
 * at. Same security contract as the POST — the path comes from the registry
 * via resolveUploadTarget, never from the query.
 */
export async function GET(req: Request) {
  if (!isDevSurfaceEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = new URL(req.url).searchParams;
  const target = resolveUploadTarget(
    String(params.get("themeId") ?? ""),
    String(params.get("key") ?? ""),
    String(params.get("variant") ?? ""),
  );
  if (!target.ok) {
    return NextResponse.json({ ok: false, error: target.reason }, { status: 400 });
  }

  const publicDir = path.join(resolveAppRoot(target.root), "public");
  const relative = target.basename.replace(/^\//, "");
  // A single-file slot has exactly one legal container; probing the rest would
  // stream a stale sibling that nothing renders.
  const formats = target.format
    ? PREVIEW_FORMATS.filter((candidate) => candidate.extension === target.format)
    : PREVIEW_FORMATS;
  for (const { extension, type } of formats) {
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(path.join(publicDir, `${relative}.${extension}`));
    } catch {
      continue;
    }
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        // The whole point is seeing a replacement immediately.
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json(
    { ok: false, error: "no file on disk for this slot" },
    { status: 404 },
  );
}

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
  // A derived slot has no independent source of truth — writing it, changing
  // its mode or undoing it would all be erased by the next regeneration.
  // Refused here, for every action, not just hidden in the UI.
  if (target.derivedFrom) {
    return NextResponse.json(
      {
        ok: false,
        error: `${key} is derived from ${target.derivedFrom} — replace that slot instead`,
        code: "derived-slot",
      },
      { status: 400 },
    );
  }
  const typedVariant = variant as "default" | "pro";
  const entry = (THEMES[themeId].assets as Record<string, ThemeAssetEntry>)[key];
  const current = resolveAssetVariant(entry, typedVariant);
  // Which app's public/ the write lands in. Comes from the registry via the
  // target, never from the request, and is a closed two-value whitelist.
  const rootDir = resolveAppRoot(target.root);

  // Undo restores both the registry state and the triplet when the last action
  // was an upload. Old triplet-only backups remain supported.
  if (action === "undo") {
    const stateUndo = await readVariantUndo(themeId, key, typedVariant);
    let restored: string[] = [];
    try {
      if (stateUndo) {
        const restoresFamily = stateUndo.restoreFamily ?? stateUndo.restoreTriplet ?? false;
        if (restoresFamily && stateUndo.basename) {
          const family = await restorePreviousAssetFamilyAtomic({
            basename: stateUndo.basename,
            rootDir,
            afterRestore: stateUndo.restoreRegistry
              ? () => setRegistryVariant(themeId, key, typedVariant, stateUndo.previous)
              : undefined,
            rollbackAfterRestore: stateUndo.restoreRegistry
              ? () => setRegistryVariant(themeId, key, typedVariant, current)
              : undefined,
          });
          if (!family.ok) {
            return NextResponse.json(
              { ok: false, error: "nothing to undo" },
              { status: 409 },
            );
          }
          restored = family.restored;
        } else if (stateUndo.restoreRegistry) {
          await setRegistryVariant(themeId, key, typedVariant, stateUndo.previous);
        }
      } else {
        const family = await restorePreviousAssetFamilyAtomic({
          basename: target.basename,
          rootDir,
        });
        if (family.ok) restored = family.restored;
      }
    } catch (error) {
      return assetFamilyError(error);
    }
    if (!stateUndo && restored.length === 0) {
      return NextResponse.json({ ok: false, error: "nothing to undo" }, { status: 409 });
    }
      console.info("[dev/theme-asset] undo", { themeId, key, variant, root: target.root, basename: target.basename });
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
    try {
      await setRegistryVariant(themeId, key, typedVariant, next);
      try {
        await saveVariantUndo(themeId, key, typedVariant, {
          previous: current,
          restoreFamily: false,
          restoreRegistry: true,
        });
      } catch {
        await setRegistryVariant(themeId, key, typedVariant, current);
        return NextResponse.json(
          { ok: false, error: "variant mode could not be saved atomically" },
          { status: 500 },
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "theme registry could not be updated" },
        { status: 500 },
      );
    }
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
  let result: Awaited<ReturnType<typeof replaceAssetFamilyAtomic>>;
  try {
    result = await replaceAssetFamilyAtomic({
      basename: target.basename,
      input: buffer,
      rootDir,
      profile: target.responsiveProfile,
      afterPromote: target.declaresAsset
        ? undefined
        : () => setRegistryVariant(themeId, key, typedVariant, {
            mode: "asset",
            path: target.basename,
          }),
      rollbackAfterPromote: target.declaresAsset
        ? undefined
        : () => setRegistryVariant(themeId, key, typedVariant, current),
      persistUndoState: () => saveVariantUndo(themeId, key, typedVariant, {
        previous: current,
        basename: target.basename,
        restoreFamily: true,
        restoreRegistry: !target.declaresAsset,
      }),
    });
  } catch (error) {
    return assetFamilyError(error);
  }
  console.info("[dev/theme-asset]", { themeId, key, variant, root: target.root, basename: target.basename });
  return NextResponse.json({ ok: true, basename: target.basename, ...result });
}
