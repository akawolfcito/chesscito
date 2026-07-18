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
import { THEMES, type ThemeAssetKey, type ThemeAssetVariant } from "./theme-registry";

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
};

/** Resolves a basename (no extension) to its on-disk file + dimensions. */
export type AssetResolver = (basename: string) => Promise<ResolvedFile>;

/** A resolved asset for one variant, carrying its declared basename. */
export type ResolvedAsset = ResolvedFile & { basename: string };

export type SlotCatalogEntry = {
  key: ThemeAssetKey;
  usedIn: string[];
  default: ResolvedAsset;
  /** null when the slot declares no PRO override (reuses default). */
  pro: ResolvedAsset | null;
  proReusesDefault: boolean;
};

export type ThemeCatalog = {
  id: string;
  name: string;
  slots: SlotCatalogEntry[];
};

async function resolveVariant(
  basename: string,
  resolve: AssetResolver,
): Promise<ResolvedAsset> {
  const resolved = await resolve(basename);
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
      const def = await resolveVariant(entry.default, resolve);
      const pro = entry.pro
        ? await resolveVariant(entry.pro, resolve)
        : null;
      return {
        key,
        usedIn: entry.usedIn ?? [],
        default: def,
        pro,
        proReusesDefault: pro === null,
      };
    }),
  );

  return { id: theme.id, name: theme.name, slots };
}

/** Ids of every theme the registry knows — for the catalog theme picker. */
export function listThemeIds(): string[] {
  return Object.keys(THEMES);
}

export type { ThemeAssetKey, ThemeAssetVariant };
export { TRIPLET_EXTENSIONS };
