import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME_ID,
  THEME_SLOT_SURFACES,
  THEMES,
  UNKNOWN_THEME_SLOT_KEYS,
  type ThemeAssetKey,
} from "../theme-registry";
import { resolveAssetVariant } from "../asset-variant";

const REQUIRED_ASSET_KEYS: readonly ThemeAssetKey[] = [
  "hub.portal",
  "hub.avatar",
  "hub.enter-arena",
  "hub.train-pieces",
  "hub.play-chess",
  "hub.training",
  "hub.training-icon",
  "hub.daily-icon",
  "hub.arena-warmup",
  "hub.quick-match-benefit",
  "hub.coach-review-benefit",
  "hub.rewards-benefit",
  "hub.shop-icon",
  "hub.btn-battle",
  "hub.btn-play",
  "hub.principal-button",
  "hub.tour-hero",
  "hub.tour-title",
  "hub.guide",
  "hub.21-day-icon",
  "hub.focus-passport-calendar",
  "hub.avatar-lite",
  "hub.pro-chip",
  "hub.mastery.piece.rook",
  "hub.mastery.piece.bishop",
  "hub.mastery.piece.knight",
  "hub.mastery.piece.pawn",
  "hub.mastery.piece.queen",
  "hub.mastery.piece.king",
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
  "shared.mission-adorno",
  "shared.mission-avatar",
  "shared.close",
  "shared.mission-panel",
  "shared.feedback-sad",
  "shared.feedback-thinking",
  "shared.feedback-questioning",
  "payments.celebration-bg",
  "brand.title",
  "brand.ring-start-focus",
  "board.legacy-bg",
  "exercises.avatar-fun",
  "exercises.avatar-try-again",
  "exercises.badge",
  "exercises.badge-menu",
  "exercises.refuge",
  "exercises.leaderboard-menu",
  "exercises.leaderboard-crown",
  "exercises.plant",
  "exercises.btn-nodo",
  "exercises.labyrinth-icon",
  "exercises.combo",
  "exercises.score",
  "exercises.shop-menu",
  "exercises.saved-seal",
  "arena.save",
  "arena.resign",
  "arena.undo",
  "arena.rival-kairo",
  "arena.rival-pipo",
  "arena.rival-frame-blue",
  "arena.rival-frame-gold",
  "arena.rival-frame-silver",
  "arena.avatar-frame-you",
  "arena.avatar-frame-bot",
  "coach.ask-icon",
  "coach.play-again",
  "account.language-icon",
  "account.network-icon",
  "account.wallet-icon",
  "account.founder",
  "account.shield",
  "pro-sheet.header-icon",
  "pro-sheet.subscription-panel",
  "pro-sheet.journal",
  "daily.bg-session",
  "daily.welldone",
  "peones.hint",
  "peones.piece",
  "welcome.achievement-1day",
  "landing.pre-chess",
  "tactics.daily-exercise",
  "hud.crown",
  "hud.trophy",
  "pro-mission.sms",
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
  "bg.splash-chesscito",
  "bg.wallpaper-lite",
  "bg.dock-4slots",
  "bg.menu-wall",
  "bg.path-map",
  "bg.path-map-base",
  "bg.splash-loading",
  "shop.coach-pack-20",
  "shop.slot-frame",
  "arena.bg-matchup",
  "arena.result-checkmate",
  "arena.result-draw",
  "arena.result-resign",
  "arena.result-stalemate",
  "arena.player-you",
  "arena.player-bot",
  "hub.cta-principal",
  "hub.mate-icon",
  "hub.invite-icon",
  "hub.bg",
  "hub.btn-stone-bg",
  "hub.focus-passport-streak",
  "exercises.wall",
  "exercises.laberinto",
  "exercises.badge-claim",
  "exercises.claim",
  "exercises.save-score",
  "exercises.wallpaper",
  "welcome.achievement-3day",
  "welcome.achievement-7day",
  "welcome.focus-stamp",
  "landing.hero",
  "landing.progress-trophies",
  "coach.play",
  "account.account-icon",
  "shared.panel-frame",
  "shared.time",
  "brand.favicon",
  "shared.trophy-epic",
  "board.frame",
  "board.thumbnail",
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
];

