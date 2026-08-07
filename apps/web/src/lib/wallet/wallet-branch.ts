/** Which wallet provider tree the app mounts.
 *
 *  - `injected` — the existing `WalletProvider` (wagmi + `injected()`), the tree
 *    MiniPay has always used.
 *  - `privy`    — `WebWalletProvider`, for logged-in web users outside MiniPay.
 *  - `undecided` — hydration has not confirmed the environment yet. Callers must
 *    render a stable shell, never a provider.
 */
export type WalletBranch = "injected" | "privy" | "undecided";

/**
 * The value of the `data-wallet-branch` attribute each provider renders.
 *
 * Derived from `WalletBranch` minus `undecided`: the shell is not a branch, it
 * is the absence of one, and it must never carry this attribute.
 *
 * ⚠️ This attribute is LOAD-BEARING in two independent ways, and that is the
 * point (spec 2026-08-07-wallet-branch-lazy-load, C4):
 *   1. Behaviour — tests assert that exactly one branch is mounted by querying
 *      it, so deleting it turns unit tests red.
 *   2. Bundle — the literal travels into that branch's chunk and survives
 *      minification, so the bundle guard can prove the chunk did NOT reach the
 *      root layout. An orphan `export const` would be tree-shaken and leave the
 *      guard green by absence, which is the failure mode this replaces.
 */
export type MountedWalletBranch = Exclude<WalletBranch, "undecided">;

/** The attribute name. One spelling, shared by the providers, the tests and the
 *  bundle guard — three readers that must never drift apart. */
export const WALLET_BRANCH_ATTR = "data-wallet-branch";

export type WalletBranchInput = {
  /** `NEXT_PUBLIC_PRIVY_ENABLED`. Baked at build time (`NEXT_PUBLIC_*`), so
   *  flipping it in the host's env needs a redeploy to take effect. */
  privyEnabled: boolean;
  /** Whether the client has mounted. False during SSR and first render. */
  hydrated: boolean;
  /** `isMiniPayEnv()`. Meaningless until `hydrated` is true — it reads `window`. */
  isMiniPay: boolean;
};

/**
 * Picks the wallet tree.
 *
 * `isMiniPayEnv()` reads `window`, so it is `false` during SSR (lib/minipay.ts:31).
 * Deciding from that value would make the server pick the web tree for everyone
 * and strand MiniPay users in a hydration mismatch, so this refuses to answer
 * until `hydrated` is true.
 *
 * With the flag off the answer is always `injected`, including before hydration:
 * the current tree renders exactly as it does today, with no extra shell.
 */
export function resolveWalletBranch({
  privyEnabled,
  hydrated,
  isMiniPay,
}: WalletBranchInput): WalletBranch {
  if (!privyEnabled) {
    return "injected";
  }

  if (!hydrated) {
    return "undecided";
  }

  return isMiniPay ? "injected" : "privy";
}
