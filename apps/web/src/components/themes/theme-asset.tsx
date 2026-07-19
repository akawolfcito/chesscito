"use client";

import type { ReactNode } from "react";

import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { useCurrentThemeAsset } from "@/lib/themes/use-current-theme-asset";

export function ThemeAsset({
  slot,
  children,
}: {
  slot: ThemeAssetKey;
  children: (assetBase: string) => ReactNode;
}): ReactNode {
  const assetBase = useCurrentThemeAsset(slot);
  return assetBase ? children(assetBase) : null;
}