describe("theme-registry", () => {
  it("publishes candy-forest as the default theme id", () => {
    expect(DEFAULT_THEME_ID).toBe("candy-forest");
  });

  it("registers candy-forest with the documented metadata", () => {
    const theme = THEMES["candy-forest"];
    expect(theme).toBeDefined();
    expect(theme.id).toBe("candy-forest");
    expect(theme.name).toBe("Candy Forest");
  });

  it("every registered theme provides every required asset key", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      for (const key of REQUIRED_ASSET_KEYS) {
        const entry = theme.assets[key];
        expect(entry, `theme=${id} key=${key}`).toBeDefined();
        const defaultVariant = resolveAssetVariant(entry, "default");
        const proVariant = resolveAssetVariant(entry, "pro");
        expect(defaultVariant.mode).not.toBe("inherit");
        if (defaultVariant.mode === "asset") {
          expect(defaultVariant.path, `theme=${id} key=${key}.default`).toMatch(/^\/art\//);
        }
        if (proVariant.mode === "asset") {
          expect(proVariant.path, `theme=${id} key=${key}.pro`).toMatch(/^\/art\//);
        }
      }
    }
  });

  it("candy-forest exposes both default + pro variants for hub.portal", () => {
    const entry = THEMES["candy-forest"].assets["hub.portal"];
    expect(entry.default).toBe("/art/hub/portal-chesscito-normal");
    expect(entry.pro).toBe("/art/hub/portal-chesscito-pro");
  });

  it("candy-forest exposes both default + pro variants for hub.avatar", () => {
    const entry = THEMES["candy-forest"].assets["hub.avatar"];
    expect(entry.default).toBe("/art/scene-rooted/avatar-chesscito");
    expect(entry.pro).toBe("/art/hub/chesscito-avatar-new-light");
  });

  it("models the lite avatar as a default/pro variant pair (not two slots)", () => {
    const entry = THEMES["candy-forest"].assets["hub.avatar-lite"];
    expect(entry.default).toBe("/art/avatar-lite-hub");
    expect(entry.pro).toBe("/art/avatar-pro");
  });

  it("models the PRO chip as default=inactive / pro=active", () => {
    const entry = THEMES["candy-forest"].assets["hub.pro-chip"];
    expect(entry.default).toBe("/art/hub/pro-chip-inactive");
    expect(entry.pro).toBe("/art/hub/pro-chip-active");
  });

  it("models a PRO-only overlay as pro with no default", () => {
    const frame = THEMES["candy-forest"].assets["arena.avatar-frame-you"];
    expect(frame.default).toBeUndefined();
    expect(frame.pro).toBe("/art/chesscito-pro/borde-dorado-avatar-azul");
  });

  it("marks stale references as deprecated with a reason", () => {
    const mastery = THEMES["candy-forest"].assets["hub.mastery.piece.rook"];
    expect(mastery.deprecated).toMatch(/redesign\/pieces/);
    const legacyBg = THEMES["candy-forest"].assets["board.legacy-bg"];
    expect(legacyBg.deprecated).toBeTruthy();
  });

  it("the default theme id resolves to a registered theme", () => {
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });

  it("classifies every slot from runtime-consumer evidence", () => {
    const registered = Object.keys(THEMES[DEFAULT_THEME_ID].assets).sort();
    expect(Object.keys(THEME_SLOT_SURFACES).sort()).toEqual(registered);

    const counts = Object.values(THEME_SLOT_SURFACES).reduce<
      Record<(typeof THEME_SLOT_SURFACES)[ThemeAssetKey], number>
    >(
      (totals, surface) => ({
        ...totals,
        [surface]: totals[surface] + 1,
      }),
      {
        learn: 0,
        play: 0,
        landing: 0,
        shared: 0,
        "full-legacy": 0,
        "dev-only": 0,
        unknown: 0,
      },
    );
    expect(counts).toEqual({
      // +3 over 31: the Focus Passport flames, cataloged 2026-07-22. They are
      // LEARN surfaces (passport, challenge card, Season Pass offer).
      // +1: payments.offer-bg, the Season Pass offer sheet's dedicated bg
      // (panel-bg2), split off shared.panel-bg so it stays panel-bg1 elsewhere.
      // +1: bg.login-learn, the Learn web access gate wallpaper (2026-07-25).
      // +1: hub.focus-passport-calendar, independently editable from the
      // Shield and Training assets reused by the Challenge Card.
      learn: 38,
      // +2 over the original 21: arena.rival-mara and shop.pro, both
      // formerly uncataloged "exceptions". +1: coach.share-trophy, the
      // dedicated Match Review share icon (2026-07-22), split off shared.trophy-epic.
      // +1: bg.login-play, the Play web access gate wallpaper (2026-07-25).
      // +4: Arena Warm-up and the three KingdomCard benefits are independently
      // editable PLAY slots, even when their defaults reuse established art.
      play: 29,
      // 3 reclassified off `unknown` (they always had a consumer — in the
      // sibling app) + 15 newly cataloged carousel slots + 3 brand/social
      // files the landing layout declares as metadata (OG card, apple-icon,
      // favicon.ico), whose consumer is likewise invisible from apps/web.
      landing: 21,
      // +1: shared.close-candy, the CandyIcon close art.
      // +1: board.blocker.stone, the exercise obstacle art (2026-07-23),
      // classified with the board.piece.* slots.
      // +1: brand.title-login, the Privy login modal's wordmark (2026-07-25),
      // carved off brand.title. Shared, not per-surface: the modal is the same
      // on both deploys, only its wallpaper differs.
      shared: 77,
      "full-legacy": 29,
      "dev-only": 0,
      unknown: 4,
    });
  });

  it("pins current Hub evidence instead of inferring surface from hub.*", () => {
    expect(THEME_SLOT_SURFACES["hub.avatar-lite"]).toBe("shared");
    expect(THEME_SLOT_SURFACES["hub.portal"]).toBe("full-legacy");
    expect(THEME_SLOT_SURFACES["hub.guide"]).toBe("full-legacy");
    expect(THEME_SLOT_SURFACES["hub.21-day-icon"]).toBe("learn");
    expect(THEME_SLOT_SURFACES["hub.focus-passport-calendar"]).toBe("learn");
    expect(THEME_SLOT_SURFACES["hub.shop-icon"]).toBe("play");
    expect(UNKNOWN_THEME_SLOT_KEYS).toEqual([
      "hub.principal-button",
      "pro-mission.sms",
      "shop.coach-pack-20",
      "hub.cta-principal",
    ]);
    expect(THEME_SLOT_SURFACES["board.legacy-bg"]).toBe("shared");
  });
});
