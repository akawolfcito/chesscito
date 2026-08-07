"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { WalletBranchErrorBoundary } from "@/components/wallet-branch-error-boundary";
import { WalletProvider } from "@/components/wallet-provider";
import { WebWalletProvider } from "@/components/web-wallet-provider";
import { isMiniPayEnv } from "@/lib/minipay";
import { resolveWalletBranch } from "@/lib/wallet/wallet-branch";

/** `NEXT_PUBLIC_PRIVY_ENABLED === "true"`. Read in render so it stays inline for
 *  Next and stubbable in tests. Off in production. */
function isPrivyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true";
}

/**
 * Chooses the wallet provider tree on the client and mounts exactly one of
 * `WalletProvider` (MiniPay / injected), `WebWalletProvider` (Privy web), or a
 * stable `undecided` shell.
 *
 * The environment can only be read after hydration — `isMiniPayEnv()` reads
 * `window`, so on the server it is `false` for everyone. Committing to a branch
 * there would strand MiniPay users in a hydration mismatch and remount wagmi.
 * So this refuses to decide until `hydrated`, feeding that fact to
 * `resolveWalletBranch`, and `isMiniPayEnv()` is only ever called on the client.
 *
 * With the flag off `resolveWalletBranch` returns `injected` even before
 * hydration, so the tree renders exactly as it does today — no shell, no
 * remount.
 */
export function WalletProviderBoundary({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  /** Bumped by a retry. Used as the boundary's `key`, so a retry REMOUNTS the
   *  subtree instead of re-rendering it — the only way a fresh attempt can
   *  happen at all (spec C2c). Re-rendering would land on the same cached
   *  rejection without touching the network. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const branch = resolveWalletBranch({
    privyEnabled: isPrivyEnabled(),
    hydrated,
    isMiniPay: hydrated ? isMiniPayEnv() : false,
  });

  if (branch !== "undecided") {
    const Branch = branch === "injected" ? WalletProvider : WebWalletProvider;
    return (
      <WalletBranchErrorBoundary
        key={attempt}
        onRetry={() => setAttempt((n) => n + 1)}
      >
        <Branch>{children}</Branch>
      </WalletBranchErrorBoundary>
    );
  }

  // `undecided` — a stable shell shared by SSR and the first client render.
  // No children and no wagmi hooks: mounting a provider here just to swap it
  // is the double-mount this whole design exists to avoid.
  return <div data-wallet-shell="undecided" />;
}
