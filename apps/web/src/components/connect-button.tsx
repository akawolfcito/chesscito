"use client";

import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

import { useMiniPay } from "@/hooks/use-minipay";
import { CONNECT_BUTTON_COPY } from "@/lib/content/editorial";

export function ConnectButton() {
  const { hasProvider, isMiniPay, isReady } = useMiniPay();

  if (!isReady) {
    return null;
  }

  if (isMiniPay) {
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {CONNECT_BUTTON_COPY.miniPayDetected}
      </span>
    );
  }

  if (!hasProvider) {
    return (
      <Link
        href="https://docs.celo.org/build/build-on-minipay/quickstart"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-full border border-amber-700/40 bg-amber-50/90 px-3 py-2 text-xs font-medium text-amber-900/85 transition-colors hover:border-amber-700/70 hover:bg-amber-100 hover:text-amber-900"
      >
        {CONNECT_BUTTON_COPY.openInMiniPay}
      </Link>
    );
  }

  return <RainbowKitConnectButton />;
}
