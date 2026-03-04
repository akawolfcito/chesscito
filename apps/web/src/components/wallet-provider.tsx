"use client";

import { RainbowKitProvider, connectorsForWallets } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { WagmiProvider, createConfig, http, useConnect } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";

import { getInjectedProvider, isMiniPayEnv } from "@/lib/minipay";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "chesscito",
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  }
);

const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors,
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

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
        <RainbowKitProvider>
          <WalletProviderInner>{children}</WalletProviderInner>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
