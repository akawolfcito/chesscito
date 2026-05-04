"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { WagmiProvider, createConfig, http, useConnect } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";

import { getInjectedProvider, isMiniPayEnv } from "@/lib/minipay";

const RainbowKitProvider = dynamic(
  () => import("@rainbow-me/rainbowkit").then((mod) => mod.RainbowKitProvider),
  { ssr: false },
);

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "chesscito",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
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

function RainbowKitGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <RainbowKitProvider>{children}</RainbowKitProvider>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitGate>
          <WalletProviderInner>{children}</WalletProviderInner>
        </RainbowKitGate>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
