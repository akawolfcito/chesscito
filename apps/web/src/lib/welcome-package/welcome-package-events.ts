/** In-tab event bus for the `chesscito:welcome-package` localStorage key.
 *  Same shape as `lib/shop/shield-events.ts`, for the same reason: the
 *  browser's native `storage` event only fires in *other* tabs, so a
 *  component holding a React mirror of this key never learns that another
 *  writer in the SAME tab moved it.
 *
 *  This matters here because every writer rewrites the WHOLE object. Two
 *  writers now exist in the exercises tree — `useWelcomePackage()` (owned
 *  by `<DailyTacticSlot>`) and `claimWelcomePackageGift()` (the celebration
 *  queue's gift modal). A mount-time snapshot that is never invalidated
 *  would let `markShown()` spread a stale `claimed: false` back over a gift
 *  the player already claimed. Write, THEN notify — and re-read on notify. */

const EVENT_NAME = "chesscito:welcome-package-changed";

export function dispatchWelcomePackageChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** Subscribes to welcome-package changes. Returns an unsubscribe fn — call
 *  it inside `useEffect`'s cleanup. The handler runs synchronously after
 *  `dispatchWelcomePackageChange()`, so callers can just re-read storage. */
export function subscribeToWelcomePackageChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
