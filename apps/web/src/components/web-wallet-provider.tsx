"use client";

import { PrivyProvider, useLogout } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, type ReactNode } from "react";
import { celo } from "wagmi/chains";

import { ProductContextProviders } from "@/components/product-context-providers";
import { WebAccessGate } from "@/components/web-access-gate";
import { createWebTransports } from "@/lib/wallet/web-transports";
import { WalletSessionProvider } from "@/lib/wallet/wallet-session";

/**
 * wagmi config for the web (Privy) branch — Celo mainnet only, no `injected`
 * connector. Privy owns the embedded wallet; chain reads go through the shared
 * fallback transport (see `web-transports.ts`, commit 6e11e6a). This runs in
 * parallel to the MiniPay `wagmiConfig` and imports nothing from it.
 */
export function createWebWagmiConfig() {
  return createConfig({
    chains: [celo],
    transports: createWebTransports(),
  });
}

// One stable instance — a fresh config per render would remount wagmi.
const webWagmiConfig = createWebWagmiConfig();

/**
 * Reads `NEXT_PUBLIC_PRIVY_APP_ID`, required only when the Privy branch mounts.
 * Importing the module never throws; mounting without an app id fails loud,
 * because the feature flag is meant to keep this tree off in production.
 * `PRIVY_APP_SECRET` is never read — the backend anchors entitlements to
 * on-chain tx keyed by EVM address, so it never verifies Privy sessions.
 */
export function requirePrivyAppId(): string {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error(
      "NEXT_PUBLIC_PRIVY_APP_ID is required to mount the Privy wallet branch.",
    );
  }
  return appId;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Teaches the shared `useWalletSignOut()` how this branch ends a session:
 * Privy's own `logout()`, not a wagmi disconnect. Privy owns the embedded
 * wallet and the session, so tearing down the connector alone would leave the
 * session (and, once HttpOnly cookies are on for `.chesscito.com`, the cookie
 * shared with the sibling subdomain) intact.
 *
 * The existing Account sheet `Disconnect` row is the only control that reaches
 * this — no second `Sign out` button exists, and MiniPay hides `Disconnect`
 * entirely (`account-sheet.tsx`, `walletIsInterchangeable`).
 */
export function PrivyWalletSession({ children }: { children: ReactNode }) {
  const { logout } = useLogout();
  const signOut = useCallback(() => {
    void logout();
  }, [logout]);

  return <WalletSessionProvider signOut={signOut}>{children}</WalletSessionProvider>;
}

/**
 * Privy + wagmi tree for web users outside MiniPay. `WebAccessGate` sits
 * between wagmi and `children` and renders them only once the user is
 * authenticated with a ready embedded wallet — web access is mandatory, there
 * is no guest mode (product decision, 2026-07-24).
 */
export function WebWalletProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={requirePrivyAppId()}
      config={{
        loginMethods: ["email", "google"],
        defaultChain: celo,
        supportedChains: [celo],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={webWagmiConfig}>
          <PrivyWalletSession>
            <WebAccessGate>
              {/* Inside the gate: the product contexts are wallet-scoped, so
                  they mount only in `authenticated + wallet ready`. */}
              <ProductContextProviders>{children}</ProductContextProviders>
            </WebAccessGate>
          </PrivyWalletSession>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
