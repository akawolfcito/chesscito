// Playwright script to capture high-quality MiniPay submission screenshots
// Usage: node scripts/screenshots.mjs

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// MiniPay-like viewport (standard mobile)
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 2; // Retina for high-quality output

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    colorScheme: "dark",
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 MiniPay",
  });

  // ── Screenshot 1: Play Hub with mission modal ──
  {
    console.log("1/4 Play Hub (mission modal)");
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/play-hub`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT_DIR}/01-play-hub-mission.png`, fullPage: false });
    console.log("  Saved → 01-play-hub-mission.png");
    await page.close();
  }

  // ── Screenshot 2: Play Hub with board exercise (dismiss modal, play) ──
  {
    console.log("2/4 Play Hub (exercise)");
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/play-hub`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);

    // Click PLAY button to dismiss mission modal and start exercise
    const playBtn = page.locator("button", { hasText: /play/i }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: `${OUT_DIR}/02-play-hub-exercise.png`, fullPage: false });
    console.log("  Saved → 02-play-hub-exercise.png");
    await page.close();
  }

  // ── Screenshot 3: Arena difficulty selector ──
  {
    console.log("3/4 Arena (difficulty)");
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/arena`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT_DIR}/03-arena-difficulty.png`, fullPage: false });
    console.log("  Saved → 03-arena-difficulty.png");
    await page.close();
  }

  // ── Screenshot 4: Arena board with pieces ──
  {
    console.log("4/4 Arena (board with pieces)");
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/arena`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);

    // Click "Enter Arena" to start a game
    const enterBtn = page.locator("button", { hasText: /enter arena/i }).first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.waitForTimeout(3000); // Wait for board to render with pieces
    }

    await page.screenshot({ path: `${OUT_DIR}/04-arena-board.png`, fullPage: false });
    console.log("  Saved → 04-arena-board.png");
    await page.close();
  }

  await browser.close();
  console.log(`\nDone! 4 screenshots saved to ./screenshots/`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
