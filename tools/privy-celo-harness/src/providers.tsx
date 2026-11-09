import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http } from "wagmi";

import { MAINNET_CHAIN, SEND_CHAIN } from "./chains";

// @privy-io/wagmi createConfig is a drop-in for wagmi's createConfig. Same
// chains/transports the productive Chesscito app uses, wired independently.
const wagmiConfig = createConfig({
  chains: [SEND_CHAIN, MAINNET_CHAIN],
  transports: {
    [SEND_CHAIN.id]: http(),
    [MAINNET_CHAIN.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ appId, children }: { appId: string; children: ReactNode }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google", "email"],
        // Testnet is the default so a fresh login lands ready to send safely.
        defaultChain: SEND_CHAIN,
        supportedChains: [SEND_CHAIN, MAINNET_CHAIN],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
