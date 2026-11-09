import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { WalletProvider } from "@/components/wallet-provider";
import { RailSmokeClient } from "./rail-smoke-client";

// Internal dev surface for the stablecoin single-tx payment rail smoke
// (slice G prep). Never shipped to production — 404s there — and the
// button itself is treasury-gated (fail-closed) inside the client.
//
// This route lives outside `[locale]`, so it does NOT inherit the app's
// WalletProvider from the locale layout — we wrap it here so the wagmi /
// RainbowKit hooks have their providers (fixes WagmiProviderNotFound).
export const dynamic = "force-dynamic";

export default function RailSmokeDevPage() {
  if (!isDevSurfaceEnabled()) notFound();
  return (
    <WalletProvider>
      <RailSmokeClient />
    </WalletProvider>
  );
}
