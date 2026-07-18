/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  Theme system — foundation registry                               ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  One source of truth for skinnable asset paths. Each theme is a   ║
 * ║  bundle of asset basenames keyed by stable, semantic slot ids.    ║
 * ║                                                                   ║
 * ║  Goals:                                                           ║
 * ║   • Decouple visual identity from component code — switching      ║
 * ║     themes is a registry update, not a refactor.                  ║
 * ║   • Future themes (Halloween, Christmas, PRO gold-leaf) drop in   ║
 * ║     as new entries here + asset files; no component touch.        ║
 * ║   • Monetization-ready — every theme key can become an itemId in  ║
 * ║     the Shop ledger (parallel to founder badge / PRO).            ║
 * ║                                                                   ║
 * ║  Adoption is incremental. Components keep their hardcoded paths   ║
 * ║  until the surface is marked "ready-to-theme" in the audit doc    ║
 * ║  (`docs/superpowers/specs/2026-05-26-theme-system-foundation.md`),║
 * ║  then swap to `useThemeAsset(key, variant?)`.                     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

/** Asset variant within a single theme. `default` is mandatory; `pro`
 *  is an opt-in second tier surfaced to PRO subscribers — themes that
 *  don't ship a `pro` variant gracefully fall back to `default`. */
export type ThemeAssetVariant = "default" | "pro";

export type ThemeAssetEntry = {
  /** Always present. Basename without extension — consumer composes
   *  the AVIF/WebP/PNG triplet at render time. */
  default: string;
  /** Optional PRO-tier override. When absent, useThemeAsset falls back
   *  to `default` for PRO viewers — preserves the no-broken-state
   *  contract while future themes catch up. */
  pro?: string;
  /** Human-readable list of surfaces/screens that render this slot.
   *  Powers the `/dev/theme-builder` art catalog so the founder can
   *  see, per slot, where the asset lands. Purely documentary — no
   *  runtime consumer reads it. Optional; defaults to empty. */
  usedIn?: string[];
};

/** Canonical slot ids. New slots get added here as surfaces migrate
 *  off hardcoded paths. The string union doubles as the API surface
 *  of `useThemeAsset` — typos become compile errors. */
export type ThemeAssetKey =
  | "hub.portal"
  | "hub.avatar"
  // board — batch #1 (catalog visibility; consumers still read these paths
  // directly, see docs/superpowers/plans/2026-07-18-theme-builder-board-slots-plan.md)
  | "board.frame"
  | "board.tile.light"
  | "board.tile.dark"
  | "board.piece.rook"
  | "board.piece.bishop"
  | "board.piece.knight"
  | "board.piece.pawn"
  | "board.piece.queen"
  | "board.piece.king";

export type ThemeDefinition = {
  /** Stable theme id — used as Shop itemId once monetized + as the
   *  localStorage key for the active-theme setting. */
  id: string;
  /** Display name (English canonical). ES mirror lives in editorial
   *  when/if the theme picker surfaces. */
  name: string;
  /** Slot → asset basename(s). Every theme MUST define every key in
   *  `ThemeAssetKey` so `useThemeAsset` never returns undefined. */
  assets: Record<ThemeAssetKey, ThemeAssetEntry>;
};

/** The single source of truth. New themes (halloween, pro-gold-leaf,
 *  christmas, …) drop in as additional records here. The default
 *  theme is `candy-forest` — the look we ship today. */
export const THEMES: Record<string, ThemeDefinition> = {
  "candy-forest": {
    id: "candy-forest",
    name: "Candy Forest",
    assets: {
      "hub.portal": {
        default: "/art/hub/portal-chesscito-normal",
        pro: "/art/hub/portal-chesscito-pro",
        usedIn: ["Hub — KingdomAnchor portal"],
      },
      "hub.avatar": {
        default: "/art/scene-rooted/avatar-chesscito",
        pro: "/art/hub/chesscito-avatar-new-light",
        usedIn: ["Hub — KingdomAnchor avatar", "Exercises — avatar"],
      },
      // The framed board illustration (decorative border + a–h/1–8 labels).
      // NOT the playable surface — that is procedural tiles (board.tile.*).
      // (Legacy `/art/chesscito-board` is dead for the game board — canvas is
      //  background:none — only the OG home card still uses it; left unregistered
      //  pending a "where is it still used" validation.)
      "board.frame": {
        default: "/art/redesign/board/board-ch",
        usedIn: ["Hub — KingdomAnchor board", "Board thumbnail", "Splash preload"],
      },
      "board.tile.light": {
        default: "/art/board/casilla-clara",
        usedIn: ["Board — light squares"],
      },
      "board.tile.dark": {
        default: "/art/board/casilla-oscura",
        usedIn: ["Board — dark squares"],
      },
      "board.piece.rook": {
        default: "/art/redesign/pieces/w-rook",
        usedIn: ["Board — rook"],
      },
      "board.piece.bishop": {
        default: "/art/redesign/pieces/w-bishop",
        usedIn: ["Board — bishop"],
      },
      "board.piece.knight": {
        default: "/art/redesign/pieces/w-knight",
        usedIn: ["Board — knight"],
      },
      "board.piece.pawn": {
        default: "/art/redesign/pieces/w-pawn",
        usedIn: ["Board — pawn"],
      },
      "board.piece.queen": {
        default: "/art/redesign/pieces/w-queen",
        usedIn: ["Board — queen"],
      },
      "board.piece.king": {
        default: "/art/redesign/pieces/w-king",
        usedIn: ["Board — king"],
      },
    },
  },
};

/** Theme served when no per-user setting is present + the only theme
 *  every wallet owns by default. */
export const DEFAULT_THEME_ID = "candy-forest";
