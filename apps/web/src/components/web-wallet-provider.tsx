"use client";

import { PrivyProvider, useLogout } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, type ReactNode } from "react";
import { celo } from "wagmi/chains";

import { ChainConfigWarning } from "@/components/dev/chain-config-warning";
import { ProductContextProviders } from "@/components/product-context-providers";
import { WebAccessThemeVariables } from "@/components/themes/theme-css-variables";
import { WebAccessGate } from "@/components/web-access-gate";
import { useCurrentThemeAsset } from "@/lib/themes/use-current-theme-asset";
import { buildWebAccessAppearance } from "@/lib/wallet/web-access-appearance";
import { resolveWebAccessSurface } from "@/lib/wallet/web-access-copy";
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
 * Importing the module never throws; mounting without an app id fails loud —
 * and "loud" means the whole web app, since this throws during render. Any host
 * where `NEXT_PUBLIC_PRIVY_ENABLED` is on MUST carry the app id in the same
 * environment, and both are `NEXT_PUBLIC_*`, so a redeploy is what applies them.
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
  // `brand.title-login`, not `brand.title`: the modal's wordmark is its own
  // slot so it can be replaced without touching the hub's. No
  // ThemeVariantProvider is in scope this high in the tree, so it resolves to
  // the default variant — correct here, since the modal only ever faces a
  // visitor with no wallet and therefore no entitlement.
  const wordmarkBase = useCurrentThemeAsset("brand.title-login");

  return (
    /* `display: contents` so this node names the branch without existing for
       layout — every descendant keeps its parent's box. The attribute is
       load-bearing twice over (lib/wallet/wallet-branch.ts): tests assert one
       branch mounts, and the literal proves in which chunk this branch landed. */
    <div data-wallet-branch="privy" style={{ display: "contents" }}>
      <PrivyProvider
        appId={requirePrivyAppId()}
        config={{
          // Styling only. Privy renders its login modal in its own portal, so
          // globals.css cannot reach it and this prop is the only way in.
          appearance: buildWebAccessAppearance(resolveWebAccessSurface(), wordmarkBase),
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
              {/* Above the gate on purpose: the gate IS the screen that needs
                  these wallpapers, and the app-wide ThemeCssVariables mounts
                  behind it. */}
              <WebAccessThemeVariables />
              {/* Above the gate too: a misconfigured chain id degrades the UI
                  for a DISCONNECTED visitor, who never reaches the contexts
                  inside. `chains[0]` here is Celo mainnet only. */}
              <ChainConfigWarning defaultChainId={celo.id} />
              <WebAccessGate>
                {/* Inside the gate: the product contexts are wallet-scoped, so
                    they mount only in `authenticated + wallet ready`. */}
                <ProductContextProviders>{children}</ProductContextProviders>
              </WebAccessGate>
            </PrivyWalletSession>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </div>
  );
}
