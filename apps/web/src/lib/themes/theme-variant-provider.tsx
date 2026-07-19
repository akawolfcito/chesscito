"use client";

import { createContext, useContext } from "react";

import type { ThemeAssetVariant } from "./theme-registry";
import { useEffectiveThemeTier } from "./use-effective-theme-tier";

const ThemeVariantContext = createContext<ThemeAssetVariant>("default");

export function ThemeVariantProvider({ children }: { children: React.ReactNode }) {
  const tier = useEffectiveThemeTier();
  return (
    <ThemeVariantContext.Provider value={tier}>
      {children}
    </ThemeVariantContext.Provider>
  );
}

export function ThemeVariantOverride({
  variant,
  children,
}: {
  variant: ThemeAssetVariant;
  children: React.ReactNode;
}) {
  return (
    <ThemeVariantContext.Provider value={variant}>
      {children}
    </ThemeVariantContext.Provider>
  );
}

export function useThemeVariant(): ThemeAssetVariant {
  return useContext(ThemeVariantContext);
}
