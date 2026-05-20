"use client";

import { useSyncExternalStore } from "react";

/** Dock-driven auxiliary sheets that pages mount as siblings to the
 *  PersistentDock. Pages publish their currently-open sheet here so the
 *  dock's center button can switch its behavior from "swap routes" to
 *  "close overlay" without prop-drilling through the route tree. */
export type DockSheetSlug =
  | "badge"
  | "shop"
  | "trophies"
  | "leaderboard"
  | "arena";

let currentSheet: DockSheetSlug | null = null;
const listeners = new Set<() => void>();
let closer: (() => void) | null = null;

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
