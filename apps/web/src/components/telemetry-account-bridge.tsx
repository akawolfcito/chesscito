"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";

import { setTelemetryAccount } from "@/lib/analytics/account";

/**
 * Publishes the connected address to the telemetry module so `track()` can
 * attach it without every call site knowing about wallets.
 *
 * Renders nothing. It lives in `ProductContextProviders` because that is the
 * one wrapper BOTH wallet branches mount, so MiniPay and Privy differ only in
 * where the address comes from — the same rule the rest of that file follows.
 *
 * Events fired before this mounts (the whole access gate, which sits OUTSIDE
 * it on the Privy branch) carry no account. That is correct, not a gap: at
 * gate time there is no account yet, which is precisely what the access funnel
 * measures.
 */
export function TelemetryAccountBridge() {
  const { address } = useAccount();

  useEffect(() => {
    setTelemetryAccount(address ?? null);
    // Clear on unmount so a signed-out tab cannot keep stamping events with
    // the previous address.
    return () => setTelemetryAccount(null);
  }, [address]);

  return null;
}
