/**
 * Theme art catalog — server-side model behind `/dev/theme-builder`.
 *
 * Resolves each registered theme slot into a shape the catalog page can
 * render: the actual file on disk (probing the AVIF/WebP/PNG triplet),
 * its real dimensions, and whether the PRO variant reuses `default`.
 *
 * The orchestration (`buildThemeCatalog`) is pure — it takes an
 * `AssetResolver`, so it is testable without touching the filesystem.
 * The production resolver (`fsAssetResolver`) does the fs + sharp IO and
 * is only imported from server components. Dev-tool only.
 */
import {
  THEMES,
  THEME_SLOT_SURFACES,
  type AppRoot,
  type ThemeAssetKey,
  type ThemeAssetVariant,
  type ThemeSlotSurface,
} from "./theme-registry";
import { resolveAssetVariant, type ResolvedVariant } from "./asset-variant";
import type { ResponsiveFamilyState } from "./responsive-asset-audit";

/** Image formats that make up a static asset triplet, in probe order. */
const TRIPLET_EXTENSIONS = ["png", "webp", "avif"] as const;
export type AssetFormat = (typeof TRIPLET_EXTENSIONS)[number];

/** What a resolver reports for a single basename. */
export type ResolvedFile = {
  /** Absolute-from-public file with extension, or null when nothing on disk. */
  file: string | null;
  width: number | null;
  height: number | null;
  format: AssetFormat | null;
  /** Last-modified epoch ms of the resolved file — used as a cache-buster
   *  (`?v=<mtime>`) so a replaced image actually reloads in the browser.
   *  null when nothing is on disk. */
  mtime: number | null;
  /** True when a one-level undo backup exists for this basename, so the
   *  catalog can enable the "Undo" control. */
  hasBackup: boolean;
  /** Complete responsive-family health when this slot has a profile. */
  familyState?: ResponsiveFamilyState;
  familyIssues?: ResponsiveFamilyState[];
};

/** Resolves a basename (no extension) to its on-disk file + dimensions.
 *  `root` says which app's `public/` to probe — a basename alone is ambiguous
 *  now that some slots live in `apps/landing`. */
export type AssetResolver = (
  basename: string,
  context?: {
    key: ThemeAssetKey;
    variant: ThemeAssetVariant;
    root: AppRoot;
  },
) => Promise<ResolvedFile>;

/** A resolved asset for one variant, carrying its declared basename. */
export type ResolvedAsset = ResolvedFile & { basename: string };

export type SlotCatalogEntry = {
  key: ThemeAssetKey;
  surface: ThemeSlotSurface;
  /** App that owns the file — always resolved, `web` when undeclared. */
  root: AppRoot;
  usedIn: string[];
  /** null when DEFAULT is in none mode. */
  default: ResolvedAsset | null;
  /** null when PRO is in inherit or none mode. */
  pro: ResolvedAsset | null;
  defaultMode: ResolvedVariant["mode"];
  proMode: ResolvedVariant["mode"];
  defaultHasBackup: boolean;
  proHasBackup: boolean;
  proReusesDefault: boolean;
  /** True when the slot has NO default — a PRO-only overlay (gold frame, crown):
   *  free users see nothing, PRO users get `pro`. */
  proOnly: boolean;
  /** Deprecation reason when the slot is stale, else null. */
  deprecated: string | null;
};

export type ThemeCatalog = {
  id: string;
  name: string;
  slots: SlotCatalogEntry[];
};

async function resolveVariant(
  basename: string,
  resolve: AssetResolver,
  context: { key: ThemeAssetKey; variant: ThemeAssetVariant; root: AppRoot },
): Promise<ResolvedAsset> {
  const resolved = await resolve(basename, context);
  return { basename, ...resolved };
}

/**
 * Build the catalog for a theme using the given resolver. Pure over its
 * `resolve` dependency — no fs access here. Returns null for an
 * unregistered theme id.
 */
export async function buildThemeCatalog(
  themeId: string,
  resolve: AssetResolver,
): Promise<ThemeCatalog | null> {
  const theme = THEMES[themeId];
  if (!theme) return null;

  const keys = Object.keys(theme.assets) as ThemeAssetKey[];
  const slots = await Promise.all(
    keys.map(async (key): Promise<SlotCatalogEntry> => {
      const entry = theme.assets[key];
      const root: AppRoot = entry.root ?? "web";
      const defaultVariant = resolveAssetVariant(entry, "default");
      const proVariant = resolveAssetVariant(entry, "pro");
      const def = defaultVariant.mode === "asset"
        ? await resolveVariant(defaultVariant.path, resolve, { key, variant: "default", root })
        : null;
      const pro = proVariant.mode === "asset"
        ? await resolveVariant(proVariant.path, resolve, { key, variant: "pro", root })
        : null;
      return {
        key,
        surface: THEME_SLOT_SURFACES[key],
        root,
        usedIn: entry.usedIn ?? [],
        default: def,
        pro,
        defaultMode: defaultVariant.mode,
        proMode: proVariant.mode,
        defaultHasBackup: def?.hasBackup ?? false,
        proHasBackup: pro?.hasBackup ?? false,
        proReusesDefault: proVariant.mode === "inherit",
        proOnly: defaultVariant.mode === "none" && proVariant.mode === "asset",
        deprecated: entry.deprecated ?? null,
      };
    }),
  );

  return { id: theme.id, name: theme.name, slots };
}

/** Ids of every theme the registry knows — for the catalog theme picker. */
export function listThemeIds(): string[] {
  return Object.keys(THEMES);
}

export type { AppRoot, ThemeAssetKey, ThemeAssetVariant };
export { TRIPLET_EXTENSIONS };
