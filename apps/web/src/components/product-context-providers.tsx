"use client";

import type { ReactNode } from "react";

import { ProOriginWarning } from "@/components/dev/pro-origin-warning";
import { EffectiveTrainingPassProvider } from "@/lib/season-pass/use-season-pass-status";
import { ThemeVariantProvider } from "@/lib/themes/theme-variant-provider";

/**
 * The product contexts every Chesscito surface expects, independent of where
 * the wallet came from. Extracted verbatim from the injected tree
 * (`wallet-provider.tsx`) so both branches mount one identical instance:
 * MiniPay and Privy must differ only in the source of the address, never in the
 * contexts the product runs on.
 *
 * Order is load bearing. `EffectiveTrainingPassProvider` resolves the wallet's
 * effective pass; `ThemeVariantProvider` derives the visual tier from it, so it
 * has to sit inside.
 *
 * Both providers read `useAccount().address`, which makes them wallet-scoped.
 * On the injected branch that address arrives whenever the connector settles.
 * On the Privy branch this wrapper is mounted INSIDE `WebAccessGate`, so it
 * only ever runs in the `authenticated + wallet ready` state — an unauthenticated
 * web visitor mounts no product context at all.
 *
 * Nothing here changes provider behavior; it is a move, not a rewrite.
 */
export function ProductContextProviders({ children }: { children: ReactNode }) {
  return (
    <EffectiveTrainingPassProvider>
      <ThemeVariantProvider>
        <ProOriginWarning />
        {children}
      </ThemeVariantProvider>
    </EffectiveTrainingPassProvider>
  );
}
