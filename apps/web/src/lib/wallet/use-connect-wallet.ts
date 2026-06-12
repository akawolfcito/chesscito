"use client";

import { useCallback } from "react";
import { useConnect } from "wagmi";

export type UseConnectWalletResult = {
  /** Triggers the injected wallet's connect flow directly. MiniPay
   *  auto-connects before any CTA renders (WalletProviderInner), so in
   *  practice this fires only on desktop/extension browsers. Silent
   *  no-op when no injected provider exists. */
  connectWallet: () => void;
  isConnecting: boolean;
};

/**
 * RainbowKit-free replacement for `useConnectModal`. The modal it
 * replaces only ever listed a single "Browser wallet" entry, so the
 * intermediary UI added no choice — just ~64KB gz of first-load JS on
 * every route. Stable identity per the hook-ref-stability rule.
 */
export function useConnectWallet(): UseConnectWalletResult {
  const { connect, connectors, isPending } = useConnect();

  const connectWallet = useCallback(() => {
    const injectedConnector = connectors.find((connector) => connector.id === "injected");

    if (!injectedConnector) {
      return;
    }

    connect({ connector: injectedConnector });
  }, [connect, connectors]);

  return { connectWallet, isConnecting: isPending };
}
