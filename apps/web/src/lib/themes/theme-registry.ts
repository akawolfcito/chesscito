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

/** Asset variant within a single theme. `pro` is the established second
 * technical visual slot. In LEARN it may be selected by effective Training
 * Pass presentation and does not assert that the wallet owns commercial PRO. */
export type ThemeAssetVariant = "default" | "pro";

export type ThemeSlotSurface =
  | "learn"
  | "play"
  | "landing"
  | "shared"
  | "full-legacy"
  | "dev-only"
  | "unknown";

/** Which Next app's `public/` owns a slot's file. The monorepo ships two:
 *  `web` (the game) and `landing` (the marketing carousel). Absence means
 *  `web` — the backward-compatible default for every pre-existing slot.
 *  Type-only here so client bundles never pull the fs resolver; the mapping
 *  to a directory lives in `asset-roots.ts` (server-only). */
export type AppRoot = "web" | "landing";

/** Extensions a single-file slot may declare. A slot without `format` is a
 *  PNG/WebP/AVIF triplet — the shape ~165 slots have. */
export type SingleFileFormat = "jpg" | "ico" | "png";

export type ThemeAssetEntry = {
  /** Legacy string basenames remain valid. An explicit object can select an
   *  asset or disable the DEFAULT image. Absence is backward-compatible none. */
  default?: DefaultThemeAssetValue;
  /** PRO-tier override. Absence is backward-compatible inherit; explicit
   *  states can select an asset, inherit DEFAULT, or render no image. */
  pro?: ProThemeAssetValue;
  /** App whose `public/` holds this slot's file. Omit for `web`. Only the
   *  catalog/uploader reads it — no runtime consumer does, so adding it to a
   *  slot never changes what the app renders. */
  root?: AppRoot;
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
  /** This slot is ONE file with this fixed extension, not a triplet. Set it
   *  for assets that must keep a specific container: an Open Graph .jpg, a
   *  browser .ico. Absent = the historic triplet. */
  format?: SingleFileFormat;
  /** This slot is generated from another slot and is not editable on its own.
   *  The catalog renders it read-only and the upload API refuses it. */
  derivedFrom?: ThemeAssetKey;
  /** Reject an upload that is not exactly these dimensions. For slots where a
   *  wrong aspect ratio breaks a consumer that cannot report it — an Open
   *  Graph card silently letterboxes in every social preview. */
  exactSize?: { width: number; height: number };
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
  | "hub.arena-warmup"
  | "hub.quick-match-benefit"
  | "hub.coach-review-benefit"
  | "hub.rewards-benefit"
  // PRO tour benefits — the subscription's own perks, deliberately NOT the
  // three KingdomCard navigation chips above.
  | "hub.pro-benefit-season-pass"
  | "hub.pro-benefit-coach"
  | "hub.pro-benefit-complete"
  | "hub.shop-icon"
  | "hub.btn-battle"
  | "hub.btn-play"
  | "hub.principal-button"
  | "hub.tour-hero"
  | "hub.tour-title"
  | "hub.guide"
  | "hub.21-day-icon"
  | "hub.focus-passport-calendar"
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
  // The Focus Passport streak sprites. Three slots, not one with variants:
  // a theme may want a different flame per state, and `variant` is reserved
  // for the free/PRO axis.
  | "season.story-arrow"
  | "shared.flame-color"
  | "shared.flame-blue"
  | "shared.flame-gray"
  | "shared.star"
  | "shared.mission-adorno"
  | "shared.mission-avatar"
  | "shared.close"
  | "shared.close-candy"
  | "shared.tour-help"
  | "shared.mission-panel"
  | "shared.trophy-epic"
  | "shared.feedback-sad"
  | "shared.feedback-thinking"
  | "shared.feedback-questioning"
  | "payments.celebration-bg"
  | "payments.offer-bg"
  // brand — identity assets (not game theme, but updatable)
  | "brand.title"
  | "brand.title-login"
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
  | "arena.rival-mara"
  | "arena.rival-frame-blue"
  | "arena.rival-frame-gold"
  | "arena.rival-frame-silver"
  // PRO-only overlays: no default (free users see nothing), pro = gold frame
  | "arena.avatar-frame-you"
  | "arena.avatar-frame-bot"
  // coach
  | "coach.ask-icon"
  | "coach.play-again"
  | "coach.share-trophy"
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
  | "bg.login-learn"
  | "bg.login-play"
  | "bg.wallpaper-lite"
  | "bg.dock-4slots"
  | "bg.menu-wall"
  | "bg.path-map"
  | "bg.path-map-base"
  | "bg.splash-loading"
  | "shop.coach-pack-20"
  | "shop.pro"
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
  // Onboarding carousel, 2026-07-29 redesign: one illustration per slide, and
  // title art per locale for slides 2-4 (the Spanish files spell different
  // words). Slide 1 keeps a single title slot — same wordmark in both.
  | "landing.slide1-bg"
  | "landing.slide2-bg"
  | "landing.slide3-bg"
  | "landing.slide4-bg"
  | "landing.slide1-title"
  | "landing.slide2-title-en"
  | "landing.slide2-title-es"
  | "landing.slide3-title-en"
  | "landing.slide3-title-es"
  | "landing.slide4-title-en"
  | "landing.slide4-title-es"
  // Superseded by the above, still on disk and therefore still replaceable.
  | "landing.slides-frame"
  | "landing.slides-scene-desktop"
  | "landing.slide1-avatar"
  | "landing.slide2-avatar"
  | "landing.slide2-title"
  | "landing.slide3-avatar"
  | "landing.slide3-title"
  | "landing.slide4-avatar"
  | "landing.season-pass-icon"
  | "landing.pro-icon"
  | "landing.slide-web-1"
  | "landing.slide-web-2"
  | "landing.slide-web-3"
  | "landing.slide-web-4"
  | "coach.play"
  | "account.account-icon"
  | "shared.panel-frame"
  | "shared.time"
  | "brand.favicon"
  | "brand.apple-icon"
  | "brand.favicon-ico"
  | "landing.og-image"
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
  | "board.piece.black.king"
  // Exercise obstacle — the practice blocker. NOT the maze/ludic wall
  // (that stays ambient scene stone). Painted where a level lists
  // `obstacles`, replacing the historic white-knight stand-in.
  | "board.blocker.stone";

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
      "hub.enter-arena": { pro: { mode: "inherit" },
        default: "/art/hub/enter-arena",
        usedIn: ["Hub — enter arena button", "↳ components/exercises/persistent-dock.tsx", "↳ components/hub/hub-scaffold.tsx", "↳ components/hub/play-hub-scaffold.tsx"],
      },
      "hub.train-pieces": { pro: { mode: "inherit" },
        default: "/art/hub/train-pieces",
        usedIn: ["Learn Hub — START FOCUS icon · HubLiteScaffold · route: /", "Learn/Play Hub — Training side of mode selector · AppModeSwitch · route: /", "Full Hub — primary training CTA · HubScaffold · route: /", "Arena/Exercises — Pieces center dock action · PersistentDock", "↳ components/hub/hub-lite-scaffold.tsx", "↳ components/hub/app-mode-switch.tsx", "↳ components/hub/hub-scaffold.tsx", "↳ components/exercises/persistent-dock.tsx"],
      },
      "hub.play-chess": {
        default: "/art/new-icons-chesscito/play-chess",
        usedIn: ["Hub — play chess icon", "↳ components/hub/hub-scaffold.tsx", "↳ components/ui/tile-icon-slot.tsx"],
      },
      "hub.training": { pro: { mode: "inherit" },
        default: "/art/new-icons-chesscito/training",
        usedIn: ["Play Hub — Coach tile · PlayHubScaffold · route: /", "Full Hub — Coach action rail · HubScaffold · route: /", "Coach/Journal — Training Journal header · CoachHistoryPage · route: /coach/history", "Coach review — match-review header and error states · CoachGamePage/CoachGameClient · route: /coach/[gameId]", "Account — Coach row icon · AccountSheet · route: /exercises?sheet=account", "↳ components/hub/play-hub-scaffold.tsx", "↳ components/hub/hub-scaffold.tsx", "↳ app/[locale]/coach/history/page.tsx", "↳ app/[locale]/coach/[gameId]/page.tsx", "↳ app/[locale]/coach/[gameId]/coach-game-client.tsx", "↳ components/account/account-sheet.tsx"],
      },
      "hub.training-icon": {
        default: "/art/new-icons-chesscito/training-icon-v1",
        usedIn: ["Learn Hub — Focus Passport Special Training benefit · ChallengeCard · route: /", "Full Hub — Special Training/Mate tile · HubArenaTile · route: /", "Exercises action row — Special Training bridge pedestal · MiniArenaBridgeSlot · route: /exercises", "Progression — Special Training unlock celebration · UnlockOverlay · exercise completion overlay", "Shared map — training-icon-v1 resolves through ActionRowIcon", "↳ components/hub/challenge-card.tsx", "↳ components/hub/hub-arena-tile.tsx", "↳ components/mini-arena/mini-arena-bridge-slot.tsx", "↳ components/progression/unlock-overlay.tsx", "↳ components/action-row/action-row-icon.tsx"],
      },
      "hub.daily-icon": {
        default: "/art/new-icons-chesscito/daily-icon-v1",
        usedIn: ["Hub — daily icon", "↳ components/hub/hub-daily-tile.tsx", "↳ app/[locale]/page.tsx"],
      },
      "hub.arena-warmup": {
        default: "/art/action-row/pergamino-tactico",
        usedIn: ["Play Hub — Arena Warm-up path tile · PlayTacticsTile · route: /", "↳ components/tactics/play-tactics-tile.tsx"],
      },
      "hub.quick-match-benefit": {
        default: "/art/hub/enter-arena",
        usedIn: ["Play Hub — KingdomCard Quick Match benefit · route: /", "↳ components/kingdom/kingdom-card.tsx"],
      },
      "hub.coach-review-benefit": {
        default: "/art/new-icons-chesscito/training",
        usedIn: ["Play Hub — KingdomCard Coach Review benefit · route: /", "↳ components/kingdom/kingdom-card.tsx"],
      },
      "hub.rewards-benefit": {
        default: "/art/scene-rooted/treasure-chest-small",
        usedIn: ["Play Hub — KingdomCard Rewards benefit · route: /", "↳ components/kingdom/kingdom-card.tsx"],
      },
      "hub.pro-benefit-season-pass": {
        default: "/art/landing-slides/season-pass-icon",
        usedIn: ["Play Hub — mini-tour PRO step, Season Pass benefit · route: /", "↳ components/hub/hub-tour.tsx"],
      },
      "hub.pro-benefit-coach": {
        default: "/art/new-assets-chesscito/btns/ask-coach-icon",
        usedIn: ["Play Hub — mini-tour PRO step, Unlimited Coach benefit · route: /", "↳ components/hub/hub-tour.tsx"],
      },
      "hub.pro-benefit-complete": {
        default: "/art/landing-slides/pro-suscription-icon",
        usedIn: ["Play Hub — mini-tour PRO step, Complete Experience benefit · route: /", "↳ components/hub/hub-tour.tsx"],
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
      "hub.guide": { pro: { mode: "none" },
        default: "/art/scene-rooted/guide-secuencia",
        usedIn: ["Hub — guide sequence", "↳ components/hub/hub-scaffold.tsx"],
      },
      "hub.21-day-icon": {
        default: "/art/21-day-icon",
        usedIn: ["Hub — 21-day challenge icon", "↳ components/hub/challenge-card.tsx"],
      },
      "hub.focus-passport-calendar": {
        default: "/art/hub-icns/calendar-icon",
        usedIn: ["Learn Hub — Focus Passport duration benefit · ChallengeCard · route: /", "↳ components/hub/challenge-card.tsx"],
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
      "shared.avatar-small-account": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/avatar-small-account/pro" },
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
      "shared.feedback-happy": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/feedback-happy/pro" },
        default: "/art/new-assets-chesscito/fun/avatar-feliz",
        usedIn: ["Exercises result", "Arena victory / claim-success", "↳ components/arena/victory-celebration.tsx", "↳ components/arena/victory-claim-success.tsx", "↳ components/exercises/labyrinth-complete-overlay.tsx", "↳ components/exercises/result-overlay.tsx", "↳ +1 more"],
      },
      "shared.feedback-confident": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/feedback-confident/pro" },
        default: "/art/new-assets-chesscito/fun/avatar-confiado",
        usedIn: ["Arena — claiming", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/victory-claiming.tsx", "↳ components/victory/victory-landing-card.tsx"],
      },
      "shared.feedback-scared": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/feedback-scared/pro" },
        default: "/art/new-assets-chesscito/fun/avatar-asustado",
        usedIn: ["Arena — claim error", "↳ components/arena/victory-claim-error.tsx"],
      },
      "shared.feedback-surprised": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/feedback-surprised/pro" },
        default: "/art/new-assets-chesscito/fun/avatar-asombrado",
        usedIn: ["Exercises / payments", "↳ components/arena/arena-end-state.tsx", "↳ components/exercises/result-overlay.tsx", "↳ components/payments/get-peones-sheet.tsx"],
      },
      "shared.panel-bg": {
        default: "/art/new-assets-chesscito/paneles/panel-bg1",
        usedIn: ["Payments", "Victory", "Arena", "Exercises", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/promotion-overlay.tsx", "↳ components/arena/victory-popup-shell.tsx", "↳ components/exercises/fail-rescue-modal.tsx", "↳ +1 more"],
      },
      "shared.shield": {
        default: "/art/redesign/icons/shield",
        usedIn: ["Learn Hub — Focus Passport Shield benefit · ChallengeCard · route: /", "Arena", "Exercises", "↳ components/hub/challenge-card.tsx", "↳ components/arena/arena-hud.tsx", "↳ components/exercises/exercise-drawer.tsx", "↳ components/exercises/fail-rescue-modal.tsx"],
      },
      "season.story-arrow": {
        default: "/art/season/arrow-right",
        usedIn: ["Payments — Season Pass offer, between the story beats", "↳ components/payments/season-pass-sheet.tsx"],
      },
      "shared.flame-color": {
        default: "/art/focus-passport/flame-color",
        usedIn: ["Hub — Focus Passport streak", "Hub — Challenge card streak", "Payments — Season Pass offer story row", "↳ components/hub/focus-passport.tsx", "↳ components/hub/challenge-card.tsx", "↳ components/payments/season-pass-sheet.tsx"],
      },
      "shared.flame-blue": {
        default: "/art/focus-passport/flame-blue",
        usedIn: ["Hub — Focus Passport streak", "Hub — Challenge card streak", "↳ components/hub/focus-passport.tsx", "↳ components/hub/challenge-card.tsx"],
      },
      "shared.flame-gray": {
        default: "/art/focus-passport/flame-gray",
        usedIn: ["Hub — Focus Passport streak", "Hub — Challenge card streak", "↳ components/hub/focus-passport.tsx", "↳ components/hub/challenge-card.tsx"],
      },
      "shared.star": {
        default: "/art/redesign/icons/star",
        usedIn: ["Board target marker", "Exercises", "Daily", "↳ components/board.tsx", "↳ components/daily/daily-tactic-sheet.tsx", "↳ components/exercises/fail-rescue-modal.tsx", "↳ components/exercises/mission-panel-candy.tsx"],
      },
      "shared.mission-adorno": {
        default: "/art/screen-mission/adorno-icon",
        usedIn: ["Arena", "Exercises", "↳ components/arena/promotion-overlay.tsx", "↳ components/arena/soft-gate-sheet.tsx", "↳ components/exercises/mission-detail-sheet.tsx", "↳ components/exercises/purchase-confirm-sheet.tsx", "↳ +2 more"],
      },
      "shared.mission-avatar": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/mission-avatar/pro" },
        default: "/art/screen-mission/avatar-icon",
        usedIn: ["Arena", "Exercises", "↳ components/arena/soft-gate-sheet.tsx", "↳ components/exercises/mission-briefing.tsx", "↳ components/exercises/mission-detail-sheet.tsx"],
      },
      // Distinct art from shared.close: that one is the mission panel's
      // ornate close button, this is the flat icon CandyIcon renders.
      "shared.close-candy": {
        default: "/art/redesign/icons/close",
        usedIn: ["UI — CandyIcon close", "↳ components/redesign/candy-icon.tsx (composed path, name=\"close\")"],
      },
      "shared.close": {
        default: "/art/screen-mission/close-icon",
        usedIn: ["Arena", "Exercises", "Daily", "Peones", "UI", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/promotion-overlay.tsx", "↳ components/arena/soft-gate-sheet.tsx", "↳ components/arena/victory-popup-shell.tsx", "↳ +8 more"],
      },
      "shared.tour-help": {
        default: "/art/hub-icns/pregunta-icon",
        usedIn: [
          "Learn Hub — replay mini-tour",
          "Play Hub — replay mini-tour",
          "↳ components/hub/challenge-card.tsx",
          "↳ components/kingdom/kingdom-card.tsx",
        ],
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
      "shared.feedback-sad": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/feedback-sad/pro" },
        default: "/art/new-assets-chesscito/fun/avatar-triste",
        usedIn: ["Overlays / modals — sad reaction", "↳ components/arena/arena-end-state.tsx"],
      },
      "shared.feedback-thinking": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/feedback-thinking/pro" },
        default: "/art/new-assets-chesscito/fun/avatar-pensativo",
        usedIn: ["Overlays / modals — thinking reaction"],
      },
      "shared.feedback-questioning": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/shared/feedback-questioning/pro" },
        default: "/art/new-assets-chesscito/fun/avatar-interrogativo",
        usedIn: ["Overlays / modals — questioning reaction", "↳ components/arena/arena-end-state.tsx"],
      },
      "payments.celebration-bg": {
        default: "/art/celebration/bg-celebration",
        usedIn: ["Payments — celebration background", "↳ components/payments/season-pass-celebration.tsx"],
      },
      "payments.offer-bg": {
        default: "/art/new-assets-chesscito/paneles/panel-bg2",
        usedIn: ["Payments — Season Pass offer sheet background (dedicated so the shared panel-bg stays panel-bg1)", "↳ components/payments/season-pass-sheet.tsx"],
      },
      "brand.title": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/brand/title/pro" },
        default: "/art/title-chesscito",
        usedIn: ["Brand — Chesscito wordmark", "↳ components/hub/hub-lite-scaffold.tsx", "↳ components/hub/play-hub-scaffold.tsx"],
      },
      // Its own slot, not a reuse of brand.title: the login modal is the only
      // surface a visitor sees before the app, and it sits on a dark sheet the
      // hub never uses. Sharing brand.title meant a Replace could not change
      // one without the other.
      "brand.title-login": {
        default: "/art/title-chesscito-login",
        usedIn: [
          "Web access gate — wordmark inside the Privy login modal",
          "↳ components/web-wallet-provider.tsx (config.appearance.logo)",
        ],
      },
      "brand.ring-start-focus": {
        default: { mode: "none" },
        pro: "/art/ring-start-focus",
        usedIn: ["Hub — start-focus ring", "Root", "↳ components/hub/hub-lite-scaffold.tsx", "↳ app/[locale]/page.tsx"],
      },
      "exercises.avatar-fun": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/exercises/avatar-fun/pro" },
        default: "/art/avatar-fun",
        usedIn: ["Exercises — success avatar (mission panel)", "↳ components/daily/daily-tactic-sheet.tsx"],
      },
      "exercises.avatar-try-again": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/exercises/avatar-try-again/pro" },
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
        usedIn: ["Exercises — combo icon", "↳ components/exercises/exercise-drawer.tsx", "Exercises — celebration overlay Session Combo reward · route: /exercises", "↳ components/exercises/mission-panel-candy.tsx"],
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
      "arena.rival-mara": {
        default: "/art/rivals/mara-avatar",
        usedIn: ["Arena — rival Mara avatar (medium)", "↳ components/arena/arena-select-scaffold.tsx (rivals.ts data)", "↳ components/arena/arena-player-rail.tsx"],
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
      "coach.share-trophy": {
        default: "/art/new-assets-chesscito/btns/share-trophy",
        usedIn: ["Coach — share trophy icon (Match Review)", "↳ components/coach/game-actions-bar.tsx"],
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
      "pro-sheet.header-icon": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/pro-sheet/header-icon/pro" },
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
      "daily.bg-session": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/daily/bg-session/pro" },
        default: "/art/bg-sesion-great",
        usedIn: ["Daily — great session background", "↳ components/daily/daily-limit-banner.tsx"],
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
        root: "landing",
        default: "/art/landing/pre-chess-exercise",
        usedIn: ["Landing — pre-chess exercise", "↳ apps/landing · components/landing/landing-page.tsx"],
      },
      "tactics.daily-exercise": {
        default: "/art/new-icons-chesscito/ejercicio-diario-chess",
        usedIn: ["Tactics — daily exercise icon", "↳ components/daily/daily-tactic-sheet.tsx"],
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
      // Web access gate wallpapers. Emitted by `WebAccessThemeVariables`, which
      // mounts ABOVE the gate — the app-wide `ThemeCssVariables` sits behind it
      // and would not exist while the gate is on screen. Default-only on
      // purpose: the gate renders for a visitor with no wallet, so no theme
      // entitlement can resolve and a `pro` variant would never show.
      "bg.login-learn": { default: "/art/bg-login-learn", usedIn: ["Web access gate — Learn wallpaper", "↳ components/themes/theme-css-variables.tsx (--theme-bg-login-learn)", "↳ globals.css .web-access-screen[data-surface=learn]"] },
      "bg.login-play": { default: "/art/bg-login-play", usedIn: ["Web access gate — Play wallpaper", "↳ components/themes/theme-css-variables.tsx (--theme-bg-login-play)", "↳ globals.css .web-access-screen[data-surface=play]"] },
      "bg.wallpaper-lite": { default: "/art/bg-wallpaper-lite", usedIn: ["Lite wallpaper background", "↳ components/hub/hub-lite-scaffold.tsx (.hub-lite-scaffold)"] },
      "bg.dock-4slots": { default: "/art/redesign/bg/dock-4slots", usedIn: ["Dock (4 slots) background", "↳ components/exercises/persistent-dock.tsx (.chesscito-dock--four)"] },
      "bg.menu-wall": { default: "/art/redesign/bg/menu-wall", usedIn: ["Menu wall background", "↳ components/exercises/persistent-dock.tsx (.chesscito-dock)"] },
      "bg.path-map": { default: "/art/redesign/bg/path-map", usedIn: ["Learn path map", "↳ lib/exercises/path-layout.ts"] },
      "bg.path-map-base": { default: "/art/redesign/bg/path-map-base", usedIn: ["Learn path map base", "↳ lib/exercises/path-layout.ts"] },
      "bg.splash-loading": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/bg/splash-loading/pro" }, default: "/art/redesign/bg/splash-loading", usedIn: ["Splash loading background", "↳ components/exercises/exercises-screen.tsx (.playhub-intro-overlay)"] },
      // shop
      "shop.coach-pack-20": { default: "/art/shop/coach-pack-20", usedIn: ["Shop — coach pack (20)", "↳ components/exercises/exercises-screen.tsx"] },
      "shop.pro": { default: "/art/shop/pro", usedIn: ["Shop — PRO subscription tile icon", "↳ components/exercises/shop-sheet.tsx (SHOP_TILE_ASSETS)"] },
      "shop.slot-frame": { default: "/art/shop-slot-frame", usedIn: ["Shop — slot frame", "↳ globals.css .shop-slot-frame / --playhub-slot-frame (CSS-only)"] },
      // arena additions
      "arena.bg-matchup": { default: "/art/arena/bg-matchup", usedIn: ["Arena — matchup background", "↳ components/arena/arena-matchup-transition.tsx"] },
      "arena.result-checkmate": { default: "/art/new-assets-chesscito/games/checkmate-game001", usedIn: ["Arena — checkmate end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.result-draw": { default: "/art/new-assets-chesscito/games/draw-game001", usedIn: ["Arena — draw end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.result-resign": { default: "/art/new-assets-chesscito/games/resign-game001", usedIn: ["Arena — resign end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.result-stalemate": { default: "/art/new-assets-chesscito/games/stalemate-game001", usedIn: ["Arena — stalemate end-state", "↳ components/arena/arena-end-state.tsx"] },
      "arena.player-you": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/arena/player-you/pro" }, default: "/art/new-icons-chesscito/avatar-blue", usedIn: ["Arena — 'you' player avatar", "↳ components/profile/profile-sheet.tsx", "↳ components/redesign/player-avatar.tsx", "↳ app/[locale]/arena/page.tsx"] },
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
      // landing additions — every slot below lives in apps/landing/public,
      // NOT apps/web/public. Before `root`, these three pointed at orphan
      // copies inside the web app that nothing renders, so replacing them
      // here never reached the live landing.
      "landing.hero": { root: "landing", default: "/art/landing/hero-play-hub", usedIn: ["Landing — play-hub hero", "↳ apps/landing · components/landing/landing-page.tsx"] },
      "landing.progress-trophies": { root: "landing", default: "/art/landing/progress-trophies", usedIn: ["Landing — progress trophies", "↳ apps/landing · components/landing/landing-page.tsx"] },
      // landing onboarding carousel — one full-bleed illustration per slide
      // plus its title art. Source of truth for the paths:
      // apps/landing/src/lib/onboarding/slides.ts (SLIDE_VISUALS).
      //
      // ⚠️ Title art is PER LOCALE for slides 2-4: the Spanish files carry
      // different words (ES-learn reads "APRENDE", not "LEARN"), so they are
      // separate slots. One slot = one file stays true; a single "slide2
      // title" slot would have made replacing the English wordmark silently
      // leave the Spanish one behind. Slide 1 is the exception on purpose —
      // the CHESSCITO wordmark is the same picture in both locales, so both
      // locales read the one slot.
      "landing.slide1-bg": { root: "landing", default: "/art/landing-slides/slide-bg-1", usedIn: ["Landing — slide 1 illustration (welcome)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide2-bg": { root: "landing", default: "/art/landing-slides/slide-bg-2", usedIn: ["Landing — slide 2 illustration (Learn)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide3-bg": { root: "landing", default: "/art/landing-slides/slide-bg-3", usedIn: ["Landing — slide 3 illustration (Play)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide4-bg": { root: "landing", default: "/art/landing-slides/slide-bg-4", usedIn: ["Landing — slide 4 illustration (Choose your path)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide1-title": { root: "landing", default: "/art/landing-slides/title-chesscito", usedIn: ["Landing — slide 1 title art (CHESSCITO, both locales)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide2-title-en": { root: "landing", default: "/art/landing-slides/title-learn-en", usedIn: ["Landing — slide 2 title art, EN (LEARN)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide2-title-es": { root: "landing", default: "/art/landing-slides/title-learn-es", usedIn: ["Landing — slide 2 title art, ES (APRENDE)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide3-title-en": { root: "landing", default: "/art/landing-slides/title-play-en", usedIn: ["Landing — slide 3 title art, EN (PLAY)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide3-title-es": { root: "landing", default: "/art/landing-slides/title-play-es", usedIn: ["Landing — slide 3 title art, ES (JUEGA)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide4-title-en": { root: "landing", default: "/art/landing-slides/title-choose-en", usedIn: ["Landing — slide 4 title art, EN (CHOOSE YOUR PATH)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      "landing.slide4-title-es": { root: "landing", default: "/art/landing-slides/title-choose-es", usedIn: ["Landing — slide 4 title art, ES (ELIGE TU CAMINO)", "↳ apps/landing · lib/onboarding/slides.ts"] },
      // Superseded 2026-07-29 by the full-bleed redesign. Still on disk, so
      // they stay cataloged rather than rotting invisibly — same treatment as
      // the landing.slide-web-* group below. The frame and the desktop
      // backdrop went away with the gold frame; the four avatars are now
      // painted INTO each slide's illustration, and the two title files below
      // were replaced by per-locale art.
      "landing.slides-frame": { root: "landing", default: "/art/landing-slides/bg-slides", deprecated: "no consumer — gold frame removed by the 2026-07-29 slide redesign", usedIn: [] },
      "landing.slides-scene-desktop": { root: "landing", default: "/art/landing-slides/bg-slides-web", deprecated: "no consumer — desktop backdrop removed by the 2026-07-29 slide redesign", usedIn: [] },
      "landing.slide1-avatar": { root: "landing", default: "/art/landing-slides/avatar-chesscito-welcome", deprecated: "no consumer — baked into landing.slide1-bg", usedIn: [] },
      "landing.slide2-avatar": { root: "landing", default: "/art/landing-slides/avatar-21-day-challenge", deprecated: "no consumer — baked into landing.slide2-bg", usedIn: [] },
      "landing.slide3-avatar": { root: "landing", default: "/art/landing-slides/avatar-play-chess", deprecated: "no consumer — baked into landing.slide3-bg", usedIn: [] },
      "landing.slide4-avatar": { root: "landing", default: "/art/landing-slides/avatar-learn-path", deprecated: "no consumer — baked into landing.slide4-bg", usedIn: [] },
      "landing.slide2-title": { root: "landing", default: "/art/landing-slides/21-day-challente-title", deprecated: "no consumer — superseded by landing.slide2-title-{en,es}", usedIn: [] },
      "landing.slide3-title": { root: "landing", default: "/art/landing-slides/play-chess-title", deprecated: "no consumer — superseded by landing.slide3-title-{en,es}", usedIn: [] },
      "landing.season-pass-icon": { root: "landing", default: "/art/landing-slides/season-pass-icon", usedIn: ["Landing — Season Pass plan icon", "↳ apps/landing · lib/onboarding/slides.ts (ICONS.seasonPass)"] },
      "landing.pro-icon": { root: "landing", default: "/art/landing-slides/pro-suscription-icon", usedIn: ["Landing — PRO subscription plan icon", "↳ apps/landing · lib/onboarding/slides.ts (ICONS.pro)"] },
      // On disk in apps/landing/public but referenced by nothing in the
      // monorepo — cataloged so the stale art is visible and replaceable
      // rather than silently rotting.
      "landing.slide-web-1": { root: "landing", default: "/art/landing-slides/chesscito-slide-web-1", deprecated: "no consumer — desktop slide art nothing imports", usedIn: [] },
      "landing.slide-web-2": { root: "landing", default: "/art/landing-slides/chesscito-slide-web-2", deprecated: "no consumer — desktop slide art nothing imports", usedIn: [] },
      "landing.slide-web-3": { root: "landing", default: "/art/landing-slides/chesscito-slide-web-3", deprecated: "no consumer — desktop slide art nothing imports", usedIn: [] },
      "landing.slide-web-4": { root: "landing", default: "/art/landing-slides/chesscito-slide-web-4", deprecated: "no consumer — desktop slide art nothing imports", usedIn: [] },
      // Brand icons — apps/landing/public, single files rather than triplets.
      // The two below are DERIVED from brand.favicon: replacing that slot
      // regenerates them and the upload API refuses a direct write, so they
      // cannot drift from the wolf master. See lib/themes/icon-derivation.ts.
      "brand.favicon-ico": {
        root: "landing", format: "ico", derivedFrom: "brand.favicon",
        default: "/favicon",
        usedIn: ["Landing — browser favicon", "↳ apps/landing · src/app/layout.tsx (icons.icon)"],
      },
      "brand.apple-icon": {
        root: "landing", format: "png", derivedFrom: "brand.favicon",
        default: "/apple-icon",
        usedIn: ["Landing — apple touch icon", "↳ apps/landing · src/app/layout.tsx (icons.apple)"],
      },
      // The social card. Editable on its own — it is composed art, not a crop
      // of the mark. 1200x630 is enforced: every social preview letterboxes a
      // wrong ratio silently, so a bad upload reports nothing on its own.
      "landing.og-image": {
        root: "landing", format: "jpg",
        default: "/og/chesscito-landing",
        exactSize: { width: 1200, height: 630 },
        usedIn: [
          "Landing — Open Graph / Twitter card",
          "↳ apps/landing · src/app/layout.tsx (openGraph.images, twitter.images)",
        ],
      },
      // coach addition
      "coach.play": { default: "/art/new-assets-chesscito/btns/play", usedIn: ["Coach — play button", "↳ components/coach/game-actions-bar.tsx", "↳ app/[locale]/coach/[gameId]/coach-game-client.tsx"] },
      // account addition
      "account.account-icon": { default: "/art/screen-mission/account-icon", usedIn: ["Account — account icon", "↳ components/account/account-sheet.tsx"] },
      // shared additions
      "shared.panel-frame": { default: "/art/panel-frame-rune", usedIn: ["Panel frame (rune)", "↳ globals.css .rune-frame / --playhub-rune-frame (CSS-only)"] },
      "shared.time": { default: "/art/redesign/icons/time", usedIn: ["Time icon", "↳ components/account/account-sheet.tsx", "↳ components/arena/arena-board.tsx", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/arena-hud.tsx", "↳ +154 more"] },
      // brand addition
      "brand.favicon": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/brand/favicon/pro" }, default: "/art/favicon-wolf", usedIn: ["Brand — favicon / wolf mark", "↳ app/[locale]/about/page.tsx", "↳ app/[locale]/error.tsx", "↳ app/[locale]/not-found.tsx", "↳ app/[locale]/victory/[id]/error.tsx"] },
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
      "board.piece.white.rook": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/white/rook/pro" },
        default: "/art/redesign/pieces/w-rook",
        usedIn: ["Board — white rook", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/result-overlay.tsx", "↳ components/hub/mastery-tile.tsx", "↳ +3 more"],
      },
      "board.piece.white.bishop": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/white/bishop/pro" },
        default: "/art/redesign/pieces/w-bishop",
        usedIn: ["Board — white bishop", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/diagonal-run-board.tsx", "↳ components/exercises/result-overlay.tsx", "↳ +3 more"],
      },
      "board.piece.white.knight": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/white/knight/pro" },
        default: "/art/redesign/pieces/w-knight",
        usedIn: ["Board — white knight", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/diagonal-run-board.tsx", "↳ components/exercises/knight-tour-board.tsx", "↳ +4 more"],
      },
      "board.piece.white.pawn": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/white/pawn/pro" },
        default: "/art/redesign/pieces/w-pawn",
        usedIn: ["Board — white pawn", "↳ components/arena/arena-end-state.tsx", "↳ components/arena/victory-celebration.tsx", "↳ components/arena/victory-claim-error.tsx", "↳ components/arena/victory-claim-success.tsx", "↳ +7 more"],
      },
      "board.piece.white.queen": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/white/queen/pro" },
        default: "/art/redesign/pieces/w-queen",
        usedIn: ["Board — white queen", "↳ components/board.tsx", "↳ components/exercises/badge-sheet.tsx", "↳ components/exercises/queens-board.tsx", "↳ components/exercises/result-overlay.tsx", "↳ +3 more"],
      },
      "board.piece.white.king": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/white/king/pro" },
        default: "/art/redesign/pieces/w-king",
        usedIn: ["Board — white king", "↳ components/hub/hub-scaffold.tsx"],
      },
      "board.piece.black.rook": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/black/rook/pro" },
        default: "/art/redesign/pieces/b-rook",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.bishop": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/black/bishop/pro" },
        default: "/art/redesign/pieces/b-bishop",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.knight": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/black/knight/pro" },
        default: "/art/redesign/pieces/b-knight",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.pawn": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/black/pawn/pro" },
        default: "/art/redesign/pieces/b-pawn",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ components/arena/arena-select-scaffold.tsx", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.queen": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/black/queen/pro" },
        default: "/art/redesign/pieces/b-queen",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.piece.black.king": { pro: { mode: "asset", path: "/art/theme-builder/candy-forest/board/piece/black/king/pro" },
        default: "/art/redesign/pieces/b-king",
        usedIn: ["Enemies — promotion-run / safe-path", "Kingdom board", "↳ lib/game/arena-utils.ts"],
      },
      "board.blocker.stone": {
        default: "/art/redesign/blocker-stone",
        format: "png",
        usedIn: ["Exercise obstacle — practice blocker", "↳ components/board.tsx", "↳ components/exercises/diagonal-run-board.tsx"],
      },
    },
  },
};

/** Theme served when no per-user setting is present + the only theme
 *  every wallet owns by default. */
export const DEFAULT_THEME_ID = "candy-forest";

const LEARN_SLOT_KEYS: readonly ThemeAssetKey[] = [
  "bg.login-learn",
  "hub.tour-hero",
  "hub.tour-title",
  "hub.21-day-icon",
  "hub.focus-passport-calendar",
  "payments.celebration-bg",
  "payments.offer-bg",
  "brand.ring-start-focus",
  "daily.bg-session",
  "hub.mate-icon",
  "hub.focus-passport-streak",
  "shared.flame-color",
  "shared.flame-blue",
  "shared.flame-gray",
  "season.story-arrow",
  "bg.wallpaper-lite",
  "bg.path-map",
  "bg.path-map-base",
  "exercises.avatar-fun",
  "exercises.avatar-try-again",
  "exercises.badge",
  "exercises.refuge",
  "exercises.plant",
  "exercises.btn-nodo",
  "exercises.labyrinth-icon",
  "exercises.combo",
  "exercises.score",
  "exercises.saved-seal",
  "exercises.wall",
  "exercises.laberinto",
  "exercises.badge-claim",
  "exercises.claim",
  "exercises.save-score",
  "welcome.achievement-1day",
  "welcome.achievement-3day",
  "welcome.achievement-7day",
  "welcome.focus-stamp",
];

const PLAY_SLOT_KEYS: readonly ThemeAssetKey[] = [
  "bg.login-play",
  "hub.arena-warmup",
  "hub.quick-match-benefit",
  "hub.coach-review-benefit",
  "hub.rewards-benefit",
  "hub.pro-benefit-season-pass",
  "hub.pro-benefit-coach",
  "hub.pro-benefit-complete",
  "hub.shop-icon",
  "shop.pro",
  "arena.save",
  "arena.resign",
  "arena.undo",
  "arena.rival-kairo",
  "arena.rival-pipo",
  "arena.rival-mara",
  "arena.rival-frame-blue",
  "arena.rival-frame-gold",
  "arena.rival-frame-silver",
  "arena.avatar-frame-you",
  "arena.avatar-frame-bot",
  "arena.bg-matchup",
  "arena.result-checkmate",
  "arena.result-draw",
  "arena.result-resign",
  "arena.result-stalemate",
  "arena.player-you",
  "arena.player-bot",
  "coach.ask-icon",
  "coach.play-again",
  "coach.play",
  "coach.share-trophy",
];

const SHARED_SLOT_KEYS: readonly ThemeAssetKey[] = [
  "hub.avatar",
  "hub.enter-arena",
  "hub.train-pieces",
  "hub.play-chess",
  "hub.training",
  "hub.training-icon",
  "hub.daily-icon",
  "hub.btn-battle",
  "hub.avatar-lite",
  "hub.pro-chip",
  "shared.avatar-small-account",
  "shared.lock",
  "shared.welcome-gift",
  "shared.feedback-happy",
  "shared.feedback-confident",
  "shared.feedback-scared",
  "shared.feedback-surprised",
  "shared.panel-bg",
  "shared.shield",
  "shared.star",
  "shared.close-candy",
  "shared.mission-adorno",
  "shared.mission-avatar",
  "shared.close",
  "shared.tour-help",
  "shared.mission-panel",
  "shared.trophy-epic",
  "shared.feedback-sad",
  "shared.feedback-thinking",
  "shared.feedback-questioning",
  "brand.title",
  "brand.title-login",
  "exercises.badge-menu",
  "exercises.leaderboard-menu",
  "exercises.leaderboard-crown",
  "exercises.shop-menu",
  "account.language-icon",
  "account.network-icon",
  "account.wallet-icon",
  "account.founder",
  "account.shield",
  "pro-sheet.header-icon",
  "pro-sheet.subscription-panel",
  "pro-sheet.journal",
  "peones.hint",
  "peones.piece",
  "tactics.daily-exercise",
  "hud.crown",
  "hud.trophy",
  "bg.splash-chesscito",
  "bg.dock-4slots",
  "bg.menu-wall",
  "bg.splash-loading",
  "shop.slot-frame",
  "hub.invite-icon",
  "exercises.wallpaper",
  "account.account-icon",
  "shared.panel-frame",
  "shared.time",
  "brand.favicon",
  "board.frame",
  "board.thumbnail",
  "board.legacy-bg",
  "board.tile.light",
  "board.tile.dark",
  "board.piece.white.rook",
  "board.piece.white.bishop",
  "board.piece.white.knight",
  "board.piece.white.pawn",
  "board.piece.white.queen",
  "board.piece.white.king",
  "board.piece.black.rook",
  "board.piece.black.bishop",
  "board.piece.black.knight",
  "board.piece.black.pawn",
  "board.piece.black.queen",
  "board.piece.black.king",
  "board.blocker.stone",
];

const FULL_LEGACY_SLOT_KEYS: readonly ThemeAssetKey[] = [
  "hub.portal",
  "hub.btn-play",
  "hub.guide",
  "hub.bg",
  "hub.btn-stone-bg",
  "hub.mastery.piece.rook",
  "hub.mastery.piece.bishop",
  "hub.mastery.piece.knight",
  "hub.mastery.piece.pawn",
  "hub.mastery.piece.queen",
  "hub.mastery.piece.king",
  "scene.gem-pill",
  "scene.panel-pro",
  "scene.pedestal",
  "scene.stone-1",
  "scene.stone-2",
  "scene.stone-3",
  "scene.stone-4",
  "scene.stone-5",
  "scene.stone-6",
  "scene.stone-7",
  "scene.stone-8",
  "scene.stone-9",
  "scene.stone-10",
  "scene.chest-large",
  "scene.chest-small",
  "scene.banner-large",
  "scene.banner-medium",
  "scene.banner-short",
];

/** No active runtime consumer could establish a current surface. These stay
 * visible for review and must not be treated as candidates for automatic asset
 * replacement. */
export const UNKNOWN_THEME_SLOT_KEYS = [
  "hub.principal-button",
  "pro-mission.sms",
  "shop.coach-pack-20",
  "hub.cta-principal",
] as const satisfies readonly ThemeAssetKey[];

/** Rendered by `apps/landing`, never by the game app. These read as
 * consumer-less from inside `apps/web` — the consumer lives in the sibling
 * app — so they get their own surface instead of falling to `unknown`. */
export const LANDING_SLOT_KEYS = [
  "landing.pre-chess",
  "landing.hero",
  "landing.progress-trophies",
  // Onboarding carousel, 2026-07-29 redesign: one illustration per slide plus
  // per-locale title art (slide 1 shares one file — the wordmark is the same
  // picture in EN and ES).
  "landing.slide1-bg",
  "landing.slide2-bg",
  "landing.slide3-bg",
  "landing.slide4-bg",
  "landing.slide1-title",
  "landing.slide2-title-en",
  "landing.slide2-title-es",
  "landing.slide3-title-en",
  "landing.slide3-title-es",
  "landing.slide4-title-en",
  "landing.slide4-title-es",
  // Superseded by the above but still on disk.
  "landing.slides-frame",
  "landing.slides-scene-desktop",
  "landing.slide1-avatar",
  "landing.slide2-avatar",
  "landing.slide2-title",
  "landing.slide3-avatar",
  "landing.slide3-title",
  "landing.slide4-avatar",
  "landing.season-pass-icon",
  "landing.pro-icon",
  "landing.slide-web-1",
  "landing.slide-web-2",
  "landing.slide-web-3",
  "landing.slide-web-4",
  // Brand/social files owned by apps/landing. Their consumer is that app's
  // layout metadata, which is invisible from inside apps/web.
  "landing.og-image",
  "brand.apple-icon",
  "brand.favicon-ico",
] as const satisfies readonly ThemeAssetKey[];

const SLOT_KEYS_BY_SURFACE = {
  learn: LEARN_SLOT_KEYS,
  play: PLAY_SLOT_KEYS,
  landing: LANDING_SLOT_KEYS,
  shared: SHARED_SLOT_KEYS,
  "full-legacy": FULL_LEGACY_SLOT_KEYS,
  "dev-only": [],
  unknown: UNKNOWN_THEME_SLOT_KEYS,
} as const satisfies Record<ThemeSlotSurface, readonly ThemeAssetKey[]>;

/** Exhaustive runtime-surface classification for the registry (159 web-owned
 * slots + 18 landing-owned ones).
 * Every current category is explicit and duplicate membership
 * throws during module initialization. A future unclassified slot defaults to
 * `unknown`, never `shared`, until consumer and route evidence is audited. */
function buildThemeSlotSurfaces(): Record<ThemeAssetKey, ThemeSlotSurface> {
  const classifications: Partial<Record<ThemeAssetKey, ThemeSlotSurface>> = {};
  for (const [surface, keys] of Object.entries(SLOT_KEYS_BY_SURFACE) as Array<
    [ThemeSlotSurface, readonly ThemeAssetKey[]]
  >) {
    for (const key of keys) {
      if (classifications[key]) {
        throw new Error(`Theme slot ${key} has multiple surface classifications`);
      }
      classifications[key] = surface;
    }
  }
  for (const key of Object.keys(
    THEMES[DEFAULT_THEME_ID].assets,
  ) as ThemeAssetKey[]) {
    classifications[key] ??= "unknown";
  }
  return Object.freeze(classifications) as Record<
    ThemeAssetKey,
    ThemeSlotSurface
  >;
}

export const THEME_SLOT_SURFACES = buildThemeSlotSurfaces();
