"use client";

import { SeasonPassSheet, type SeasonPassSheetProps } from "@/components/payments/season-pass-sheet";

/**
 * LearnShopSheet — Learn mode's dock "shop" destination. Thin wrapper so
 * Learn's dock imports this, never the Full/Play `ShopSheet`. All Season
 * Pass logic lives in `SeasonPassSheet`, which already self-gates to
 * Learn mode only.
 */
export function LearnShopSheet(props: SeasonPassSheetProps) {
  return <SeasonPassSheet {...props} />;
}
