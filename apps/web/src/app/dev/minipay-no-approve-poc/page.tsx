import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { WalletProvider } from "@/components/wallet-provider";
import { MiniPayNoApprovePocClient } from "./minipay-no-approve-poc-client";

export const dynamic = "force-dynamic";

export default function MiniPayNoApprovePocPage() {
  if (!isDevSurfaceEnabled()) notFound();

  return (
    <WalletProvider>
      <MiniPayNoApprovePocClient />
    </WalletProvider>
  );
}
