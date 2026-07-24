"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { celo } from "wagmi/chains";

import { createWebTransports } from "@/lib/wallet/web-transports";

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
 * Privy + wagmi tree for logged-in web users outside MiniPay. A guest (no
 * login) still renders `children`: Privy gates nothing here — login is the
 * client boundary's job, the next block.
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
        <WagmiProvider config={webWagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
