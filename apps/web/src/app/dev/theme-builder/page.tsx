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

function dims(a: ResolvedAsset): string {
  if (a.width == null || a.height == null) return "— missing on disk —";
  return `${a.width}×${a.height} · ${a.format?.toUpperCase() ?? ""}`;
}

function VariantCell({
  label,
  asset,
  muted,
  themeId,
  slotKey,
  variant,
  canUpload,
  hasBackup,
}: {
  label: string;
  asset: ResolvedAsset | null;
  muted?: string;
  themeId: string;
  slotKey: string;
  variant: "default" | "pro";
  canUpload: boolean;
  hasBackup: boolean;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
        {muted && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium normal-case text-amber-300">
            {muted}
          </span>
        )}
      </div>
      {asset && asset.file ? (
        <img
          src={asset.mtime ? `${asset.file}?v=${asset.mtime}` : asset.file}
          alt={`${label} — ${asset.basename}`}
          className="h-40 w-full rounded-lg border border-neutral-700 bg-neutral-800 object-contain"
        />
      ) : muted ? (
        // Intentional: this variant reuses default — not an error.
        <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-800/40 text-xs text-neutral-500">
          ↳ reuses default
        </div>
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-red-500/50 bg-red-500/5 text-xs text-red-300">
          no file
        </div>
      )}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="truncate text-[11px] text-neutral-500" title={asset?.basename}>
          {asset?.basename ?? "—"}
        </span>
        {asset?.basename && <CopyPathButton path={asset.basename} />}
      </div>
      <div className="text-[11px] font-medium text-neutral-300">
        {asset ? dims(asset) : "reuses default"}
      </div>
      <UploadControl
        themeId={themeId}
        slotKey={slotKey}
        variant={variant}
        canUpload={canUpload}
        hasBackup={hasBackup}
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
                      className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                        <code className="text-sm font-bold text-emerald-300">
                          {slot.key}
                        </code>
                        <span className="text-xs text-neutral-500">
                          {slot.usedIn.length ? slot.usedIn.join(" · ") : "usedIn: —"}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <VariantCell
                          label="default"
                          asset={slot.default}
                          themeId={catalog.id}
                          slotKey={slot.key}
                          variant="default"
                          canUpload
                          hasBackup={slot.default.hasBackup}
                        />
                        <VariantCell
                          label="pro"
                          asset={slot.pro}
                          muted={slot.proReusesDefault ? "reuses default" : undefined}
                          themeId={catalog.id}
                          slotKey={slot.key}
                          variant="pro"
                          canUpload={!slot.proReusesDefault}
                          hasBackup={slot.pro?.hasBackup ?? false}
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
