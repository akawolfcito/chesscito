"use client";

import { useSyncExternalStore } from "react";

/** "You have a score worth saving on-chain" hint. The exercises screen
 *  derives `canSaveOnChain` (a real, unsaved score with a Scoreboard
 *  contract available) and publishes it here so the PersistentDock —
 *  mounted as a sibling, without access to that screen's state — can
 *  light a pulsing dot on the LEADERS icon. Same signal drives the dot
 *  on the Missions band and the Leaders own-rank CTA, keeping a single
 *  source of truth for "there is something to save". */

let pending = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setSaveOnChainPending(next: boolean) {
  if (pending === next) return;
  pending = next;
  emit();
}

function getSnapshot(): boolean {
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** SSR-safe: client-only hint, the server always renders "no dot". */
function getServerSnapshot(): boolean {
  return false;
}

export function useSaveOnChainPending(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
