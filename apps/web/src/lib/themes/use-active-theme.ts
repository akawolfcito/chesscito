"use client";

import { DEFAULT_THEME_ID } from "./theme-registry";

/** Returns the active theme id for the current user.
 *
 *  v1 ships hardcoded to {@link DEFAULT_THEME_ID} so the registry can
 *  land without user-facing theme switching. Future iterations layer
 *  in: (a) localStorage per-device preference, (b) Shop-purchased
 *  ownership check, (c) AccountSheet picker.
 *
 *  Adopting this hook now means consumers stay correct when the
 *  selection logic evolves — no callsite change required. */
export function useActiveTheme(): string {
  return DEFAULT_THEME_ID;
}
