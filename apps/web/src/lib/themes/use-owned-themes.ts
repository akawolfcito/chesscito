"use client";

import { DEFAULT_THEME_ID } from "./theme-registry";

/** Returns the list of theme ids the current wallet owns.
 *
 *  v1 returns just the default theme — everyone owns `candy-forest`
 *  without a purchase. Future iterations read from:
 *   - Shop on-chain ownership (Halloween pack, Christmas pack, …)
 *   - PRO status (PRO unlocks the `pro-gold-leaf` theme automatically)
 *
 *  Returning a stable array reference order means callsites can pass
 *  it to a memoized picker without reshuffling. */
export function useOwnedThemes(): readonly string[] {
  return [DEFAULT_THEME_ID];
}
