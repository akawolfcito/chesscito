import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { MiniPayRawSendClient } from "./raw-send-client";

// TEMPORARY — delete this directory once the question below is answered.
//
// Answers ONE question with evidence: when MiniPay denies our transaction with
// "Permission denied" (code -1), is it refusing the APP, or refusing the
// request wagmi/viem builds?
//
// Everything else has been ruled out with evidence during the 2026-07-21
// investigation: the code is unchanged on the transaction path, the same build
// mints successfully from a web wallet, the testnet toggle is off, the chain
// matches, feeCurrency made no difference, and both preview and production
// domains fail identically. See
// docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md
//
// So this probe removes the last layer we have not isolated: it calls the
// injected provider directly, with no gas fields of its own, so nothing viem
// adds can be blamed. Results render ON SCREEN — MiniPay gives no console.
//
// Deliberately NOT wrapped in WalletProvider: using wagmi here would defeat
// the entire purpose. Never shipped to production — 404s there.
export const dynamic = "force-dynamic";

export default function MiniPayRawSendDevPage() {
  if (!isDevSurfaceEnabled()) notFound();
  return <MiniPayRawSendClient />;
}
