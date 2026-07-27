/** In-tab event bus for `chesscito:daily-progress` localStorage key.
 *  The browser's native `storage` event only fires in *other* tabs, not
 *  in the tab that wrote the value — so when `recordDailyCompletion` persists
 *  new streak data, consumers in the *same* tab (e.g. HubScaffoldClient's
 *  Focus Passport + Content Loop) won't see it without a manual signal.
 *
 *  Mirrors the `shield-events.ts` pattern exactly. */

const EVENT_NAME = "chesscito:daily-progress-changed";
const COMPLETED_EVENT_NAME = "chesscito:daily-completed";

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

/** A DEDICATED channel for "a Daily completion was just recorded", carrying the
 *  UTC date that was recorded.
 *
 *  It exists because the ledger WRITE hangs off it, and `daily-progress-changed`
 *  is not safe for that: it fires from two places, on any progress change, and
 *  tests emit it by hand — anyone who dispatched it would mint a row. This one
 *  is emitted at the single write point (`recordDailyCompletion`) and only when
 *  the state actually changed, never on the same-day no-op. */
export function dispatchDailyCompleted(dateUtc: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPLETED_EVENT_NAME, { detail: dateUtc }));
}

/** Subscribes to Daily completions. The handler receives the recorded UTC date.
 *  Returns an unsubscribe fn — call it in `useEffect`'s cleanup. */
export function subscribeToDailyCompleted(handler: (dateUtc: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail === "string") handler(detail);
  };
  window.addEventListener(COMPLETED_EVENT_NAME, listener);
  return () => window.removeEventListener(COMPLETED_EVENT_NAME, listener);
}
