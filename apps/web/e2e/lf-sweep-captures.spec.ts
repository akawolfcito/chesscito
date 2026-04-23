import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Ad-hoc captures for the 2026-04-23 look-and-feel audit (#103).
 * Not part of the regular suite — generates PNGs in e2e-results/lf-sweep/
 * so we can decide which dark surfaces need migration.
 */
const OUT_DIR = path.join(process.cwd(), "e2e-results", "lf-sweep");

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.describe("Look-and-feel sweep captures", () => {
  test("arena playing state (mid-game)", async ({ page }) => {
    // Seed a FEN mid-game + persistence so arena drops us into playing.
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
      window.localStorage.setItem("chesscito:arena-last-difficulty", "easy");
      window.localStorage.setItem(
        "chesscito:arena-game",
        JSON.stringify({
          fen: "rnbqkbnr/pp2pppp/3p4/8/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 0 3",
          moveHistory: ["e4", "d6", "d4", "Nf6", "Nc3"],
          moveCount: 5,
          elapsedMs: 45000,
          difficulty: "easy",
          playerColor: "w",
          savedAt: Date.now(),
        }),
      );
    });
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT_DIR, "arena-playing.png"), fullPage: false });
  });

  test("victory page (/victory/1)", async ({ page }) => {
    await page.goto("/victory/1");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT_DIR, "victory-page.png"), fullPage: false });
  });

  test("splash overlay on first visit", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto("/");
    // Capture while the splash still shows (before assets finish loading).
    // Playwright's default is to wait for load; screenshot immediately.
    await page.screenshot({ path: path.join(OUT_DIR, "splash.png"), fullPage: false });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT_DIR, "after-splash-briefing.png"), fullPage: false });
  });

  test("piece picker sheet open", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Open piece picker — tap the piece chip in the header.
    const pieceChip = page.getByRole("button", { name: /switch piece/i });
    await pieceChip.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, "sheet-piece-picker.png"), fullPage: false });
  });

  test("badge sheet (mobile 390px — where bg edge matters)", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Open badge sheet — click the badges dock item.
    await page.getByRole("button", { name: /badges/i }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "sheet-badges-mobile.png"), fullPage: false });
  });

  test("leaderboard sheet (mobile 390px)", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /leaderboard/i }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "sheet-leaderboard-mobile.png"), fullPage: false });
  });

  test("shop sheet (mobile 390px)", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^shop$/i }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "sheet-shop-mobile.png"), fullPage: false });
  });

  test("promotion overlay (near promotion position)", async ({ page }) => {
    // Promotion requires a pawn on the 7th rank with a clear path. Seed a
    // FEN where white pawn is on a7 and it's white's turn.
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
      window.localStorage.setItem(
        "chesscito:arena-game",
        JSON.stringify({
          fen: "8/P7/8/8/8/8/8/4K2k w - - 0 1",
          moveHistory: [],
          moveCount: 0,
          elapsedMs: 0,
          difficulty: "easy",
          playerColor: "w",
          savedAt: Date.now(),
        }),
      );
    });
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");
    // Click a7 (pawn) then a8 (promote)
    const a7 = page.getByRole("gridcell", { name: "Square a7" });
    if (await a7.count()) {
      await a7.click();
      await page.waitForTimeout(300);
      const a8 = page.getByRole("gridcell", { name: "Square a8" });
      if (await a8.count()) await a8.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: path.join(OUT_DIR, "promotion-overlay.png"), fullPage: false });
  });
});
