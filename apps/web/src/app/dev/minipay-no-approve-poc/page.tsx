import { notFound } from "next/navigation";

import { WalletProvider } from "@/components/wallet-provider";
import { MiniPayNoApprovePocClient } from "./minipay-no-approve-poc-client";

export const dynamic = "force-dynamic";

export default function MiniPayNoApprovePocPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <WalletProvider>
      <MiniPayNoApprovePocClient />
    </WalletProvider>
  );
}
