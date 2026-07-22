/** In-tab event bus for Peones balance changes.
 *
 *  The balance lives on the server (`/api/peones/balance`) and every
 *  reader goes through `usePeonesBalance`, which fetches on mount and on
 *  wallet change — and nothing else. That was fine while the only chip
 *  lived on `/hub`, but once a spend happens in the `/exercises` action
 *  row the chip in the tray above the board is a DIFFERENT hook instance
 *  with its own state: it keeps showing the pre-spend number until it
 *  remounts. Peones V1 UX (2026-07-21): a player must see the balance
 *  move when they earn or spend.
 *
 *  This is the same primitive the shields already use
 *  (`lib/shop/shield-events.ts`): a `CustomEvent` on `window` so the
 *  writer can tell every live reader "re-read the server".
 *
 *  Deliberately payload-free. Broadcasting the new balance would create a
 *  second source of truth that can disagree with the endpoint; the signal
 *  only says WHEN to look, never WHAT the value is. */

const EVENT_NAME = "chesscito:peones-changed";

/** What moved the balance. Carried so the chip can label its delta
 *  ("−2 · Hint") instead of showing a bare number the player has to
 *  attribute themselves.
 *
 *  This is NOT the amount and NOT the new balance — those stay derived
 *  from the server read. A reason cannot disagree with the ledger. */
export type PeonesChangeReason =
  | "hint"
  | "shield"
  | "coach"
  | "daily"
  | "milestone"
  | "pack";

/** Fire after a confirmed earn or spend — never optimistically. Callers
 *  must dispatch only on the success branch, once the server has
 *  acknowledged the write, so a failed transaction can never move the
 *  displayed balance. */
export function dispatchPeonesChange(reason?: PeonesChangeReason): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { reason } }));
}

/** Subscribes to balance changes. Returns an unsubscribe fn — call it
 *  inside `useEffect`'s cleanup. The handler runs synchronously after
 *  `dispatchPeonesChange()`; callers typically kick off a refetch. */
export function subscribeToPeonesChanges(
  handler: (reason?: PeonesChangeReason) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ reason?: PeonesChangeReason }>)
      .detail;
    handler(detail?.reason);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
