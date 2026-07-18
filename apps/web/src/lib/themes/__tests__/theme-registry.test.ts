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
  "shared.avatar-small-account",
  "shared.lock",
  "shared.welcome-gift",
  "brand.title",
  "brand.ring-start-focus",
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
        expect(entry.default, `theme=${id} key=${key}.default`).toMatch(/^\//);
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

  it("the default theme id resolves to a registered theme", () => {
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });
});
