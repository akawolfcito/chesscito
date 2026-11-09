import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { WalletProvider } from "@/components/wallet-provider";
import { SignProbeClient } from "./sign-probe-client";

// Internal dev surface to answer ONE question: does MiniPay support
// `personal_sign` (eth message signing) on a real device? The celopedia
// Stage-2 checklist still lists "no message signing", but the live MiniPay
// docs no longer state that constraint — this probe settles it empirically.
//
// Never shipped to production — 404s there. Lives outside `[locale]`, so it
// does NOT inherit the app's WalletProvider from the locale layout; we wrap
// it here so the wagmi / RainbowKit hooks have their providers.
export const dynamic = "force-dynamic";

export default function SignProbeDevPage() {
  if (!isDevSurfaceEnabled()) notFound();
  return (
    <WalletProvider>
      <SignProbeClient />
    </WalletProvider>
  );
}
