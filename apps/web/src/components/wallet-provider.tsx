"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { WagmiProvider, useConnect } from "wagmi";
import { celo } from "wagmi/chains";

import { ChainConfigWarning } from "@/components/dev/chain-config-warning";
import { ProductContextProviders } from "@/components/product-context-providers";
import { getInjectedProvider, isMiniPayEnv } from "@/lib/minipay";
import { wagmiConfig } from "@/lib/wallet/wagmi-config";

// ⛔ Do NOT re-export `wagmiConfig` from here. It moved to
// `lib/wallet/wagmi-config` so that code needing only the config object never
// pulls this branch into its graph; a re-export would keep the old import path
// alive and quietly undo the code split
// (spec 2026-08-07-wallet-branch-lazy-load).

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — avoid redundant RPC refetches on remount
      refetchOnWindowFocus: false, // MiniPay WebView triggers focus often
    },
  },
});

function WalletProviderInner({ children }: { children: React.ReactNode }) {
  const { connect, connectors } = useConnect();
  const attemptedMiniPayConnectRef = useRef(false);

  useEffect(() => {
    if (attemptedMiniPayConnectRef.current) {
      return;
    }

    if (!isMiniPayEnv() || getInjectedProvider() == null) {
      return;
    }

    const injectedConnector = connectors.find((connector) => connector.id === "injected");

    if (!injectedConnector) {
      return;
    }

    attemptedMiniPayConnectRef.current = true;
    connect({ connector: injectedConnector });
  }, [connect, connectors]);

  return <>{children}</>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    /* `display: contents` so this node names the branch without existing for
       layout — every descendant keeps its parent's box. The attribute is
       load-bearing twice over (lib/wallet/wallet-branch.ts): tests assert one
       branch mounts, and the literal proves in which chunk this branch landed. */
    <div data-wallet-branch="injected" style={{ display: "contents" }}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WalletProviderInner>
            {/* Outside the product contexts: the mismatch it reports is what a
                DISCONNECTED visitor hits, and wagmi answers them with
                `chains[0]` — Celo mainnet. */}
            <ChainConfigWarning defaultChainId={celo.id} />
            <ProductContextProviders>{children}</ProductContextProviders>
          </WalletProviderInner>
        </QueryClientProvider>
      </WagmiProvider>
    </div>
  );
}
