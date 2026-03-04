"use client";

import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

import { useMiniPay } from "@/hooks/use-minipay";

export function ConnectButton() {
  const { hasProvider, isMiniPay, isReady } = useMiniPay();

  if (!isReady) {
    return null;
  }

  if (isMiniPay) {
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        MiniPay detected
      </span>
    );
  }

  if (!hasProvider) {
    return (
      <Link
        href="https://docs.celo.org/build/build-on-minipay/quickstart"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-primary/30 hover:text-primary"
      >
        Open in MiniPay
      </Link>
    );
  }

  return <RainbowKitConnectButton />;
}
