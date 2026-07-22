import { notFound } from "next/navigation";
import Link from "next/link";

import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";
import { getThemeCatalog } from "@/lib/themes/catalog-server";
import { listThemeIds } from "@/lib/themes/catalog";
import { DEFAULT_THEME_ID } from "@/lib/themes/theme-registry";

import type { ResolvedAsset, SlotCatalogEntry } from "@/lib/themes/catalog";
import { UploadControl } from "./upload-control";
import { CopyPathButton } from "./copy-path-button";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

/** Group slots by their category — the key prefix before the first dot
 *  (`board.piece.rook` → `board`). Preserves first-seen order. */
function groupByCategory(slots: SlotCatalogEntry[]): [string, SlotCatalogEntry[]][] {
  const groups = new Map<string, SlotCatalogEntry[]>();
  for (const slot of slots) {
    const category = slot.key.split(".")[0];
    const bucket = groups.get(category);
    if (bucket) bucket.push(slot);
    else groups.set(category, [slot]);
  }
  return [...groups.entries()];
}

/**
 * Last two segments of a basename — `…/landing-slides/avatar-play-chess`.
 *
 * `truncate` clips the tail, which is the only part that names the asset:
 * the 18 landing slots all rendered as `/art/landing-slides/avat…`, so you
 * could not tell them apart or find one by filename. Full path stays in the
 * title tooltip and in the copy button.
 */
function shortPath(basename: string): string {
  const parts = basename.split("/").filter(Boolean);
  return parts.length <= 2 ? basename : `…/${parts.slice(-2).join("/")}`;
}

/**
 * What the cell prints under the preview.
 *
 * Missing dimensions do NOT mean a missing file: sharp cannot decode an .ico,
 * so a favicon that is right there on disk resolves with null width/height.
 * Reporting that as "missing on disk" sent you looking for a file that was
 * never gone — so the file itself decides, and size stands in for dimensions
 * when they are unreadable.
 */
function dims(a: ResolvedAsset): string {
  if (a.file == null) return "— missing on disk —";
  const kind = a.format?.toUpperCase() ?? "";
  if (a.width == null || a.height == null) {
    const size = a.bytes == null ? "on disk" : `${Math.round(a.bytes / 1024)} KB`;
    return `${size} · ${kind}`;
  }
  return `${a.width}×${a.height} · ${kind}`;
}

/**
 * Where the preview <img> reads from. Web-rooted slots are served straight
 * off this app's public dir; a slot owned by a sibling app has no such URL,
 * so it goes through the dev streaming route. `mtime` busts the cache after
 * a replace either way.
 */
function previewSrc(
  slot: SlotCatalogEntry,
  asset: ResolvedAsset,
  variant: "default" | "pro",
  themeId: string,
): string | null {
  if (!asset.file) return null;
  if (slot.root === "web") {
    return asset.mtime ? `${asset.file}?v=${asset.mtime}` : asset.file;
  }
  const query = new URLSearchParams({
    themeId,
    key: slot.key,
    variant,
    v: String(asset.mtime ?? 0),
  });
  return `/api/dev/theme-asset?${query}`;
}

function VariantCell({
  label,
  asset,
  src,
  mode,
  themeId,
  slotKey,
  variant,
  hasBackup,
  derivedFrom,
}: {
  label: string;
  asset: ResolvedAsset | null;
  /** Resolved by the caller — differs per owning app. Null when no file. */
  src: string | null;
  mode: "asset" | "inherit" | "none";
  themeId: string;
  slotKey: string;
  variant: "default" | "pro";
  hasBackup: boolean;
  /** Slot this art is generated from; makes the cell read-only. */
  derivedFrom?: string | null;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
        {mode !== "asset" && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium normal-case text-amber-300">
            {mode}
          </span>
        )}
      </div>
      {asset && src ? (
        <img
          src={src}
          alt={`${label} — ${asset.basename}`}
          className="h-40 w-full rounded-lg border border-neutral-700 bg-neutral-800 object-contain"
        />
      ) : mode !== "asset" ? (
        <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-800/40 text-xs text-neutral-500">
          {mode === "inherit" ? "reuses default" : "no image"}
        </div>
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-red-500/50 bg-red-500/5 text-xs text-red-300">
          no file
        </div>
      )}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="truncate text-[11px] text-neutral-500" title={asset?.basename}>
          {asset?.basename ? shortPath(asset.basename) : "—"}
        </span>
        {asset?.basename && <CopyPathButton path={asset.basename} />}
      </div>
      <div className="text-[11px] font-medium text-neutral-300">
        {asset ? dims(asset) : mode}
      </div>
      {asset?.familyState && (
        <div
          className={
            asset.familyState === "healthy"
              ? "mt-1 text-[11px] font-medium text-emerald-300"
              : "mt-1 text-[11px] font-medium text-amber-300"
          }
          data-testid={`responsive-family-state-${slotKey}-${variant}`}
          title={asset.familyIssues?.join(", ")}
        >
          responsive family · {asset.familyState}
        </div>
      )}
      <UploadControl
        themeId={themeId}
        slotKey={slotKey}
        variant={variant}
        mode={mode}
        hasBackup={hasBackup}
        derivedFrom={derivedFrom ?? undefined}
      />
    </div>
  );
}

