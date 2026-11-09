"use client";

import { useRef } from "react";
import { useAccount } from "wagmi";

import {
  useProEntitlement,
  type ProEntitlementState,
} from "@/lib/pro/use-is-pro-active";
import {
  useSeasonPassStatus,
  type SeasonPassStatus,
} from "@/lib/season-pass/use-season-pass-status";
import {
  CHESSCITO_MODE,
  type ChesscitoMode,
} from "@/lib/feature-flags";

import type { ThemeAssetVariant } from "./theme-registry";

export type ThemeTier = ThemeAssetVariant;

export type ThemeTierPresentation = {
  tier: ThemeTier;
  stale: boolean;
};

export type RuntimeThemeSurface = "learn" | "play" | "full-legacy";

export function runtimeThemeSurface(mode: ChesscitoMode): RuntimeThemeSurface {
  return mode === "full" ? "full-legacy" : mode;
}

type PresentationEntitlement = {
  status: "unknown" | "loading" | "active" | "inactive" | "error";
  active: boolean;
};

function resolvePresentationEntitlement(
  entitlement: PresentationEntitlement,
  lastSuccessfulTier: ThemeTier,
): ThemeTierPresentation {
  if (entitlement.status === "active" && entitlement.active) {
    return { tier: "pro", stale: false };
  }
  if (entitlement.status === "inactive") {
    return { tier: "default", stale: false };
  }
  return { tier: lastSuccessfulTier, stale: true };
}

/** `pro` is the registry's existing second visual slot. In LEARN it may be
 * selected by an effective Training Pass (direct Season Pass or real PRO),
 * without asserting commercial PRO or changing copy, badges, benefits or
 * authorization. PLAY and FULL retain their real-PRO-only behavior. */
export function resolveSurfaceThemeTierPresentation(
  surface: RuntimeThemeSurface,
  pro: ProEntitlementState,
  trainingPass: Pick<SeasonPassStatus, "state" | "active">,
  lastSuccessfulTier: ThemeTier,
): ThemeTierPresentation {
  if (surface === "learn" && pro.status === "active" && pro.active) {
    return { tier: "pro", stale: false };
  }
  return resolvePresentationEntitlement(
    surface === "learn"
      ? { status: trainingPass.state, active: trainingPass.active }
      : pro,
    lastSuccessfulTier,
  );
}

export function resolveThemeTierPresentation(
  entitlement: ProEntitlementState,
  lastSuccessfulTier: ThemeTier,
): ThemeTierPresentation {
  return resolvePresentationEntitlement(entitlement, lastSuccessfulTier);
}

/** Presentation-only bridge from PRO status to themed assets. Transport
 * failures retain the last successful tier, but this value is never exported
 * as entitlement authorization. */
export function useEffectiveThemePresentation(): ThemeTierPresentation {
  const { address } = useAccount();
  const entitlement = useProEntitlement();
  const trainingPass = useSeasonPassStatus(address);
  const surface = runtimeThemeSurface(CHESSCITO_MODE);
  const wallet = address?.toLowerCase() ?? null;
  const lastSuccessful = useRef<{ wallet: string | null; tier: ThemeTier }>({
    wallet,
    tier: "default",
  });

  if (lastSuccessful.current.wallet !== wallet) {
    lastSuccessful.current = { wallet, tier: "default" };
  }

  const presentation = resolveSurfaceThemeTierPresentation(
    surface,
    entitlement,
    trainingPass,
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
