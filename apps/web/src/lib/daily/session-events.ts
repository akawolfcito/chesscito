/** In-tab event bus for daily session quota changes.
 *  CustomEvent only fires in the current tab — other tabs re-hydrate via
 *  visibilitychange. Mirrors the events.ts / shield-events.ts pattern. */

const EVENT_NAME = "chesscito:daily-session-changed";

export function dispatchDailySessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeToDailySessionChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
