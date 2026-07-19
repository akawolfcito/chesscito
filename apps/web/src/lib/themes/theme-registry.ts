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

import type {
  DefaultThemeAssetValue,
  ProThemeAssetValue,
} from "./asset-variant";

/** Asset variant within a single theme. */
export type ThemeAssetVariant = "default" | "pro";

export type ThemeAssetEntry = {
  /** Legacy string basenames remain valid. An explicit object can select an
   *  asset or disable the DEFAULT image. Absence is backward-compatible none. */
  default?: DefaultThemeAssetValue;
  /** PRO-tier override. Absence is backward-compatible inherit; explicit
   *  states can select an asset, inherit DEFAULT, or render no image. */
  pro?: ProThemeAssetValue;
  /** Human-readable list of surfaces/screens that render this slot.
   *  Powers the `/dev/theme-builder` art catalog so the founder can
   *  see, per slot, where the asset lands. Purely documentary — no
   *  runtime consumer reads it. Optional; defaults to empty. */
  usedIn?: string[];
  /** When set, marks the slot as DEPRECATED in the catalog with this
   *  reason — an asset/reference that theoretically shouldn't be used
   *  anymore (e.g. a stale path a component still points at). Kept in
   *  the catalog on purpose: visible to distinguish + still updatable.
   *  Purely documentary. */
  deprecated?: string;
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
  // hub.pro-chip: the PRO status badge — default = inactive (upsell), pro = active
  | "hub.pro-chip"
  // hub.mastery.* — DEPRECATED: mastery-tile still points at the old /art/pieces set
  | "hub.mastery.piece.rook"
  | "hub.mastery.piece.bishop"
  | "hub.mastery.piece.knight"
  | "hub.mastery.piece.pawn"
  | "hub.mastery.piece.queen"
  | "hub.mastery.piece.king"
  // shared — cross-cutting assets used by 3+ surfaces (one slot, not per-screen)
  | "shared.avatar-small-account"
  | "shared.lock"
  | "shared.welcome-gift"
  | "shared.feedback-happy"
  | "shared.feedback-confident"
  | "shared.feedback-scared"
  | "shared.feedback-surprised"
  | "shared.panel-bg"
  | "shared.shield"
  | "shared.star"
  | "shared.mission-adorno"
  | "shared.mission-avatar"
  | "shared.close"
  | "shared.mission-panel"
  | "shared.trophy-epic"
  | "shared.feedback-sad"
  | "shared.feedback-thinking"
  | "shared.feedback-questioning"
  | "payments.celebration-bg"
  // brand — identity assets (not game theme, but updatable)
  | "brand.title"
  | "brand.ring-start-focus"
  // exercises — the PLAY / learn-exercises surface
  | "exercises.avatar-fun"
  | "exercises.avatar-try-again"
  | "exercises.badge"
  | "exercises.badge-menu"
  | "exercises.refuge"
  | "exercises.leaderboard-menu"
  | "exercises.leaderboard-crown"
  | "exercises.plant"
  | "exercises.btn-nodo"
  | "exercises.labyrinth-icon"
  | "exercises.combo"
  | "exercises.score"
  | "exercises.shop-menu"
  | "exercises.saved-seal"
  // arena — the PLAY / arena surface (incl. rival avatars + frames)
  | "arena.save"
  | "arena.resign"
  | "arena.undo"
  | "arena.rival-kairo"
  | "arena.rival-pipo"
  | "arena.rival-frame-blue"
  | "arena.rival-frame-gold"
  | "arena.rival-frame-silver"
  // PRO-only overlays: no default (free users see nothing), pro = gold frame
  | "arena.avatar-frame-you"
  | "arena.avatar-frame-bot"
  // coach
  | "coach.ask-icon"
  | "coach.play-again"
  // account
  | "account.language-icon"
  | "account.network-icon"
  | "account.wallet-icon"
  | "account.founder"
  | "account.shield"
  // pro-sheet — the PRO subscription/upsell surface (content shown to everyone
  // who opens it; NOT the PRO variant layer)
  | "pro-sheet.header-icon"
  | "pro-sheet.subscription-panel"
  | "pro-sheet.journal"
  // long tail — small surfaces (1–2 assets each)
  | "daily.bg-session"
  | "daily.welldone"
  | "peones.hint"
  | "peones.piece"
  | "welcome.achievement-1day"
  | "landing.pre-chess"
  | "tactics.daily-exercise"
  | "hud.crown"
  | "hud.trophy"
  | "pro-mission.sms"
  // closing pass — surfaces not covered by the per-surface sweep
  | "scene.gem-pill"
  | "scene.panel-pro"
  | "scene.pedestal"
  | "scene.stone-1"
  | "scene.stone-2"
  | "scene.stone-3"
  | "scene.stone-4"
  | "scene.stone-5"
  | "scene.stone-6"
  | "scene.stone-7"
  | "scene.stone-8"
  | "scene.stone-9"
  | "scene.stone-10"
  | "scene.chest-large"
  | "scene.chest-small"
  | "scene.banner-large"
  | "scene.banner-medium"
  | "scene.banner-short"
  | "bg.splash-chesscito"
  | "bg.wallpaper-lite"
  | "bg.dock-4slots"
  | "bg.menu-wall"
  | "bg.path-map"
  | "bg.path-map-base"
  | "bg.splash-loading"
  | "shop.coach-pack-20"
  | "shop.slot-frame"
  | "arena.bg-matchup"
  | "arena.result-checkmate"
  | "arena.result-draw"
  | "arena.result-resign"
  | "arena.result-stalemate"
  | "arena.player-you"
  | "arena.player-bot"
  | "hub.cta-principal"
  | "hub.mate-icon"
  | "hub.invite-icon"
  | "hub.bg"
  | "hub.btn-stone-bg"
  | "hub.focus-passport-streak"
  | "exercises.wall"
  | "exercises.laberinto"
  | "exercises.badge-claim"
  | "exercises.claim"
  | "exercises.save-score"
  | "exercises.wallpaper"
  | "welcome.achievement-3day"
  | "welcome.achievement-7day"
  | "welcome.focus-stamp"
  | "landing.hero"
  | "landing.progress-trophies"
  | "coach.play"
  | "account.account-icon"
  | "shared.panel-frame"
  | "shared.time"
  | "brand.favicon"
  // board — batch #1 (catalog visibility; consumers still read these paths
  // directly, see docs/superpowers/plans/2026-07-18-theme-builder-board-slots-plan.md)
  | "board.frame"
  | "board.thumbnail"
  | "board.legacy-bg"
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
        usedIn: ["Hub — KingdomAnchor portal", "↳ app/[locale]/page.tsx"],
      },
      "hub.avatar": {
        default: "/art/scene-rooted/avatar-chesscito",
        pro: "/art/hub/chesscito-avatar-new-light",
        usedIn: ["Hub — KingdomAnchor avatar", "Exercises — avatar", "↳ components/exercises/badge-sheet.tsx"],
      },
      "hub.enter-arena": {
        default: "/art/hub/enter-arena",
        usedIn: ["Hub — enter arena button", "↳ components/exercises/persistent-dock.tsx", "↳ components/hub/hub-scaffold.tsx", "↳ components/hub/play-hub-scaffold.tsx"],
      },
      "hub.train-pieces": {
        default: "/art/hub/train-pieces",
        usedIn: ["Hub — train pieces button", "↳ components/exercises/persistent-dock.tsx", "↳ components/hub/app-mode-switch.tsx", "↳ components/hub/hub-lite-scaffold.tsx", "↳ components/hub/hub-scaffold.tsx"],
      },
      "hub.play-chess": {
        default: "/art/new-icons-chesscito/play-chess",
        usedIn: ["Hub — play chess icon", "↳ components/hub/hub-scaffold.tsx", "↳ components/ui/tile-icon-slot.tsx"],
      },
      "hub.training": {
        default: "/art/new-icons-chesscito/training",
        usedIn: ["Hub — training icon", "↳ components/account/account-sheet.tsx", "↳ components/hub/hub-arena-tile.tsx", "↳ components/hub/hub-scaffold.tsx", "↳ components/hub/play-hub-scaffold.tsx", "↳ +4 more"],
      },
      "hub.training-icon": {
        default: "/art/new-icons-chesscito/training-icon-v1",
        usedIn: ["Hub — training icon (v1)", "↳ components/hub/hub-arena-tile.tsx", "↳ components/progression/unlock-overlay.tsx"],
      },
      "hub.daily-icon": {
        default: "/art/new-icons-chesscito/daily-icon-v1",
        usedIn: ["Hub — daily icon", "↳ components/hub/hub-daily-tile.tsx", "↳ app/[locale]/page.tsx"],
      },
      "hub.shop-icon": {
        default: "/art/redesign/icons/shop",
        usedIn: ["Hub — shop icon", "↳ components/hub/play-hub-scaffold.tsx"],
      },
      "hub.btn-battle": {
        default: "/art/redesign/banners/btn-battle",
        usedIn: ["Hub — battle button banner", "↳ components/hub/app-mode-switch.tsx", "↳ components/kingdom/kingdom-card.tsx", "↳ components/kingdom/primary-play-cta.tsx"],
      },
      "hub.btn-play": {
        default: "/art/redesign/banners/btn-play",
        usedIn: ["Hub — play button banner", "↳ components/kingdom/primary-play-cta.tsx"],
      },
      "hub.principal-button": {
        default: "/art/redesign/banners/principalbutton",
        usedIn: ["Hub — principal CTA button", "↳ components/scene-rooted/principal-button.tsx"],
      },
      "hub.tour-hero": {
        default: "/art/mini-tour/tour-challenge-hero",
        usedIn: ["Hub — mini-tour challenge hero", "↳ components/hub/hub-tour.tsx"],
      },
      "hub.tour-title": {
        default: "/art/mini-tour/tour-challenge-title",
        usedIn: ["Hub — mini-tour challenge title", "↳ components/hub/hub-tour.tsx"],
      },
      "hub.guide": {
        default: "/art/scene-rooted/guide-secuencia",
        usedIn: ["Hub — guide sequence", "↳ components/hub/hub-scaffold.tsx"],
      },
      "hub.21-day-icon": {
        default: "/art/21-day-icon",
        usedIn: ["Hub — 21-day challenge icon", "↳ components/hub/challenge-card.tsx"],
      },
      // default = free lite avatar; pro = the PRO-skinned avatar. hub-lite-scaffold
      // swaps by isPro — this is a variant pair, not two separate slots.
      "hub.avatar-lite": {
        default: "/art/avatar-lite-hub",
        pro: "/art/avatar-pro",
        usedIn: ["Hub — lite avatar (isPro swaps to PRO skin)", "↳ components/hub/hub-lite-scaffold.tsx", "↳ components/hub/play-hub-scaffold.tsx"],
      },
      // The PRO status badge. hub-pro-badge swaps by `active`: the purple
      // upsell chip for free users (default) → the all-gold chip for PRO (pro).
      "hub.pro-chip": {
        default: "/art/hub/pro-chip-inactive",
        pro: "/art/hub/pro-chip-active",
        usedIn: ["Hub — PRO status badge", "↳ components/hub/hub-pro-badge.tsx"],
      },
      // DEPRECATED: mastery-tile.tsx still renders the old /art/pieces set; it
      // should point at /art/redesign/pieces (see the tech-debt audit). Kept in
      // the catalog so it's visible + updatable until the reference is migrated.
      "hub.mastery.piece.rook": {
        default: "/art/pieces/w-rook",
        usedIn: ["Hub — mastery tile (rook)", "↳ components/hub/mastery-tile.tsx"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.bishop": {
        default: "/art/pieces/w-bishop",
        usedIn: ["Hub — mastery tile (bishop)", "↳ components/hub/mastery-tile.tsx"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.knight": {
        default: "/art/pieces/w-knight",
        usedIn: ["Hub — mastery tile (knight)", "↳ components/hub/mastery-tile.tsx"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.pawn": {
        default: "/art/pieces/w-pawn",
        usedIn: ["Hub — mastery tile (pawn)", "↳ components/hub/mastery-tile.tsx"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.queen": {
        default: "/art/pieces/w-queen",
        usedIn: ["Hub — mastery tile (queen)", "↳ components/hub/mastery-tile.tsx"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.king": {
        default: "/art/pieces/w-king",
        usedIn: ["Hub — mastery tile (king)", "↳ components/hub/mastery-tile.tsx"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "shared.avatar-small-account": {
        default: "/art/avatar-small-account",
        usedIn: ["Hub", "Arena", "Exercises", "↳ components/arena/arena-select-scaffold.tsx", "↳ components/exercises/exercises-screen.tsx", "↳ components/hub/hub-lite-scaffold.tsx"],
      },
      "shared.lock": {
        default: "/art/redesign/icons/lock",
        usedIn: ["Locked tiles / gated surfaces", "↳ components/about/about-methodology.tsx", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/arena-hud.tsx", "↳ components/arena/coach-preview-card.tsx", "↳ +161 more"],
      },
      "shared.welcome-gift": {
        default: "/art/shop/welcome-gift",
        usedIn: ["Hub", "Exercises", "↳ components/exercises/welcome-pack-tile.tsx", "↳ components/hub/hub-daily-trigger.tsx"],
      },
      // feedback — reaction avatars (folded into shared per founder); each used
      // across exercises result + arena victory states.
      "shared.feedback-happy": {
        default: "/art/new-assets-chesscito/fun/avatar-feliz",
        usedIn: ["Exercises result", "Arena victory / claim-success", "↳ components/arena/victory-celebration.tsx", "↳ components/arena/victory-claim-success.tsx", "↳ components/exercises/labyrinth-complete-overlay.tsx", "↳ components/exercises/result-overlay.tsx", "↳ +1 more"],
      },
      "shared.feedback-confident": {
        default: "/art/new-assets-chesscito/fun/avatar-confiado",
        usedIn: ["Arena — claiming", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/victory-claiming.tsx", "↳ components/victory/victory-landing-card.tsx"],
      },
      "shared.feedback-scared": {
        default: "/art/new-assets-chesscito/fun/avatar-asustado",
        usedIn: ["Arena — claim error", "↳ components/arena/victory-claim-error.tsx"],
      },
      "shared.feedback-surprised": {
        default: "/art/new-assets-chesscito/fun/avatar-asombrado",
        usedIn: ["Exercises / payments", "↳ components/arena/arena-end-state.tsx", "↳ components/exercises/result-overlay.tsx", "↳ components/payments/get-peones-sheet.tsx"],
      },
      "shared.panel-bg": {
        default: "/art/new-assets-chesscito/paneles/panel-bg1",
        usedIn: ["Payments", "Victory", "Arena", "Exercises", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/promotion-overlay.tsx", "↳ components/arena/victory-popup-shell.tsx", "↳ components/exercises/fail-rescue-modal.tsx", "↳ +1 more"],
      },
      "shared.shield": {
        default: "/art/redesign/icons/shield",
        usedIn: ["Arena", "Exercises", "↳ components/arena/arena-hud.tsx", "↳ components/exercises/exercise-drawer.tsx", "↳ components/exercises/fail-rescue-modal.tsx"],
      },
      "shared.star": {
        default: "/art/redesign/icons/star",
        usedIn: ["Board target marker", "Exercises", "Daily", "↳ components/board.tsx", "↳ components/daily/daily-tactic-sheet.tsx", "↳ components/exercises/fail-rescue-modal.tsx", "↳ components/exercises/mission-panel-candy.tsx"],
      },
      "shared.mission-adorno": {
        default: "/art/screen-mission/adorno-icon",
        usedIn: ["Arena", "Exercises", "↳ components/arena/promotion-overlay.tsx", "↳ components/arena/soft-gate-sheet.tsx", "↳ components/exercises/mission-detail-sheet.tsx", "↳ components/exercises/purchase-confirm-sheet.tsx", "↳ +2 more"],
      },
      "shared.mission-avatar": {
        default: "/art/screen-mission/avatar-icon",
        usedIn: ["Arena", "Exercises", "↳ components/arena/soft-gate-sheet.tsx", "↳ components/exercises/mission-briefing.tsx", "↳ components/exercises/mission-detail-sheet.tsx"],
      },
      "shared.close": {
        default: "/art/screen-mission/close-icon",
        usedIn: ["Arena", "Exercises", "Daily", "Peones", "UI", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/promotion-overlay.tsx", "↳ components/arena/soft-gate-sheet.tsx", "↳ components/arena/victory-popup-shell.tsx", "↳ +8 more"],
      },
      "shared.mission-panel": {
        default: "/art/screen-mission/panel-mision-icon",
        usedIn: ["Arena", "Exercises", "↳ components/arena/soft-gate-sheet.tsx", "↳ components/exercises/mission-briefing.tsx", "↳ components/exercises/mission-detail-sheet.tsx", "↳ components/exercises/purchase-confirm-sheet.tsx"],
      },
      "shared.trophy-epic": {
        default: "/art/action-row/trofeo-epico",
        usedIn: ["Coach", "Trophies", "↳ components/coach/game-actions-bar.tsx", "↳ components/exercises/persistent-dock.tsx", "↳ components/exercises/trophies-sheet.tsx", "↳ components/trophies/achievement-detail-sheet.tsx", "↳ +2 more"],
      },
      // more reaction avatars — surfaced by overlays/modals (mood-driven).
      "shared.feedback-sad": {
        default: "/art/new-assets-chesscito/fun/avatar-triste",
        usedIn: ["Overlays / modals — sad reaction", "↳ components/arena/arena-end-state.tsx"],
      },
      "shared.feedback-thinking": {
        default: "/art/new-assets-chesscito/fun/avatar-pensativo",
        usedIn: ["Overlays / modals — thinking reaction"],
      },
      "shared.feedback-questioning": {
        default: "/art/new-assets-chesscito/fun/avatar-interrogativo",
        usedIn: ["Overlays / modals — questioning reaction", "↳ components/arena/arena-end-state.tsx"],
      },
      "payments.celebration-bg": {
        default: "/art/celebration/bg-celebration",
        usedIn: ["Payments — celebration background", "↳ components/payments/season-pass-celebration.tsx"],
      },
      "brand.title": {
        default: "/art/title-chesscito",
        usedIn: ["Brand — Chesscito wordmark", "↳ components/hub/hub-lite-scaffold.tsx", "↳ components/hub/play-hub-scaffold.tsx"],
      },
      "brand.ring-start-focus": {
        default: "/art/ring-start-focus",
        usedIn: ["Hub — start-focus ring", "Root", "↳ components/hub/hub-lite-scaffold.tsx", "↳ app/[locale]/page.tsx"],
      },
      "exercises.avatar-fun": {
        default: "/art/avatar-fun",
        usedIn: ["Exercises — success avatar (mission panel)", "↳ components/daily/daily-tactic-sheet.tsx"],
      },
      "exercises.avatar-try-again": {
        default: "/art/avatar-try-again",
        usedIn: ["Exercises — try-again avatar", "↳ components/exercises/fail-rescue-modal.tsx"],
      },
      "exercises.badge": {
        default: "/art/badge-chesscito",
        usedIn: ["Exercises — badge", "↳ components/exercises/result-overlay.tsx"],
      },
      "exercises.badge-menu": {
        default: "/art/badge-menu",
        usedIn: ["Exercises — badge menu icon", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/persistent-dock.tsx", "↳ components/play/play-badges-sheet.tsx"],
      },
      "exercises.refuge": {
        default: "/art/labyrinths/refuge",
        usedIn: ["Exercises — safe-path refuge", "↳ components/exercises/safe-path-board.tsx"],
      },
      "exercises.leaderboard-menu": {
        default: "/art/leaderboard-menu",
        usedIn: ["Exercises — leaderboard menu icon", "↳ components/exercises/leaderboard-sheet.tsx", "↳ components/exercises/persistent-dock.tsx", "↳ components/play/play-leaders-sheet.tsx"],
      },
      "exercises.leaderboard-crown": {
        default: "/art/screen-mission/corona-pro",
        usedIn: ["Exercises — leaderboard decorative crown", "↳ components/account/account-sheet.tsx", "↳ components/exercises/leaderboard-sheet.tsx"],
      },
      "exercises.plant": {
        default: "/art/new-assets-chesscito/plant1",
        usedIn: ["Exercises — decorative plant", "↳ components/exercises/purchase-confirm-sheet.tsx"],
      },
      "exercises.btn-nodo": {
        default: "/art/redesign/bg/btn-nodo",
        usedIn: ["Exercises — node button", "↳ components/exercises/exercise-drawer.tsx"],
      },
      "exercises.labyrinth-icon": {
        default: "/art/redesign/bg/labyrint-icon",
        usedIn: ["Exercises — labyrinth icon", "↳ components/exercises/exercise-drawer.tsx"],
      },
      "exercises.combo": {
        default: "/art/redesign/icons/combo",
        usedIn: ["Exercises — combo icon", "↳ components/exercises/exercise-drawer.tsx"],
      },
      "exercises.score": {
        default: "/art/score-chesscito",
        usedIn: ["Exercises — score", "↳ components/exercises/result-overlay.tsx"],
      },
      "exercises.shop-menu": {
        default: "/art/shop-menu",
        usedIn: ["Exercises — shop menu icon", "↳ components/exercises/persistent-dock.tsx", "↳ components/exercises/shop-sheet.tsx"],
      },
      "exercises.saved-seal": {
        default: "/art/new-icons-chesscito/score-saved",
        usedIn: ["Exercises — score-saved seal", "↳ components/exercises/saved-chip.tsx"],
      },
      "arena.save": {
        default: "/art/new-icons-chesscito/save",
        usedIn: ["Arena — save icon", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/victory-celebration.tsx", "↳ components/coach/game-actions-bar.tsx", "↳ components/redesign/action-pin.tsx"],
      },
      "arena.resign": {
        default: "/art/new-assets-chesscito/arena/resign-game",
        usedIn: ["Arena — resign action", "↳ components/arena/arena-action-bar.tsx"],
      },
      "arena.undo": {
        default: "/art/new-assets-chesscito/arena/undo-move",
        usedIn: ["Arena — undo action", "↳ components/arena/arena-action-bar.tsx"],
      },
      "arena.rival-kairo": {
        default: "/art/rivals/kairo-avatar",
        usedIn: ["Arena — rival Kairo avatar", "↳ components/arena/arena-select-scaffold.tsx (rivals.ts data)"],
      },
      "arena.rival-pipo": {
        default: "/art/rivals/pipo-avatar",
        usedIn: ["Arena — rival Pipo avatar", "↳ components/arena/arena-select-scaffold.tsx (rivals.ts data)"],
      },
      "arena.rival-frame-blue": {
        default: "/art/rivals/frame-blue",
        usedIn: ["Arena — rival frame (blue)", "↳ components/arena/arena-select-scaffold.tsx"],
      },
      "arena.rival-frame-gold": {
        default: "/art/rivals/frame-gold",
        usedIn: ["Arena — rival frame (gold)", "↳ components/arena/arena-select-scaffold.tsx"],
      },
      "arena.rival-frame-silver": {
        default: "/art/rivals/frame-silver",
        usedIn: ["Arena — rival frame (silver)", "↳ components/arena/arena-select-scaffold.tsx"],
      },
      // PRO-only avatar frames (player-avatar.tsx renders `pro && <frame>`).
      // No default → free users see no frame; PRO users get the gold ornament.
      "arena.avatar-frame-you": {
        pro: "/art/chesscito-pro/borde-dorado-avatar-azul",
        usedIn: ["Arena — 'you' player card (PRO gold frame)", "↳ components/redesign/player-avatar.tsx"],
      },
      "arena.avatar-frame-bot": {
        pro: "/art/chesscito-pro/borde-dorado-avatar-rojo",
        usedIn: ["Arena — 'bot' player card (PRO gold frame)", "↳ components/redesign/player-avatar.tsx"],
      },
      "coach.ask-icon": {
        default: "/art/new-assets-chesscito/btns/ask-coach-icon",
        usedIn: ["Coach — ask button icon", "↳ components/coach/game-actions-bar.tsx"],
      },
      "coach.play-again": {
        default: "/art/new-assets-chesscito/btns/play-again-icon",
        usedIn: ["Coach — play again icon", "↳ components/coach/game-actions-bar.tsx"],
      },
      "account.language-icon": {
        default: "/art/new-assets-chesscito/account/language-icon",
        usedIn: ["Account — language row", "↳ components/account/account-sheet.tsx"],
      },
      "account.network-icon": {
        default: "/art/new-assets-chesscito/account/network-icon",
        usedIn: ["Account — network row", "↳ components/account/account-sheet.tsx"],
      },
      "account.wallet-icon": {
        default: "/art/new-assets-chesscito/account/wallet-icon",
        usedIn: ["Account — wallet row", "↳ components/account/account-sheet.tsx"],
      },
      "account.founder": {
        default: "/art/shop/founder",
        usedIn: ["Account — founder badge", "↳ components/account/account-sheet.tsx", "↳ lib/contracts/shop-catalog.ts"],
      },
      "account.shield": {
        default: "/art/shop/shield",
        usedIn: ["Account — shield", "↳ components/account/account-sheet.tsx"],
      },
      // pro-sheet content (pro-sheet.tsx renders these unconditionally — the
      // subscription surface's own art, not a per-user PRO variant).
      "pro-sheet.header-icon": {
        default: "/art/chesscito-pro/chesscito-header-pro-icon",
        usedIn: ["PRO sheet — header icon", "↳ components/pro/pro-sheet.tsx"],
      },
      "pro-sheet.subscription-panel": {
        default: "/art/chesscito-pro/panel-suscription-pro",
        usedIn: ["PRO sheet — subscription panel background", "↳ components/pro/pro-sheet.tsx"],
      },
      "pro-sheet.journal": {
        default: "/art/chesscito-pro/journal-chesscito-pro",
        usedIn: ["PRO sheet — journal illustration", "↳ components/pro/pro-sheet.tsx"],
      },
      "daily.bg-session": {
        default: "/art/bg-sesion-great",
        usedIn: ["Daily — great session background", "↳ components/daily/daily-limit-banner.tsx"],
      },
      "daily.welldone": {
        default: "/art/welldone-sms",
        usedIn: ["Daily — well-done message", "↳ components/daily/daily-tactic-sheet.tsx"],
      },
      "peones.hint": {
        default: "/art/new-icons-chesscito/hint-icon-v1",
        usedIn: ["Peones — hint icon", "↳ components/peones/peones-hint-button.tsx"],
      },
      "peones.piece": {
        default: "/art/new-icons-chesscito/peon-piece-v1",
        usedIn: ["Peones — pawn piece icon", "↳ components/peones/chesito-card.tsx", "↳ components/peones/peones-balance-chip.tsx"],
      },
      "welcome.achievement-1day": {
        default: "/art/achievements/1day-focus",
        usedIn: ["Welcome package — 1-day focus achievement", "↳ components/progression/unlock-overlay.tsx", "↳ components/trophies/achievements-grid.tsx", "↳ components/welcome-package/first-focus-day-overlay.tsx"],
      },
      "landing.pre-chess": {
        default: "/art/landing/pre-chess-exercise",
        usedIn: ["Landing — pre-chess exercise", "↳ components/landing/landing-page.tsx"],
      },
      "tactics.daily-exercise": {
        default: "/art/new-icons-chesscito/ejercicio-diario-chess",
        usedIn: ["Tactics — daily exercise icon", "↳ components/daily/daily-tactic-sheet.tsx", "↳ components/tactics/play-tactics-tile.tsx"],
      },
      "hud.crown": {
        default: "/art/redesign/icons/crown",
        usedIn: ["HUD — crown icon", "↳ components/progression/unlock-overlay.tsx"],
      },
      "hud.trophy": {
        default: "/art/redesign/icons/trophy",
        usedIn: ["HUD — trophy icon", "↳ components/arena/arena-hud.tsx", "↳ components/arena/arena-select-scaffold.tsx", "↳ components/arena/victory-celebration.tsx", "↳ components/arena/victory-claim-success.tsx", "↳ +29 more"],
      },
      "pro-mission.sms": {
        default: "/art/scene-rooted/sms-chesscito",
        usedIn: ["Pro mission — SMS illustration", "↳ components/pro-mission/mission-ribbon.tsx"],
      },
      // scene — kingdom/scene-rooted decorations
      "scene.gem-pill": { default: "/art/scene-rooted/gem-pill-base", usedIn: ["Kingdom scene — gem pill", "↳ components/scene-rooted/gem.tsx (.gem-button)"] },
      "scene.panel-pro": { default: "/art/scene-rooted/panel-pro", usedIn: ["Kingdom scene — pro panel", "↳ components/pro-mission/premium-slot.tsx (.premium-slot)"] },
      "scene.pedestal": { default: "/art/scene-rooted/pedestal-play", usedIn: ["Kingdom scene — play pedestal", "↳ components/kingdom/primary-play-cta.tsx (.primary-play-cta--playhub)"] },
      "scene.stone-1": { default: "/art/scene-rooted/piedra1", usedIn: ["Kingdom scene — stone 1", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-1)"] },
      "scene.stone-2": { default: "/art/scene-rooted/piedra2", usedIn: ["Kingdom scene — stone 2", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-2)"] },
      "scene.stone-3": { default: "/art/scene-rooted/piedra3", usedIn: ["Kingdom scene — stone 3", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-3)"] },
      "scene.stone-4": { default: "/art/scene-rooted/piedra4", usedIn: ["Kingdom scene — stone 4", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-4)"] },
      "scene.stone-5": { default: "/art/scene-rooted/piedra5", usedIn: ["Kingdom scene — stone 5", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-5)"] },
      "scene.stone-6": { default: "/art/scene-rooted/piedra6", usedIn: ["Kingdom scene — stone 6", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-6)"] },
      "scene.stone-7": { default: "/art/scene-rooted/piedra7", usedIn: ["Kingdom scene — stone 7", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-7)"] },
      "scene.stone-8": { default: "/art/scene-rooted/piedra8", usedIn: ["Kingdom scene — stone 8", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-8)"] },
      "scene.stone-9": { default: "/art/scene-rooted/piedra9", usedIn: ["Kingdom scene — stone 9", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-9)"] },
      "scene.stone-10": { default: "/art/scene-rooted/piedra10", usedIn: ["Kingdom scene — stone 10", "↳ components/scene-rooted/stone-pedestal.tsx (.stone-pedestal-stone-10)"] },
      "scene.chest-large": { default: "/art/scene-rooted/treasure-chest-large", usedIn: ["Kingdom scene — large chest", "↳ components/scene-rooted/treasure-tile.tsx (.treasure-tile-large)"] },
      "scene.chest-small": { default: "/art/scene-rooted/treasure-chest-small", usedIn: ["Kingdom scene — small chest", "↳ components/scene-rooted/treasure-tile.tsx (.treasure-tile-small)"] },
      "scene.banner-large": { default: "/art/scene-rooted/wood-banner-blank-large", usedIn: ["Kingdom scene — wood banner (large)", "↳ components/scene-rooted/wood-banner.tsx (.wood-banner-large)"] },
      "scene.banner-medium": { default: "/art/scene-rooted/wood-banner-blank-medium", usedIn: ["Kingdom scene — wood banner (medium)", "↳ components/scene-rooted/wood-banner.tsx (.wood-banner-medium)"] },
      "scene.banner-short": { default: "/art/scene-rooted/wood-banner-blank-short", usedIn: ["Kingdom scene — wood banner (short)", "↳ components/scene-rooted/wood-banner.tsx (.wood-banner-short)"] },
      // bg — screen backgrounds
      "bg.splash-chesscito": { default: "/art/bg-splash-chesscito", usedIn: ["Splash background", "↳ globals.css --intro-bg-mobile (splash background)"] },
      "bg.wallpaper-lite": { default: "/art/bg-wallpaper-lite", usedIn: ["Lite wallpaper background", "↳ components/hub/hub-lite-scaffold.tsx (.hub-lite-scaffold)"] },
      "bg.dock-4slots": { default: "/art/redesign/bg/dock-4slots", usedIn: ["Dock (4 slots) background", "↳ components/exercises/persistent-dock.tsx (.chesscito-dock--four)"] },
      "bg.menu-wall": { default: "/art/redesign/bg/menu-wall", usedIn: ["Menu wall background", "↳ components/exercises/persistent-dock.tsx (.chesscito-dock)"] },
      "bg.path-map": { default: "/art/redesign/bg/path-map", usedIn: ["Learn path map", "↳ lib/exercises/path-layout.ts"] },
      "bg.path-map-base": { default: "/art/redesign/bg/path-map-base", usedIn: ["Learn path map base", "↳ lib/exercises/path-layout.ts"] },
      "bg.splash-loading": { default: "/art/redesign/bg/splash-loading", usedIn: ["Splash loading background", "↳ components/exercises/exercises-screen.tsx (.playhub-intro-overlay)"] },
      // shop
      "shop.coach-pack-20": { default: "/art/shop/coach-pack-20", usedIn: ["Shop — coach pack (20)", "↳ components/exercises/exercises-screen.tsx"] },
      "shop.slot-frame": { default: "/art/shop-slot-frame", usedIn: ["Shop — slot frame", "↳ globals.css .shop-slot-frame / --playhub-slot-frame (CSS-only)"] },
      // arena additions
      "arena.bg-matchup": { default: "/art/arena/bg-matchup", usedIn: ["Arena — matchup background", "↳ components/arena/arena-matchup-transition.tsx"] },
      "arena.result-checkmate": { default: "/art/new-assets-chesscito/games/checkmate-game001", usedIn: ["Arena — checkmate end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.result-draw": { default: "/art/new-assets-chesscito/games/draw-game001", usedIn: ["Arena — draw end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.result-resign": { default: "/art/new-assets-chesscito/games/resign-game001", usedIn: ["Arena — resign end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.result-stalemate": { default: "/art/new-assets-chesscito/games/stalemate-game001", usedIn: ["Arena — stalemate end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.player-you": { default: "/art/new-icons-chesscito/avatar-blue", usedIn: ["Arena — 'you' player avatar", "↳ components/profile/profile-sheet.tsx", "↳ components/redesign/player-avatar.tsx", "↳ app/[locale]/arena/page.tsx"] },
      "arena.player-bot": { default: "/art/new-icons-chesscito/avatar-red", usedIn: ["Arena — 'bot' player avatar", "↳ components/redesign/player-avatar.tsx"] },
      // hub additions
      "hub.cta-principal": { default: "/art/hub/cta-principal", usedIn: ["Hub — principal CTA"] },
      "hub.mate-icon": { default: "/art/hub/mate-icon", usedIn: ["Hub — mate icon", "↳ components/mini-arena/mini-arena-sheet.tsx"] },
      "hub.invite-icon": { default: "/art/hub-new/invite-icon", usedIn: ["Hub — invite icon", "↳ app/api/og/invite/route.tsx (OG invite card)"] },
      "hub.bg": { default: "/art/redesign/bg/bg-new-hub", usedIn: ["Hub — background", "↳ app/[locale]/page.tsx"] },
      "hub.btn-stone-bg": { default: "/art/redesign/banners/btn-stone-bg", usedIn: ["Hub — stone button background", "↳ components/kingdom/primary-play-cta.tsx"] },
      "hub.focus-passport-streak": { default: "/art/focus-passport/panel-streak", usedIn: ["Hub — focus passport streak panel", "↳ components/hub/focus-passport.tsx (panel-streak frame)"] },
      // exercises additions
      "exercises.wall": { default: "/art/labyrinths/wall", usedIn: ["Exercises — labyrinth wall", "↳ components/account/account-sheet.tsx", "↳ components/action-row/action-row-icon.tsx", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/arena-hud.tsx", "↳ +156 more"] },
      "exercises.laberinto": { default: "/art/new-icons-chesscito/laberinto", usedIn: ["Exercises — labyrinth icon", "↳ components/progression/unlock-overlay.tsx"] },
      "exercises.badge-claim": { default: "/art/new-icons-chesscito/badge-claim-icon", usedIn: ["Exercises — badge claim icon", "↳ components/progression/unlock-overlay.tsx", "↳ components/redesign/action-pin.tsx"] },
      "exercises.claim": { default: "/art/new-icons-chesscito/claim-icon-v1", usedIn: ["Exercises — claim icon", "↳ components/redesign/action-pin.tsx"] },
      "exercises.save-score": { default: "/art/new-icons-chesscito/save-score-icon-v1", usedIn: ["Exercises — save score icon", "↳ components/redesign/action-pin.tsx"] },
      "exercises.wallpaper": { default: "/art/redesign/bg/wallpaper-exercises", usedIn: ["Exercises — wallpaper background", "↳ app/[locale]/arena/layout.tsx", "↳ hooks/use-splash-loader.ts"] },
      // welcome additions
      "welcome.achievement-3day": { default: "/art/achievements/3day-focus", usedIn: ["Welcome — 3-day focus achievement", "↳ components/trophies/achievements-grid.tsx"] },
      "welcome.achievement-7day": { default: "/art/achievements/7day-focus", usedIn: ["Welcome — 7-day focus achievement", "↳ components/trophies/achievements-grid.tsx"] },
      "welcome.focus-stamp": { default: "/art/welcome-package/focus-stamp-day1", usedIn: ["Welcome — focus stamp (day 1)", "↳ components/progression/unlock-overlay.tsx", "↳ lib/welcome-package/types.ts"] },
      // landing additions
      "landing.hero": { default: "/art/landing/hero-play-hub", usedIn: ["Landing — play-hub hero", "↳ components/landing/landing-page.tsx"] },
      "landing.progress-trophies": { default: "/art/landing/progress-trophies", usedIn: ["Landing — progress trophies", "↳ components/landing/landing-page.tsx"] },
      // coach addition
      "coach.play": { default: "/art/new-assets-chesscito/btns/play", usedIn: ["Coach — play button", "↳ components/coach/game-actions-bar.tsx", "↳ app/[locale]/coach/[gameId]/coach-game-client.tsx"] },
      // account addition
      "account.account-icon": { default: "/art/screen-mission/account-icon", usedIn: ["Account — account icon", "↳ components/account/account-sheet.tsx"] },
      // shared additions
      "shared.panel-frame": { default: "/art/panel-frame-rune", usedIn: ["Panel frame (rune)", "↳ globals.css .rune-frame / --playhub-rune-frame (CSS-only)"] },
      "shared.time": { default: "/art/redesign/icons/time", usedIn: ["Time icon", "↳ components/account/account-sheet.tsx", "↳ components/arena/arena-board.tsx", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/arena-hud.tsx", "↳ +154 more"] },
      // brand addition
      "brand.favicon": { default: "/art/favicon-wolf", usedIn: ["Brand — favicon / wolf mark", "↳ app/[locale]/about/page.tsx", "↳ app/[locale]/error.tsx", "↳ app/[locale]/not-found.tsx", "↳ app/[locale]/victory/[id]/error.tsx"] },
      // The playable board's frame — the decorative border around the live
      // GameBoard (1040×1028, measured inner opening in game-board.tsx). The
      // squares inside are procedural tiles (board.tile.*).
      "board.frame": {
        default: "/art/board/borde-tablero-chesscito1",
        usedIn: ["GameBoard — playable board frame", "↳ lib/game/game-board.tsx"],
      },
      // The pre-composed framed-board illustration used ONLY for thumbnails /
      // previews (avoids laying out a position in small scenarios). NOT the
      // playable board. (Legacy `/art/chesscito-board` is dead — canvas is
      //  background:none; only the OG home card still uses it, left unregistered.)
      "board.thumbnail": {
        default: "/art/redesign/board/board-ch",
        usedIn: ["Hub — KingdomAnchor board", "Board thumbnail", "Splash preload", "↳ components/board/board-thumbnail.tsx", "↳ components/kingdom/kingdom-anchor.tsx", "↳ hooks/use-splash-loader.ts"],
      },
      // DEPRECATED: the old flat board bg. The game canvas is background:none
      // (tiles + board.frame render the board now); only the OG home card still
      // references it. Kept visible so it can be retired deliberately.
      "board.legacy-bg": {
        default: "/art/chesscito-board",
        usedIn: ["OG — home social card"],
        deprecated: "legacy flat board — only OG home uses it; retire when possible",
      },
      "board.tile.light": {
        default: "/art/board/casilla-clara",
        usedIn: ["Board — light squares", "↳ lib/game/game-board.tsx (.game-board-tile-light)"],
      },
      "board.tile.dark": {
        default: "/art/board/casilla-oscura",
        usedIn: ["Board — dark squares", "↳ lib/game/game-board.tsx (.game-board-tile-dark)"],
      },
      // White = player pieces (main board renders these; black is tinted there
      // via pieceTintClass, but black ALSO ships as real b-* assets used for
      // enemies in promotion-run / safe-path and the kingdom-anchor board).
      "board.piece.white.rook": {
        default: "/art/redesign/pieces/w-rook",
        usedIn: ["Board — white rook", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/result-overlay.tsx", "↳ components/hub/mastery-tile.tsx", "↳ +3 more"],
      },
      "board.piece.white.bishop": {
        default: "/art/redesign/pieces/w-bishop",
        usedIn: ["Board — white bishop", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/diagonal-run-board.tsx", "↳ components/exercises/result-overlay.tsx", "↳ +3 more"],
      },
      "board.piece.white.knight": {
        default: "/art/redesign/pieces/w-knight",
        usedIn: ["Board — white knight", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/diagonal-run-board.tsx", "↳ components/exercises/knight-tour-board.tsx", "↳ +4 more"],
      },
      "board.piece.white.pawn": {
        default: "/art/redesign/pieces/w-pawn",
        usedIn: ["Board — white pawn", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/victory-celebration.tsx", "↳ components/arena/victory-claim-error.tsx", "↳ components/arena/victory-claim-success.tsx", "↳ +7 more"],
      },
      "board.piece.white.queen": {
        default: "/art/redesign/pieces/w-queen",
        usedIn: ["Board — white queen", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/queens-board.tsx", "↳ components/exercises/result-overlay.tsx", "↳ +3 more"],
      },
      "board.piece.white.king": {
        default: "/art/redesign/pieces/w-king",
        usedIn: ["Board — white king", "↳ components/hub/hub-scaffold.tsx"],
      },
      "board.piece.black.rook": {
        default: "/art/redesign/pieces/b-rook",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.bishop": {
        default: "/art/redesign/pieces/b-bishop",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.knight": {
        default: "/art/redesign/pieces/b-knight",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.pawn": {
        default: "/art/redesign/pieces/b-pawn",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ components/arena/arena-select-scaffold.tsx", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.queen": {
        default: "/art/redesign/pieces/b-queen",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.king": {
        default: "/art/redesign/pieces/b-king",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
    },
  },
};

/** Theme served when no per-user setting is present + the only theme
 *  every wallet owns by default. */
export const DEFAULT_THEME_ID = "candy-forest";
