/**
 * Pure decision function for the end-state popup X-close button.
 *
 * Extracted from arena/page.tsx into its own module so it can be:
 *  - unit-tested without importing the full page component tree
 *  - exported without violating Next.js App Router page export constraints
 *    (page files may only export: default, metadata, generateMetadata,
 *     generateStaticParams, and a fixed set of Next.js named exports)
 */

export type XCloseInput = {
  persistState: "idle" | "persisting" | "persisted" | "failed" | "dismissed";
  claimPhase: "ready" | "claiming" | "success" | "error" | "timeout";
  walletAddress?: `0x${string}`;
  gameId?: string;
  /** Review F6 (2026-06-13): a 0-move game (e.g. instant resign) has nothing
   *  to review — routing it to /coach/[gameId] lands on an empty board. When
   *  true, a persisted close goes to the Training Journal instead. */
  tooShort?: boolean;
};

export type XCloseEffect =
  | { type: "push"; href: string }
  | { type: "set-pending" }
  | { type: "noop" };

/**
 * Returns the navigation effect for tapping X on the end-state popup.
 *
 * State machine table:
 *  claimPhase === "claiming"   → noop   (X locked while mint is in flight)
 *  no walletAddress            → push /arena?fresh=1
 *  persisted + tooShort        → push /coach/history (Journal — nothing to review)
 *  persistState === "persisted" + gameId → push /coach/[gameId]
 *  persistState === "persisting"          → set-pending (deferred nav)
 *  failed / dismissed / idle             → push /arena?fresh=1
 */
export function evaluateXClose(input: XCloseInput): XCloseEffect {
  // X is LOCKED during claiming — claim must resolve first.
  if (input.claimPhase === "claiming") {
    return { type: "noop" };
  }
  // Guest (no wallet) → /arena?fresh=1 directly.
  if (!input.walletAddress) {
    return { type: "push", href: "/arena?fresh=1" };
  }
  switch (input.persistState) {
    case "persisted":
      // Review F6: a 0-move game has no review surface — send the player to
      // the Training Journal (with its PLAY shortcut) instead of an empty
      // /coach/[gameId] board.
      if (input.tooShort) {
        return {
          type: "push",
          href: `/coach/history?wallet=${input.walletAddress}`,
        };
      }
      if (input.gameId) {
        return {
          type: "push",
          href: `/coach/${input.gameId}?wallet=${input.walletAddress}`,
        };
      }
      return { type: "push", href: "/arena?fresh=1" };
    case "persisting":
      return { type: "set-pending" };
    case "failed":
    case "dismissed":
    case "idle":
    default:
      return { type: "push", href: "/arena?fresh=1" };
  }
}
