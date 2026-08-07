"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { WagmiProvider, createConfig, http, useConnect } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

import { ChainConfigWarning } from "@/components/dev/chain-config-warning";
import { ProductContextProviders } from "@/components/product-context-providers";
import { getInjectedProvider, isMiniPayEnv } from "@/lib/minipay";

/** Plain wagmi `injected()` connector (id: "injected") — the only wallet
 *  this app ever offered. RainbowKit was removed in the P2 JS cluster
 *  (2026-06-12): its modal listed a single "Browser wallet" entry while
 *  its package put ~64KB gz into every route's first load. Connect CTAs
 *  now use `useConnectWallet()` (src/lib/wallet/use-connect-wallet.ts). */
export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected()],
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  },
  ssr: true,
});

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
  );
}
