"use client";

import { useProEntitlement } from "@/lib/pro/use-is-pro-active";

import type { ThemeAssetVariant } from "./theme-registry";

export type ThemeTier = ThemeAssetVariant;

/** The single runtime bridge from the PRO entitlement to themed assets. */
export function useEffectiveThemeTier(): ThemeTier {
  const entitlement = useProEntitlement();
  return entitlement.active ? "pro" : "default";
}
