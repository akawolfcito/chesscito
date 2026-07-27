/** Which wallet provider tree the app mounts.
 *
 *  - `injected` — the existing `WalletProvider` (wagmi + `injected()`), the tree
 *    MiniPay has always used.
 *  - `privy`    — `WebWalletProvider`, for logged-in web users outside MiniPay.
 *  - `undecided` — hydration has not confirmed the environment yet. Callers must
 *    render a stable shell, never a provider.
 */
export type WalletBranch = "injected" | "privy" | "undecided";

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
