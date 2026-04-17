export type AssetTheme = "default" | "candy";

type ThemeConfig = {
  piecesBase: string;
  hasOptimizedFormats: boolean;
  /** CSS class applied to piece images for color tinting per piece color */
  pieceTintClass: { w: string; b: string };
};

const THEMES: Record<AssetTheme, ThemeConfig> = {
  default: {
    piecesBase: "/art/pieces",
    hasOptimizedFormats: true,
    pieceTintClass: { w: "arena-treat-white", b: "arena-treat-black" },
  },
  candy: {
    piecesBase: "/art/redesign/pieces",
    hasOptimizedFormats: false,
    pieceTintClass: { w: "arena-treat-natural", b: "arena-treat-natural" },
  },
};

const envTheme = process.env.NEXT_PUBLIC_ASSET_THEME;

export const ASSET_THEME: AssetTheme = envTheme === "default" ? "default" : "candy";
export const THEME_CONFIG = THEMES[ASSET_THEME];
