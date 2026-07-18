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
  /** Basename without extension — consumer composes the AVIF/WebP/PNG
   *  triplet at render time. Optional: when ABSENT the slot is a PRO-only
   *  overlay/decoration (e.g. the gold avatar frame) — free users see
   *  nothing, PRO users get `pro`. Every entry must have `default` or `pro`. */
  default?: string;
  /** PRO-tier value. For a normal slot it's an override of `default`;
   *  for a PRO-only slot (no `default`) it's the whole asset. When absent,
   *  useThemeAsset falls back to `default` for PRO viewers. */
  pro?: string;
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
      // default = free lite avatar; pro = the PRO-skinned avatar. hub-lite-scaffold
      // swaps by isPro — this is a variant pair, not two separate slots.
      "hub.avatar-lite": {
        default: "/art/avatar-lite-hub",
        pro: "/art/avatar-pro",
        usedIn: ["Hub — lite avatar (isPro swaps to PRO skin)"],
      },
      // The PRO status badge. hub-pro-badge swaps by `active`: the purple
      // upsell chip for free users (default) → the all-gold chip for PRO (pro).
      "hub.pro-chip": {
        default: "/art/hub/pro-chip-inactive",
        pro: "/art/hub/pro-chip-active",
        usedIn: ["Hub — PRO status badge"],
      },
      // DEPRECATED: mastery-tile.tsx still renders the old /art/pieces set; it
      // should point at /art/redesign/pieces (see the tech-debt audit). Kept in
      // the catalog so it's visible + updatable until the reference is migrated.
      "hub.mastery.piece.rook": {
        default: "/art/pieces/w-rook",
        usedIn: ["Hub — mastery tile (rook)"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.bishop": {
        default: "/art/pieces/w-bishop",
        usedIn: ["Hub — mastery tile (bishop)"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.knight": {
        default: "/art/pieces/w-knight",
        usedIn: ["Hub — mastery tile (knight)"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.pawn": {
        default: "/art/pieces/w-pawn",
        usedIn: ["Hub — mastery tile (pawn)"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.queen": {
        default: "/art/pieces/w-queen",
        usedIn: ["Hub — mastery tile (queen)"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
      },
      "hub.mastery.piece.king": {
        default: "/art/pieces/w-king",
        usedIn: ["Hub — mastery tile (king)"],
        deprecated: "old piece set — mastery-tile should use /art/redesign/pieces",
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
      // feedback — reaction avatars (folded into shared per founder); each used
      // across exercises result + arena victory states.
      "shared.feedback-happy": {
        default: "/art/new-assets-chesscito/fun/avatar-feliz",
        usedIn: ["Exercises result", "Arena victory / claim-success"],
      },
      "shared.feedback-confident": {
        default: "/art/new-assets-chesscito/fun/avatar-confiado",
        usedIn: ["Arena — claiming"],
      },
      "shared.feedback-scared": {
        default: "/art/new-assets-chesscito/fun/avatar-asustado",
        usedIn: ["Arena — claim error"],
      },
      "shared.feedback-surprised": {
        default: "/art/new-assets-chesscito/fun/avatar-asombrado",
        usedIn: ["Exercises / payments"],
      },
      "shared.panel-bg": {
        default: "/art/new-assets-chesscito/paneles/panel-bg1",
        usedIn: ["Payments", "Victory", "Arena", "Exercises"],
      },
      "shared.shield": {
        default: "/art/redesign/icons/shield",
        usedIn: ["Arena", "Exercises"],
      },
      "shared.star": {
        default: "/art/redesign/icons/star",
        usedIn: ["Board target marker", "Exercises", "Daily"],
      },
      "shared.mission-adorno": {
        default: "/art/screen-mission/adorno-icon",
        usedIn: ["Arena", "Exercises"],
      },
      "shared.mission-avatar": {
        default: "/art/screen-mission/avatar-icon",
        usedIn: ["Arena", "Exercises"],
      },
      "shared.close": {
        default: "/art/screen-mission/close-icon",
        usedIn: ["Arena", "Exercises", "Daily", "Peones", "UI"],
      },
      "shared.mission-panel": {
        default: "/art/screen-mission/panel-mision-icon",
        usedIn: ["Arena", "Exercises"],
      },
      "shared.trophy-epic": {
        default: "/art/action-row/trofeo-epico",
        usedIn: ["Coach", "Trophies"],
      },
      "brand.title": {
        default: "/art/title-chesscito",
        usedIn: ["Brand — Chesscito wordmark"],
      },
      "brand.ring-start-focus": {
        default: "/art/ring-start-focus",
        usedIn: ["Hub — start-focus ring", "Root"],
      },
      "exercises.avatar-fun": {
        default: "/art/avatar-fun",
        usedIn: ["Exercises — success avatar (mission panel)"],
      },
      "exercises.avatar-try-again": {
        default: "/art/avatar-try-again",
        usedIn: ["Exercises — try-again avatar"],
      },
      "exercises.badge": {
        default: "/art/badge-chesscito",
        usedIn: ["Exercises — badge"],
      },
      "exercises.badge-menu": {
        default: "/art/badge-menu",
        usedIn: ["Exercises — badge menu icon"],
      },
      "exercises.refuge": {
        default: "/art/labyrinths/refuge",
        usedIn: ["Exercises — safe-path refuge"],
      },
      "exercises.leaderboard-menu": {
        default: "/art/leaderboard-menu",
        usedIn: ["Exercises — leaderboard menu icon"],
      },
      "exercises.leaderboard-crown": {
        default: "/art/screen-mission/corona-pro",
        usedIn: ["Exercises — leaderboard decorative crown"],
      },
      "exercises.plant": {
        default: "/art/new-assets-chesscito/plant1",
        usedIn: ["Exercises — decorative plant"],
      },
      "exercises.btn-nodo": {
        default: "/art/redesign/bg/btn-nodo",
        usedIn: ["Exercises — node button"],
      },
      "exercises.labyrinth-icon": {
        default: "/art/redesign/bg/labyrint-icon",
        usedIn: ["Exercises — labyrinth icon"],
      },
      "exercises.combo": {
        default: "/art/redesign/icons/combo",
        usedIn: ["Exercises — combo icon"],
      },
      "exercises.score": {
        default: "/art/score-chesscito",
        usedIn: ["Exercises — score"],
      },
      "exercises.shop-menu": {
        default: "/art/shop-menu",
        usedIn: ["Exercises — shop menu icon"],
      },
      "exercises.saved-seal": {
        default: "/art/new-icons-chesscito/score-saved",
        usedIn: ["Exercises — score-saved seal"],
      },
      "arena.save": {
        default: "/art/new-icons-chesscito/save",
        usedIn: ["Arena — save icon"],
      },
      "arena.resign": {
        default: "/art/new-assets-chesscito/arena/resign-game",
        usedIn: ["Arena — resign action"],
      },
      "arena.undo": {
        default: "/art/new-assets-chesscito/arena/undo-move",
        usedIn: ["Arena — undo action"],
      },
      "arena.rival-kairo": {
        default: "/art/rivals/kairo-avatar",
        usedIn: ["Arena — rival Kairo avatar"],
      },
      "arena.rival-pipo": {
        default: "/art/rivals/pipo-avatar",
        usedIn: ["Arena — rival Pipo avatar"],
      },
      "arena.rival-frame-blue": {
        default: "/art/rivals/frame-blue",
        usedIn: ["Arena — rival frame (blue)"],
      },
      "arena.rival-frame-gold": {
        default: "/art/rivals/frame-gold",
        usedIn: ["Arena — rival frame (gold)"],
      },
      "arena.rival-frame-silver": {
        default: "/art/rivals/frame-silver",
        usedIn: ["Arena — rival frame (silver)"],
      },
      // PRO-only avatar frames (player-avatar.tsx renders `pro && <frame>`).
      // No default → free users see no frame; PRO users get the gold ornament.
      "arena.avatar-frame-you": {
        pro: "/art/chesscito-pro/borde-dorado-avatar-azul",
        usedIn: ["Arena — 'you' player card (PRO gold frame)"],
      },
      "arena.avatar-frame-bot": {
        pro: "/art/chesscito-pro/borde-dorado-avatar-rojo",
        usedIn: ["Arena — 'bot' player card (PRO gold frame)"],
      },
      "coach.ask-icon": {
        default: "/art/new-assets-chesscito/btns/ask-coach-icon",
        usedIn: ["Coach — ask button icon"],
      },
      "coach.play-again": {
        default: "/art/new-assets-chesscito/btns/play-again-icon",
        usedIn: ["Coach — play again icon"],
      },
      "account.language-icon": {
        default: "/art/new-assets-chesscito/account/language-icon",
        usedIn: ["Account — language row"],
      },
      "account.network-icon": {
        default: "/art/new-assets-chesscito/account/network-icon",
        usedIn: ["Account — network row"],
      },
      "account.wallet-icon": {
        default: "/art/new-assets-chesscito/account/wallet-icon",
        usedIn: ["Account — wallet row"],
      },
      "account.founder": {
        default: "/art/shop/founder",
        usedIn: ["Account — founder badge"],
      },
      "account.shield": {
        default: "/art/shop/shield",
        usedIn: ["Account — shield"],
      },
      // pro-sheet content (pro-sheet.tsx renders these unconditionally — the
      // subscription surface's own art, not a per-user PRO variant).
      "pro-sheet.header-icon": {
        default: "/art/chesscito-pro/chesscito-header-pro-icon",
        usedIn: ["PRO sheet — header icon"],
      },
      "pro-sheet.subscription-panel": {
        default: "/art/chesscito-pro/panel-suscription-pro",
        usedIn: ["PRO sheet — subscription panel background"],
      },
      "pro-sheet.journal": {
        default: "/art/chesscito-pro/journal-chesscito-pro",
        usedIn: ["PRO sheet — journal illustration"],
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
