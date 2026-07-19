"use client";

import { createContext, useContext } from "react";

import { useIsProActive } from "@/lib/pro/use-is-pro-active";

import type { ThemeAssetVariant } from "./theme-registry";

const ThemeVariantContext = createContext<ThemeAssetVariant>("default");

export function ThemeVariantProvider({ children }: { children: React.ReactNode }) {
  const isProActive = useIsProActive();
  return (
    <ThemeVariantContext.Provider value={isProActive ? "pro" : "default"}>
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
