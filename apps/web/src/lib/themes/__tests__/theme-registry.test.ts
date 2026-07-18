import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME_ID,
  THEMES,
  type ThemeAssetKey,
} from "../theme-registry";

const REQUIRED_ASSET_KEYS: readonly ThemeAssetKey[] = [
  "hub.portal",
  "hub.avatar",
  "hub.enter-arena",
  "hub.train-pieces",
  "hub.play-chess",
  "hub.training",
  "hub.training-icon",
  "hub.daily-icon",
  "hub.shop-icon",
  "hub.btn-battle",
  "hub.btn-play",
  "hub.principal-button",
  "hub.tour-hero",
  "hub.tour-title",
  "hub.guide",
  "hub.21-day-icon",
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
        // A slot must carry at least one asset (default, pro, or both — a
        // PRO-only slot has no default). Any present path is /art-rooted.
        expect(
          Boolean(entry.default) || Boolean(entry.pro),
          `theme=${id} key=${key} has no asset`,
        ).toBe(true);
        if (entry.default) {
          expect(entry.default, `theme=${id} key=${key}.default`).toMatch(/^\//);
        }
        if (entry.pro) {
          expect(entry.pro, `theme=${id} key=${key}.pro`).toMatch(/^\//);
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
});
