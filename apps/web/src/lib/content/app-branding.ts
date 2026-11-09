import type { ChesscitoMode } from "@/lib/feature-flags";

export function appRootTitle(mode: ChesscitoMode): string {
  return mode === "learn" ? "Chesscito Learn" : "Chesscito";
}
