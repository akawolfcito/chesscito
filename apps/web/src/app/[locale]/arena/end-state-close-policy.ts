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
  claimPhase: "ready" | "claiming" | "success" | "error" | "cancelled" | "timeout";
  walletAddress?: `0x${string}`;
  gameId?: string;
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
