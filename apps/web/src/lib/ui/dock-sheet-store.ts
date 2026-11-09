"use client";

import { useSyncExternalStore } from "react";

/** Dock-driven auxiliary sheets that pages mount as siblings to the
 *  PersistentDock. Pages publish their currently-open sheet here so the
 *  dock's center button can switch its behavior from "swap routes" to
 *  "close overlay" without prop-drilling through the route tree.
 *
 *  `"overlay"` is a sentinel for non-dock-side overlays (AccountSheet,
 *  ProSheet, ExerciseDrawer, etc.) — pages report it so the dock's
 *  center button still flips to "close overlay" mode even though no
 *  side-item light should be lit. Side items match against the
 *  specific slugs only; "overlay" matches none of them. */
export type DockSheetSlug =
  | "badge"
  | "shop"
  | "trophies"
  | "leaderboard"
  | "arena"
  | "overlay";

let currentSheet: DockSheetSlug | null = null;
const listeners = new Set<() => void>();
let closer: (() => void) | null = null;
let opener: ((slug: DockSheetSlug) => void) | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function setDockSheet(sheet: DockSheetSlug | null) {
  if (currentSheet === sheet) return;
  currentSheet = sheet;
  emit();
}

export function getDockSheet(): DockSheetSlug | null {
  return currentSheet;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** SSR-safe snapshot — the store is client-only state, so the server
 *  always renders the "no overlay" branch. */
function getServerSnapshot(): DockSheetSlug | null {
  return null;
}

export function useDockSheet(): DockSheetSlug | null {
  return useSyncExternalStore(subscribe, getDockSheet, getServerSnapshot);
}

/** Pages register a single close handler on mount; the dock's center
 *  button invokes it when an overlay is open. Returns the unregister
 *  function for use in the effect cleanup. */
export function registerDockSheetCloser(close: () => void): () => void {
  closer = close;
  return () => {
    if (closer === close) closer = null;
  };
}

/** Called by the dock's center button when an overlay is open. No-ops
 *  silently if no page registered a closer (e.g., the dock is mounted
 *  on a route that doesn't host auxiliary sheets). */
export function requestCloseDockSheet(): void {
  closer?.();
}

/** Pages that host auxiliary sheets register an opener; the dock's
 *  side items invoke it on same-route taps to open the matching sheet
 *  WITHOUT touching the URL. Cross-route taps (e.g. from /hub) keep
 *  the legacy URL-push fallback because the target page isn't mounted
 *  yet — no opener to dispatch to. */
export function registerDockSheetOpener(
  open: (slug: DockSheetSlug) => void,
): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
}

/** Called by the dock's side items on same-route taps. Returns true
 *  if an opener was registered and dispatched, false otherwise so the
 *  caller can fall back to URL navigation. */
export function requestOpenDockSheet(slug: DockSheetSlug): boolean {
  if (!opener) return false;
  opener(slug);
  return true;
}
