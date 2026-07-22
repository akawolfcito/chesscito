/**
 * App roots for theme assets.
 *
 * The catalog spans two Next apps that each ship their own `public/`:
 * `apps/web` (the game) and `apps/landing` (the marketing carousel). A slot
 * declares which one owns its file via `ThemeAssetEntry.root`; everything that
 * touches the filesystem resolves that declaration through here.
 *
 * SECURITY CONTRACT: the whitelist below is closed and the mapping is fixed.
 * A root arrives from the registry, never from a request, and an unknown value
 * throws rather than resolving — so a registry typo can't widen the write
 * surface to an arbitrary directory.
 *
 * Server-only: imports `node:path`. Client code may import the `AppRoot` type
 * from `theme-registry`, never this module.
 */
import path from "node:path";

import type { AppRoot } from "./theme-registry";

/** Every root the catalog knows, in catalog display order. */
export const APP_ROOT_IDS = ["web", "landing"] as const;

export function isAppRoot(value: unknown): value is AppRoot {
  return (APP_ROOT_IDS as readonly unknown[]).includes(value);
}

/**
 * Absolute directory of the app that owns a slot's asset. `undefined` means
 * the web app — the backward-compatible default for the ~162 slots that
 * predate multi-root support.
 *
 * Assumes the process cwd is `apps/web` (how every server surface and the
 * audit script run), so `apps/landing` is its sibling.
 */
export function resolveAppRoot(root: AppRoot | undefined): string {
  if (root === undefined || root === "web") return process.cwd();
  if (root === "landing") return path.resolve(process.cwd(), "..", "landing");
  throw new Error(`unknown theme asset root: ${String(root)}`);
}
