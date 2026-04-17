import { test, expect, type Page } from "@playwright/test";

/**
 * Redesign validation — captures in-game states that the existing
 * visual-snapshot spec does not reach. Screenshots land under
 * e2e-results/redesign/ and are consumed by the ux-review agent.
 */

const OUT = "e2e-results/redesign";

// Reduce animation flakiness
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
});

async function dismissSplash(page: Page) {
  await page.goto("/", { waitUntil: "load", timeout: 30_000 });
  await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });
}

async function dismissMissionBriefing(page: Page) {
  // The briefing dialog shows a PLAY button on first visit; if already onboarded
  // it does not appear. Try briefly, skip if absent.
  const playBtn = page.getByRole("button", { name: /^play$/i }).first();
  try {
    await playBtn.waitFor({ state: "visible", timeout: 3_000 });
    await playBtn.click();
  } catch {
    // Already onboarded — briefing skipped
  }
}

test("play-hub: board with rook exercise active", async ({ page }) => {
  await dismissSplash(page);
  await dismissMissionBriefing(page);

  // Board hitgrid must be interactive
  await expect(page.locator(".playhub-board-hitgrid")).toBeVisible({ timeout: 5_000 });
  // Piece should be on the board
  await expect(page.locator(".playhub-board-piece-float img")).toBeVisible();
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${OUT}/play-hub-board-active.png`, fullPage: true });
});

test("play-hub: piece selected shows move highlights", async ({ page }) => {
  await dismissSplash(page);
  await dismissMissionBriefing(page);

  await expect(page.locator(".playhub-board-hitgrid")).toBeVisible({ timeout: 5_000 });

  // Tap the piece cell — use the floating piece's underlying cell via aria-label.
  // Rook in exercise 0 starts at a1. Click + give React time to commit the
  // validTargets recomputation; don't assert highlight visibility — the agent
  // reads the screenshot and judges state.
  const cell = page.getByRole("gridcell", { name: /square a1/i }).first();
  await cell.click({ force: true });
  await page.waitForTimeout(800);

  await page.screenshot({ path: `${OUT}/play-hub-piece-selected.png`, fullPage: true });
});

test("arena: in-game board after Easy selected", async ({ page }) => {
  await page.goto("/arena", { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(500);

  // Tap Easy card
  const easyCard = page.getByRole("button", { name: /^easy/i }).first();
  await easyCard.click({ force: true });

  // Tap Enter Arena
  const enter = page.getByRole("button", { name: /enter arena/i }).first();
  await enter.click({ force: true });

  // Board renders with pieces
  await expect(page.locator(".playhub-board-hitgrid")).toBeVisible({ timeout: 8_000 });
  await expect(page.locator(".arena-piece-float").first()).toBeVisible();
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${OUT}/arena-board-easy.png`, fullPage: true });
});
