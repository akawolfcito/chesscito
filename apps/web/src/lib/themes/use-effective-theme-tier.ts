"use client";

import { useRef } from "react";
import { useAccount } from "wagmi";

import {
  useProEntitlement,
  type ProEntitlementState,
} from "@/lib/pro/use-is-pro-active";

import type { ThemeAssetVariant } from "./theme-registry";

export type ThemeTier = ThemeAssetVariant;

export type ThemeTierPresentation = {
  tier: ThemeTier;
  stale: boolean;
};

export function resolveThemeTierPresentation(
  entitlement: ProEntitlementState,
  lastSuccessfulTier: ThemeTier,
): ThemeTierPresentation {
  if (entitlement.status === "active") return { tier: "pro", stale: false };
  if (entitlement.status === "inactive") {
    return { tier: "default", stale: false };
  }
  return { tier: lastSuccessfulTier, stale: true };
}

/** Presentation-only bridge from PRO status to themed assets. Transport
 * failures retain the last successful tier, but this value is never exported
 * as entitlement authorization. */
export function useEffectiveThemePresentation(): ThemeTierPresentation {
  const { address } = useAccount();
  const entitlement = useProEntitlement();
  const wallet = address?.toLowerCase() ?? null;
  const lastSuccessful = useRef<{ wallet: string | null; tier: ThemeTier }>({
    wallet,
    tier: "default",
  });

  if (lastSuccessful.current.wallet !== wallet) {
    lastSuccessful.current = { wallet, tier: "default" };
  }

  const presentation = resolveThemeTierPresentation(
    entitlement,
    lastSuccessful.current.tier,
  );
  if (!presentation.stale) {
    lastSuccessful.current.tier = presentation.tier;
  }
  return presentation;
}

export function useEffectiveThemeTier(): ThemeTier {
  return useEffectiveThemePresentation().tier;
}
