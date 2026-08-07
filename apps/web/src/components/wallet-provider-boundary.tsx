"use client";

import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { WalletBranchErrorBoundary } from "@/components/wallet-branch-error-boundary";
import { walletBranchLoaders } from "@/components/wallet-branch-loaders";
import { WalletShell } from "@/components/wallet-shell";
import { isMiniPayEnv } from "@/lib/minipay";
import { resolveWalletBranch, type MountedWalletBranch } from "@/lib/wallet/wallet-branch";
import { resolveWalletShellVariant } from "@/lib/wallet/wallet-shell-variant";

/** `NEXT_PUBLIC_PRIVY_ENABLED === "true"`. Read in render so it stays inline for
 *  Next and stubbable in tests. ON in production on both projects — verified by
 *  rendering, 2026-08-06. Neither branch is dead code. */
function isPrivyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true";
}

/**
 * Chooses the wallet provider tree on the client and mounts exactly one of
 * `WalletProvider` (MiniPay / injected), `WebWalletProvider` (Privy web), or a
 * stable `WalletShell`.
 *
 * The environment can only be read after hydration — `isMiniPayEnv()` reads
 * `window`, so on the server it is `false` for everyone. Committing to a branch
 * there would strand MiniPay users in a hydration mismatch and remount wagmi.
 *
 * ⚠️ BOTH BRANCHES ARE LAZY, AND THAT CHANGES THE SERVER OUTPUT.
 * Before this, the flag being off meant the server rendered the injected
 * provider outright. It cannot any more: the branch's code is behind an
 * `import()` that only a browser fires, so every server render emits the shell
 * (spec AC2 / E1 — a deliberate change, not a regression). That is the price of
 * not shipping 2.2 MB of wallet code to a player who runs one of the branches.
 */
export function WalletProviderBoundary({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  /** Bumped by a retry. Part of the lazy component's memo key, so a retry builds
   *  a BRAND NEW lazy identity — the only way a fresh attempt can happen at all
   *  (spec C2c). Re-rendering the same one lands on the cached rejection without
   *  ever touching the network, which would make the button a lie. */
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const branch = resolveWalletBranch({
    privyEnabled: isPrivyEnabled(),
    hydrated,
    isMiniPay: hydrated ? isMiniPayEnv() : false,
  });

  // `hydrated` gates the branch as well as `resolveWalletBranch` does, and it is
  // not redundant: with the flag OFF that function answers `injected` even
  // before hydration, which was right while the tree was static and is wrong now
  // that mounting means firing an import().
  const mounted: MountedWalletBranch | null =
    hydrated && branch !== "undecided" ? branch : null;

  const LazyBranch = useMemo(
    () => (mounted ? lazy(() => walletBranchLoaders[mounted]()) : null),
    // ⛔ `attempt` is LOAD-BEARING and eslint cannot see why: it calls the
    // dependency "unnecessary" because the factory never reads it. Deleting it
    // turns Retry into a no-op — React memoizes a lazy component's outcome,
    // success and failure alike, per identity, so the same identity replays the
    // same rejection without touching the network. The disable stays, and
    // AC23 (which counts loader invocations) is what turns red if it goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, attempt],
  );

  if (!LazyBranch) {
    // `undecided`, or the server. A stable shell shared by SSR and the first
    // client render — no children and no wagmi hooks: mounting the app tree here
    // just to swap it is the double-mount this design exists to avoid.
    //
    // The route decides WHICH shell: the hub gets a silhouette, everything else
    // keeps the empty hole. `usePathname()` works during the prerender, so the
    // silhouette travels in the server HTML — measured, it paints ~2,2 s before
    // the branch. Deciding this after hydration would deliver it at ~4 s, which
    // is exactly when it stops being useful.
    return <WalletShell variant={resolveWalletShellVariant(pathname)} />;
  }

  return (
    <WalletBranchErrorBoundary
      key={attempt}
      onRetry={() => setAttempt((n) => n + 1)}
    >
      {/* Three owners, one each: Suspense owns the wait, the error boundary owns
          the terminal failure, the branch owns being mounted. `children` sits
          under the lazy component only — never under the fallback — so it mounts
          exactly once across shell → branch (AC7). */}
      <Suspense fallback={<WalletShell />}>
        <LazyBranch>{children}</LazyBranch>
      </Suspense>
    </WalletBranchErrorBoundary>
  );
}
