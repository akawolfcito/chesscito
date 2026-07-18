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
  // hub — the entry surface (buttons, icons, tour, guide)
  | "hub.enter-arena"
  | "hub.train-pieces"
  | "hub.play-chess"
  | "hub.training"
  | "hub.training-icon"
  | "hub.daily-icon"
  | "hub.shop-icon"
  | "hub.btn-battle"
  | "hub.btn-play"
  | "hub.principal-button"
  | "hub.tour-hero"
  | "hub.tour-title"
  | "hub.guide"
  | "hub.21-day-icon"
  | "hub.avatar-lite"
  // pro — PRO-only surfaces (default variant only)
  | "pro.avatar"
  | "pro.chip-active"
  | "pro.chip-inactive"
  // shared — cross-cutting assets used by 3+ surfaces (one slot, not per-screen)
  | "shared.avatar-small-account"
  | "shared.lock"
  | "shared.welcome-gift"
  // brand — identity assets (not game theme, but updatable)
  | "brand.title"
  | "brand.ring-start-focus"
  // board — batch #1 (catalog visibility; consumers still read these paths
  // directly, see docs/superpowers/plans/2026-07-18-theme-builder-board-slots-plan.md)
  | "board.frame"
  | "board.thumbnail"
  | "board.tile.light"
  | "board.tile.dark"
  | "board.piece.white.rook"
  | "board.piece.white.bishop"
  | "board.piece.white.knight"
  | "board.piece.white.pawn"
  | "board.piece.white.queen"
  | "board.piece.white.king"
  | "board.piece.black.rook"
  | "board.piece.black.bishop"
  | "board.piece.black.knight"
  | "board.piece.black.pawn"
  | "board.piece.black.queen"
  | "board.piece.black.king";

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
      "hub.enter-arena": {
        default: "/art/hub/enter-arena",
        usedIn: ["Hub — enter arena button"],
      },
      "hub.train-pieces": {
        default: "/art/hub/train-pieces",
        usedIn: ["Hub — train pieces button"],
      },
      "hub.play-chess": {
        default: "/art/new-icons-chesscito/play-chess",
        usedIn: ["Hub — play chess icon"],
      },
      "hub.training": {
        default: "/art/new-icons-chesscito/training",
        usedIn: ["Hub — training icon"],
      },
      "hub.training-icon": {
        default: "/art/new-icons-chesscito/training-icon-v1",
        usedIn: ["Hub — training icon (v1)"],
      },
      "hub.daily-icon": {
        default: "/art/new-icons-chesscito/daily-icon-v1",
        usedIn: ["Hub — daily icon"],
      },
      "hub.shop-icon": {
        default: "/art/redesign/icons/shop",
        usedIn: ["Hub — shop icon"],
      },
      "hub.btn-battle": {
        default: "/art/redesign/banners/btn-battle",
        usedIn: ["Hub — battle button banner"],
      },
      "hub.btn-play": {
        default: "/art/redesign/banners/btn-play",
        usedIn: ["Hub — play button banner"],
      },
      "hub.principal-button": {
        default: "/art/redesign/banners/principalbutton",
        usedIn: ["Hub — principal CTA button"],
      },
      "hub.tour-hero": {
        default: "/art/mini-tour/tour-challenge-hero",
        usedIn: ["Hub — mini-tour challenge hero"],
      },
      "hub.tour-title": {
        default: "/art/mini-tour/tour-challenge-title",
        usedIn: ["Hub — mini-tour challenge title"],
      },
      "hub.guide": {
        default: "/art/scene-rooted/guide-secuencia",
        usedIn: ["Hub — guide sequence"],
      },
      "hub.21-day-icon": {
        default: "/art/21-day-icon",
        usedIn: ["Hub — 21-day challenge icon"],
      },
      "hub.avatar-lite": {
        default: "/art/avatar-lite-hub",
        usedIn: ["Hub — lite avatar"],
      },
      "pro.avatar": {
        default: "/art/avatar-pro",
        usedIn: ["PRO — subscriber avatar"],
      },
      "pro.chip-active": {
        default: "/art/hub/pro-chip-active",
        usedIn: ["PRO — active chip"],
      },
      "pro.chip-inactive": {
        default: "/art/hub/pro-chip-inactive",
        usedIn: ["PRO — inactive chip"],
      },
      "shared.avatar-small-account": {
        default: "/art/avatar-small-account",
        usedIn: ["Hub", "Arena", "Exercises"],
      },
      "shared.lock": {
        default: "/art/redesign/icons/lock",
        usedIn: ["Locked tiles / gated surfaces"],
      },
      "shared.welcome-gift": {
        default: "/art/shop/welcome-gift",
        usedIn: ["Hub", "Exercises"],
      },
      "brand.title": {
        default: "/art/title-chesscito",
        usedIn: ["Brand — Chesscito wordmark"],
      },
      "brand.ring-start-focus": {
        default: "/art/ring-start-focus",
        usedIn: ["Hub — start-focus ring", "Root"],
      },
      // The playable board's frame — the decorative border around the live
      // GameBoard (1040×1028, measured inner opening in game-board.tsx). The
      // squares inside are procedural tiles (board.tile.*).
      "board.frame": {
        default: "/art/board/borde-tablero-chesscito1",
        usedIn: ["GameBoard — playable board frame"],
      },
      // The pre-composed framed-board illustration used ONLY for thumbnails /
      // previews (avoids laying out a position in small scenarios). NOT the
      // playable board. (Legacy `/art/chesscito-board` is dead — canvas is
      //  background:none; only the OG home card still uses it, left unregistered.)
      "board.thumbnail": {
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
      // White = player pieces (main board renders these; black is tinted there
      // via pieceTintClass, but black ALSO ships as real b-* assets used for
      // enemies in promotion-run / safe-path and the kingdom-anchor board).
      "board.piece.white.rook": {
        default: "/art/redesign/pieces/w-rook",
        usedIn: ["Board — white rook"],
      },
      "board.piece.white.bishop": {
        default: "/art/redesign/pieces/w-bishop",
        usedIn: ["Board — white bishop"],
      },
      "board.piece.white.knight": {
        default: "/art/redesign/pieces/w-knight",
        usedIn: ["Board — white knight"],
      },
      "board.piece.white.pawn": {
        default: "/art/redesign/pieces/w-pawn",
        usedIn: ["Board — white pawn"],
      },
      "board.piece.white.queen": {
        default: "/art/redesign/pieces/w-queen",
        usedIn: ["Board — white queen"],
      },
      "board.piece.white.king": {
        default: "/art/redesign/pieces/w-king",
        usedIn: ["Board — white king"],
      },
      "board.piece.black.rook": {
        default: "/art/redesign/pieces/b-rook",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board"],
      },
      "board.piece.black.bishop": {
        default: "/art/redesign/pieces/b-bishop",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board"],
      },
      "board.piece.black.knight": {
        default: "/art/redesign/pieces/b-knight",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board"],
      },
      "board.piece.black.pawn": {
        default: "/art/redesign/pieces/b-pawn",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board"],
      },
      "board.piece.black.queen": {
        default: "/art/redesign/pieces/b-queen",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board"],
      },
      "board.piece.black.king": {
        default: "/art/redesign/pieces/b-king",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board"],
      },
    },
  },
};

/** Theme served when no per-user setting is present + the only theme
 *  every wallet owns by default. */
export const DEFAULT_THEME_ID = "candy-forest";