export default async function ThemeBuilderDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const themeIds = listThemeIds();
  const raw = typeof searchParams.theme === "string" ? searchParams.theme : "";
  const themeId = themeIds.includes(raw) ? raw : DEFAULT_THEME_ID;
  const catalog = await getThemeCatalog(themeId);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-neutral-950 px-4 py-8 text-neutral-100">
      <header className="mb-6">
        <h1 className="text-xl font-bold">Theme Builder — Art Catalog</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Dev-only. Every slot the theme system manages today, with its{" "}
          <strong>default</strong> vs <strong>pro</strong> art and real
          dimensions. Grows as surfaces migrate off hardcoded paths.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {themeIds.map((id) => {
          const active = id === themeId;
          return (
            <Link
              key={id}
              href={`/dev/theme-builder?theme=${id}`}
              className={
                active
                  ? "rounded-full bg-emerald-500 px-3 py-1 text-sm font-semibold text-neutral-950"
                  : "rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:border-neutral-500"
              }
            >
              {id}
            </Link>
          );
        })}
      </nav>

      {!catalog ? (
        <p className="text-red-300">Unknown theme: {themeId}</p>
      ) : (
        <>
          <div className="mb-4 text-sm text-neutral-400">
            <span className="font-semibold text-neutral-200">{catalog.name}</span>{" "}
            · {catalog.slots.length} slot{catalog.slots.length === 1 ? "" : "s"}
          </div>
          <div className="space-y-8">
            {groupByCategory(catalog.slots).map(([category, slots]) => (
              <div key={category}>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-400">
                  {category}{" "}
                  <span className="ml-1 font-normal text-neutral-600">
                    {slots.length}
                  </span>
                </h2>
                <div className="space-y-5">
                  {slots.map((slot) => (
                    <section
                      key={slot.key}
                      className={
                        slot.deprecated
                          ? "rounded-xl border border-amber-600/60 bg-amber-950/20 p-4"
                          : "rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
                      }
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <code className="text-sm font-bold text-emerald-300">
                          {slot.key}
                        </code>
                        <span
                          data-testid={`theme-slot-surface-${slot.key}`}
                          className="rounded-full border border-sky-700/60 bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300"
                        >
                          {slot.surface}
                        </span>
                        {slot.root !== "web" && (
                          <span
                            data-testid={`theme-slot-root-${slot.key}`}
                            className="rounded-full border border-violet-700/60 bg-violet-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300"
                            title={`Reads and writes apps/${slot.root}/public`}
                          >
                            apps/{slot.root}
                          </span>
                        )}
                        {slot.format && (
                          <span
                            data-testid={`theme-slot-format-${slot.key}`}
                            className="rounded-full border border-neutral-600 bg-neutral-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-300"
                            title="Single file with a fixed extension — not a PNG/WebP/AVIF triplet"
                          >
                            {slot.format}
                          </span>
                        )}
                        {slot.derivedFrom && (
                          <span
                            data-testid={`theme-slot-derived-${slot.key}`}
                            className="rounded-full border border-sky-700/60 bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300"
                            title={`Generated from ${slot.derivedFrom}`}
                          >
                            derived
                          </span>
                        )}
                        {slot.derivedBy.length > 0 && (
                          <span
                            data-testid={`theme-slot-master-${slot.key}`}
                            className="rounded-full border border-emerald-600/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300"
                            title={`Replacing this regenerates: ${slot.derivedBy.join(", ")}`}
                          >
                            master · regenerates {slot.derivedBy.length}
                          </span>
                        )}
                        <div className="max-w-xl text-right text-xs text-neutral-500">
                          {slot.usedIn.length ? (
                            slot.usedIn.map((location) => (
                              <div key={location}>{location}</div>
                            ))
                          ) : (
                            <div>usedIn: —</div>
                          )}
                        </div>
                      </div>
                      {slot.deprecated && (
                        <div className="mb-3 rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                          ⚠ deprecated — {slot.deprecated}
                        </div>
                      )}
                      <div className="flex gap-4">
                        <VariantCell
                          label="default"
                          asset={slot.default}
                          src={slot.default && previewSrc(slot, slot.default, "default", catalog.id)}
                          mode={slot.defaultMode}
                          themeId={catalog.id}
                          slotKey={slot.key}
                          variant="default"
                          hasBackup={slot.defaultHasBackup}
                          derivedFrom={slot.derivedFrom}
                        />
                        <VariantCell
                          label="pro"
                          asset={slot.pro}
                          src={slot.pro && previewSrc(slot, slot.pro, "pro", catalog.id)}
                          mode={slot.proMode}
                          themeId={catalog.id}
                          slotKey={slot.key}
                          variant="pro"
                          hasBackup={slot.proHasBackup}
                          derivedFrom={slot.derivedFrom}
                        />
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
