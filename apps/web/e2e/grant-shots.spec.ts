import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Grant screenshot generator — 9 Lite-mode shots for docs/grants/assets/.
 *
 * Requires a Lite-mode server (NEXT_PUBLIC_CHESSCITO_LITE_MODE=true).
 * Opt-in with GRANT_SHOTS=true so the suite never runs in CI by default.
 *
 *   GRANT_SHOTS=true BASE_URL=https://lite-preview.chesscito.com \
 *     pnpm exec playwright test e2e/grant-shots.spec.ts --project=minipay
 *
 * Or against a local lite server:
 *   NEXT_PUBLIC_CHESSCITO_LITE_MODE=true PORT=3001 pnpm dev   (separate terminal)
 *   GRANT_SHOTS=true BASE_URL=http://localhost:3001 \
 *     pnpm exec playwright test e2e/grant-shots.spec.ts --project=minipay
 */

const OUT_DIR = path.resolve(__dirname, "../../../docs/grants/assets");

// Today UTC — used to seed a "completed today" streak
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = (() => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();
const TWO_DAYS_AGO = (() => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
})();

// 7★ for rook → lab unlocks (LABYRINTH_UNLOCK_THRESHOLD = 6)
const ROOK_PROGRESS_WITH_LAB = {
  piece: "rook",
  currentId: null,
  stars: { "rook-1": 3, "rook-2": 3, "rook-3": 1 },
};

// Rich exercise progress for showing interleaved path
const ROOK_PROGRESS_RICH = {
  piece: "rook",
  currentId: null,
  stars: {
    "rook-1": 3,
    "rook-2": 3,
    "rook-3": 2,
    "rook-4": 1,
  },
};

// 3-day streak — last completed YESTERDAY so today is still playable and
// no completion-triggered achievement overlay fires on mount.
const DAILY_3DAY_STREAK = {
  streak: 3,
  lastCompletedDate: YESTERDAY,
  totalCompleted: 3,
};

// WP for hub/passport shots: modal suppressed (count ≥ 2), clean hub surface.
const WP_PENDING = {
  version: 1,
  unlocked: true,
  unlockedAt: new Date().toISOString(),
  claimed: false,
  claimedAt: null,
  dismissed: false,
  dismissedAt: null,
  dismissCount: 0,
  autoShowCount: 99,
};

// WP for claim-gift shot: autoShowCount < 2 → shouldAutoShow=true → modal opens on mount.
const WP_PENDING_AUTOSHOW = {
  ...WP_PENDING,
  autoShowCount: 0,
};

async function seedBase(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ TODAY, YESTERDAY, TWO_DAYS_AGO }) => {
      localStorage.setItem("chesscito:onboarded", "true");
      localStorage.setItem("chesscito:welcome-dismissed", "1");
    },
    { TODAY, YESTERDAY, TWO_DAYS_AGO },
  );
}

async function seedFull(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ progress3day, wpPending, rookProgress, rookProgressRich, today, yesterday, twoDaysAgo }) => {
      localStorage.setItem("chesscito:onboarded", "true");
      localStorage.setItem("chesscito:welcome-dismissed", "1");
      localStorage.setItem("chesscito:daily-progress", JSON.stringify(progress3day));
      localStorage.setItem("chesscito:welcome-package", JSON.stringify(wpPending));
      localStorage.setItem("chesscito:progress:rook", JSON.stringify(rookProgress));
    },
    {
      progress3day: DAILY_3DAY_STREAK,
      wpPending: WP_PENDING,
      rookProgress: ROOK_PROGRESS_WITH_LAB,
      rookProgressRich: ROOK_PROGRESS_RICH,
      today: TODAY,
      yesterday: YESTERDAY,
      twoDaysAgo: TWO_DAYS_AGO,
    },
  );
}

async function screenshot(page: Page, filename: string) {
  // Short settle — animations, Radix transitions
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: false,
  });
}

