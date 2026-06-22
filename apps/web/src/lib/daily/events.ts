/** In-tab event bus for `chesscito:daily-progress` localStorage key.
 *  The browser's native `storage` event only fires in *other* tabs, not
 *  in the tab that wrote the value — so when `recordDailyCompletion` persists
 *  new streak data, consumers in the *same* tab (e.g. HubScaffoldClient's
 *  Focus Passport + Content Loop) won't see it without a manual signal.
 *
 *  Mirrors the `shield-events.ts` pattern exactly. */

const EVENT_NAME = "chesscito:daily-progress-changed";

export function dispatchDailyProgressChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** Subscribes to daily-progress changes. Returns an unsubscribe fn — call
 *  it inside `useEffect`'s cleanup to avoid memory leaks. The handler runs
 *  synchronously after `dispatchDailyProgressChanged()` so callers can
 *  immediately re-read localStorage. */
export function subscribeToDailyProgressChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
