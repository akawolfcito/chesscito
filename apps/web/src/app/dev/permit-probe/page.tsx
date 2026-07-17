import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { WalletProvider } from "@/components/wallet-provider";
import { PermitProbeClient } from "./permit-probe-client";

// Internal dev surface to answer ONE question: can MiniPay's wallet produce
// an `eth_signTypedData_v4` signature (EIP-712 typed data), not just
// `personal_sign`? [[minipay-supports-personal-sign]] settled personal_sign
// (2026-06-12); typed-data signing is a different RPC method and has never
// been tested here. This gates whether an EIP-2612 permit-based mint
// (Victory NFT, no separate approve tx) is viable for MiniPay users — see
// docs/product/chesscito-treasury-unification-plan-2026-07-01.md.
//
// Never shipped to production — 404s there. Lives outside `[locale]`, so it
// does NOT inherit the app's WalletProvider from the locale layout; we wrap
// it here so the wagmi / RainbowKit hooks have their providers.
export const dynamic = "force-dynamic";

export default function PermitProbeDevPage() {
  if (!isDevSurfaceEnabled()) notFound();
  return (
    <WalletProvider>
      <PermitProbeClient />
    </WalletProvider>
  );
}
