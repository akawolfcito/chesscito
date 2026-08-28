/**
 * Pure decision function for the end-state popup X-close button.
 *
 * Extracted from arena/page.tsx into its own module so it can be:
 *  - unit-tested without importing the full React component tree
 *  - exported without violating Next.js App Router page export constraints
 *    (page files may only export: default, metadata, generateMetadata,
 *     generateStaticParams, and a fixed set of Next.js named exports)
 *
 * ── 2026-08-28: the X CLOSES. It does not navigate. ───────────────────────
 * This used to be a five-branch router that sent the player to
 * /coach/[gameId], /coach/history or /arena?fresh=1 depending on wallet +
 * persist state. Measured over the 2.064 `arena_x_close_fired` of the
 * 2026-07-23 → 2026-08-28 window: **93,3% pushed into the Match Reviewer**
 * (1.159 people), which made the universal "get me out of here" gesture the
 * single largest entry point INTO the review funnel — and it was also the
 * #1 post-game action overall (15,4% of finishers).
 * See docs/audits/2026-08-28-core-loop-diagnostic.md §C.3 / §C.4.
 *
 * The Match Reviewer is now reachable ONLY through an explicit review CTA.
 *
 * Two branches deliberately survive, and neither is a navigation choice —
 * both protect an in-flight write:
 *
 *  - `claiming` → noop. The X stays locked while the mint is in flight so a
 *    stray tap cannot orphan a signature the wallet has already accepted.
 *  - `persisting` → set-pending. Navigating here would abort the
 *    `/api/games` POST via its AbortController and lose the game record;
 *    the page defers the exit until persist reaches a terminal state.
 */

/** The PLAY hub. `/` is the hub route — it is what emits `play_hub_view`. */
export const PLAY_HUB_HREF = "/";

export type XCloseInput = {
  persistState: "idle" | "persisting" | "persisted" | "failed" | "dismissed";
  claimPhase: "ready" | "claiming" | "success" | "error" | "timeout";
};

export type XCloseEffect =
  | { type: "push"; href: string }
  | { type: "set-pending" }
  | { type: "noop" };

/**
 * Returns the navigation effect for tapping X on the end-state popup.
 *
 * State machine table:
 *  claimPhase === "claiming"     → noop        (X locked while mint is in flight)
 *  persistState === "persisting" → set-pending (deferred exit, POST protected)
 *  everything else               → push "/"    (the PLAY hub)
 */
export function evaluateXClose(input: XCloseInput): XCloseEffect {
  // X is LOCKED during claiming — the claim must resolve first.
  if (input.claimPhase === "claiming") {
    return { type: "noop" };
  }
  // Do not tear down an in-flight persist; the page exits once it settles.
  if (input.persistState === "persisting") {
    return { type: "set-pending" };
  }
  return { type: "push", href: PLAY_HUB_HREF };
}