test.describe("Grant shots — Lite mode", () => {
  test.skip(!process.env.GRANT_SHOTS, "Run with GRANT_SHOTS=true");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  // 01 — Hub Lite: focus-first, no monetization surfaces
  test("01-hub-lite", async ({ page }) => {
    await seedFull(page);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    await screenshot(page, "01-hub-lite.png");
  });

  // 02 — Daily Focus: open sheet from hub, board ready to solve
  test("02-daily-focus", async ({ page }) => {
    await seedBase(page);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    // Click the Daily Tactic tile — aria-label starts with "Play today's Daily Tactic"
    const dailyBtn = page.getByRole("button", { name: /play today.*daily tactic/i });
    await dailyBtn.click({ timeout: 8_000 });
    // Wait for the sheet to animate in
    await expect(page.locator('[role="dialog"][data-state="open"]').first()).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(800);
    await screenshot(page, "02-daily-focus.png");
  });

  // 03 — Focus Passport: 3-slot filled (3-day streak), lives on Hub
  test("03-focus-passport", async ({ page }) => {
    await seedFull(page);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    const passport = page.locator("[data-testid='focus-passport'], .focus-passport").first();
    if (await passport.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await passport.scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(800);
    await screenshot(page, "03-focus-passport.png");
  });

  // 04 — Lite Achievements (Trophies surface)
  test("04-lite-achievements", async ({ page }) => {
    await seedFull(page);
    await page.goto("/trophies", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    // Dismiss Next.js dev error toast if visible
    const errorClose = page.locator("nextjs-portal").getByRole("button").first();
    if (await errorClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await errorClose.click();
      await page.waitForTimeout(300);
    }
    await screenshot(page, "04-lite-achievements.png");
  });

  // 05 — Welcome Package: Claim Gift modal auto-opens (autoShowCount=0 → shouldAutoShow)
  test("05-claim-gift", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ streak, wp, rookProgress }) => {
        localStorage.setItem("chesscito:onboarded", "true");
        localStorage.setItem("chesscito:welcome-dismissed", "1");
        localStorage.setItem("chesscito:daily-progress", JSON.stringify(streak));
        localStorage.setItem("chesscito:welcome-package", JSON.stringify(wp));
        localStorage.setItem("chesscito:progress:rook", JSON.stringify(rookProgress));
      },
      { streak: DAILY_3DAY_STREAK, wp: WP_PENDING_AUTOSHOW, rookProgress: ROOK_PROGRESS_WITH_LAB },
    );
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    // shouldAutoShow=true → WelcomePackageModal renders on mount
    await page.waitForTimeout(1800);
    await screenshot(page, "05-claim-gift.png");
  });

  // 06 — Exercises path: open drawer to show interleaved exercise + labyrinth rows
  test("06-exercises-path", async ({ page }) => {
    await page.goto("/exercises", { waitUntil: "domcontentloaded" });
    await page.evaluate((rookProgress) => {
      localStorage.setItem("chesscito:onboarded", "true");
      localStorage.setItem("chesscito:welcome-dismissed", "1");
      localStorage.setItem("chesscito:progress:rook", JSON.stringify(rookProgress));
    }, ROOK_PROGRESS_WITH_LAB);
    await page.goto("/exercises", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    // Open the exercise drawer (stars pill button aria-label="Exercises")
    const drawerTrigger = page.getByRole("button", { name: "Exercises" }).first();
    await drawerTrigger.click({ timeout: 8_000 });
    // Wait for Radix sheet to animate in
    await expect(page.locator('[role="dialog"][data-state="open"]').first()).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(800);
    await screenshot(page, "06-exercises-path.png");
  });

  // 07 — Labyrinth active: open the first available lab from exercises
  test("07-labyrinth-active", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate((rookProgress) => {
      localStorage.setItem("chesscito:onboarded", "true");
      localStorage.setItem("chesscito:welcome-dismissed", "1");
      localStorage.setItem("chesscito:progress:rook", JSON.stringify(rookProgress));
    }, ROOK_PROGRESS_WITH_LAB);
    await page.goto("/exercises", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    // Tap the first available labyrinth row button
    const labBtn = page
      .getByRole("button", { name: /labyrinth|maze|challenge/i })
      .first();
    const labRow = page.locator(".training-path-lab-row, [data-kind='labyrinth']").first();
    if (await labBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await labBtn.click();
    } else if (await labRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await labRow.click();
    }
    await page.waitForTimeout(1200);
    await screenshot(page, "07-labyrinth-active.png");
  });

  // 08 — Account Lite: /exercises is the account surface in Lite (Network + Language tiles,
  //      no Arena Wins / no Saved Victories, Connect HUD pill)
  test("08-account-lite", async ({ page }) => {
    await seedBase(page);
    await page.goto("/exercises", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    await screenshot(page, "08-account-lite.png");
  });

  // 09 — /stats: public metrics page
  test("09-stats-public", async ({ page }) => {
    await page.goto("/stats", { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    await screenshot(page, "09-stats-public.png");
  });
});
