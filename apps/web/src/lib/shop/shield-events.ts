/** In-tab event bus for the `chesscito:shields` localStorage key. The
 *  browser's native `storage` event only fires across *other* tabs, not
 *  the writer's own tab — so when `useShopSheetState` bumps the count
 *  after `buyItem` confirms, the scaffold's shields chip in the *same*
 *  tab won't see it without a manual signal.
 *
 *  Tiny wrapper around a `CustomEvent` on `window` so consumers don't
 *  hardcode the event name and can be unit-tested in jsdom. */

const EVENT_NAME = "chesscito:shields-changed";

export function dispatchShieldChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** Subscribes to shield changes. Returns an unsubscribe fn — call it
 *  inside `useEffect`'s cleanup. The handler runs synchronously after
 *  `dispatchShieldChange()`, so callers can just re-read localStorage. */
export function subscribeToShieldChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
