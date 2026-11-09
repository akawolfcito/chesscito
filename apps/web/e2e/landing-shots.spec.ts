import { test, expect } from "@playwright/test";
import path from "node:path";

/**
 * Landing screenshots generator — captures the three marketing-quality
 * visuals consumed by /why. Skipped by default; opt in with:
 *
 *   LANDING_SHOTS=true pnpm exec playwright test e2e/landing-shots.spec.ts \
 *     --project=minipay
 *
 * After running, regenerate AVIF/WebP variants with the inline sharp
 * snippet documented in the /why landing spec.
 *
 * Each shot seeds localStorage with rich state so the screenshot reads
 * as "engaged player" rather than the bare default empty state.
 */

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "art", "landing");

const RICH_PROGRESS = {
  rook:    { piece: "rook",   exerciseIndex: 2, stars: [3, 3, 2, 0, 0] }, // 8/15 — mid-journey
  bishop:  { piece: "bishop", exerciseIndex: 1, stars: [3, 1, 0, 0, 0] }, // 4/15
  knight:  { piece: "knight", exerciseIndex: 0, stars: [0, 0, 0, 0, 0] },
  pawn:    { piece: "pawn",   exerciseIndex: 0, stars: [0, 0, 0, 0, 0] },
};

const RICH_PROGRESS_CLAIMABLE = {
  rook:    { piece: "rook",   exerciseIndex: 0, stars: [3, 3, 3, 3, 3] }, // 15/15 — claimable
  bishop:  { piece: "bishop", exerciseIndex: 2, stars: [3, 2, 1, 0, 0] }, // 6/15 — in progress
  knight:  { piece: "knight", exerciseIndex: 0, stars: [0, 0, 0, 0, 0] },
  pawn:    { piece: "pawn",   exerciseIndex: 0, stars: [0, 0, 0, 0, 0] },
};

async function seedProgress(
  page: import("@playwright/test").Page,
  state: Record<string, unknown>,
) {
  // Set localStorage BEFORE the app mounts. Navigate to a blank page
  // first so the storage write lands on the same origin.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate((entries) => {
    for (const [piece, value] of Object.entries(entries)) {
      localStorage.setItem(`chesscito:progress:${piece}`, JSON.stringify(value));
    }
    // Clear the splash-shown flag so onboarding doesn't repeat.
    localStorage.setItem("chesscito:onboarded", "true");
  }, state);
}

test.describe("Landing shots — marketing assets", () => {
  test.skip(
    !process.env.LANDING_SHOTS,
    "Run with LANDING_SHOTS=true",
  );

  test.describe.configure({ mode: "serial" });

  /**
   * Selects the rook so the board paints valid-move dots. With
   * RICH_PROGRESS at exerciseIndex 2 the rook starts at d4. Targeting
   * the cell by its accessible label is more robust than DOM order.
   */
  async function selectRook(page: import("@playwright/test").Page) {
    const rookCell = page.getByRole("gridcell", { name: "Square d4" });
    await rookCell.click({ timeout: 5_000 });
    // Let the highlight transition + dots settle.
    await page.waitForTimeout(700);
  }

  test("hero — play hub with mid-journey progress + selected rook", async ({ page }) => {
    await seedProgress(page, RICH_PROGRESS);
    // Reload so the seeded state takes effect.
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator(".playhub-board-canvas")).toBeVisible({ timeout: 15_000 });
    // Wait for splash to disappear.
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });
    await selectRook(page);

    await page.screenshot({
      path: path.join(OUT_DIR, "hero-play-hub.png"),
      fullPage: false,
    });
  });

  test("pre-chess — board crop with valid-move dots", async ({ page }) => {
    await seedProgress(page, RICH_PROGRESS);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator(".playhub-board-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });
    await selectRook(page);

    // Crop tightly around the board area for a "zoom on gameplay" shot.
    const boardLocator = page.locator(".playhub-board-canvas");
    const box = await boardLocator.boundingBox();
    if (!box) throw new Error("playhub-board-canvas missing bounding box");
    // Add slight padding around the crop so the candy frame breathes.
    const PAD = 8;
    await page.screenshot({
      path: path.join(OUT_DIR, "pre-chess-exercise.png"),
      clip: {
        x: Math.max(0, box.x - PAD),
        y: Math.max(0, box.y - PAD),
        width: box.width + PAD * 2,
        height: box.height + PAD * 2,
      },
    });
  });

  test("progress — badges sheet with claimable + in-progress", async ({ page }) => {
    await seedProgress(page, RICH_PROGRESS_CLAIMABLE);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });

    // Open the Badges sheet from the persistent dock.
    const badgesTrigger = page.getByRole("button", { name: "Badges" }).first();
    await badgesTrigger.click({ timeout: 5_000 });

    // Wait for Radix sheet to fully animate in.
    const sheet = page.locator('[role="dialog"][data-state="open"]').first();
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(700);

    await page.screenshot({
      path: path.join(OUT_DIR, "progress-trophies.png"),
      fullPage: false,
    });
  });
});
