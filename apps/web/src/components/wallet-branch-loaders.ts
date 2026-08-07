import type { ComponentType, ReactNode } from "react";

import type { MountedWalletBranch } from "@/lib/wallet/wallet-branch";

/** What both branches are, from the boundary's point of view: something that
 *  wraps the app tree. Nothing else about them is shared. */
export type WalletBranchComponent = ComponentType<{ children: ReactNode }>;

type WalletBranchLoader = () => Promise<{ default: WalletBranchComponent }>;

/**
 * The split point (spec 2026-08-07-wallet-branch-lazy-load, C2).
 *
 * These two `import()` calls are the ONLY references to the branch components
 * outside their own trees. That is what buys the split: a static import of
 * either one from a module the root layout reaches puts the whole branch back
 * into every route's first load — which is the 2.2 MB defect this replaces.
 *
 * ⚠️ Both are LITERAL, per-branch imports on purpose. A single
 * `import(`@/components/${branch}`)` would make webpack bundle EVERY module in
 * that directory into the chunk, which quietly undoes the split while looking
 * tidier.
 *
 * They live in their own module so a test can count invocations: the retry
 * contract (C2c) is not "a button exists", it is "a second attempt actually
 * happened", and that is only observable here.
 */
export const walletBranchLoaders: Record<MountedWalletBranch, WalletBranchLoader> = {
  injected: () =>
    import("@/components/wallet-provider").then((module) => ({
      default: module.WalletProvider,
    })),
  privy: () =>
    import("@/components/web-wallet-provider").then((module) => ({
      default: module.WebWalletProvider,
    })),
};
