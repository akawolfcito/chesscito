import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { WalletProvider } from "@/components/wallet-provider";
import { TxErrorProbeClient } from "./tx-error-probe-client";

// TEMPORARY — delete this directory and `lib/debug/serialize-tx-error.ts`
// once the question below is answered.
//
// Internal dev surface to answer ONE question with evidence: what does MiniPay
// preserve of an error on its way back to the dapp? Specifically, does a
// contract revert arrive with its 4-byte revert data intact?
//
// It matters because `apps/web/src` decodes no revert data today, and building
// a decoder + an ABI generator is 1-2h of work that is worthless if MiniPay
// hands us a plain string. See docs/reviews/2026-07-09-custom-errors-plan-redteam.md.
//
// This probe decodes nothing and changes no production code. It only reports.
//
// Never shipped to production — 404s there. Lives outside `[locale]`, so it
// does NOT inherit the app's WalletProvider from the locale layout.
export const dynamic = "force-dynamic";

export default function TxErrorProbeDevPage() {
  if (!isDevSurfaceEnabled()) notFound();
  return (
    <WalletProvider>
      <TxErrorProbeClient />
    </WalletProvider>
  );
}
