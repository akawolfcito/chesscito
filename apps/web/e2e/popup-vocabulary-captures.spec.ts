import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Ad-hoc "antes" captures for the 2026-06-04 popup vocabulary
 * migration audit. NOT part of the regular suite — generates PNGs
 * in errors/pantallas-lejanas/auto-capture/ so the
 * docs/audits/2026-06-04-popup-vocabulary-migration.md walkthrough
 * has a visual sibling for every distant surface, not just the user-
 * captured ones.
 *
 * Two phases:
 *   1) Fixture routes — /dev/coach-viewer, /dev/arena-end-state,
 *      /dev/rescue-modal. Zero-setup, deterministic.
 *   2) Live sheets — /exercises with click sequences. Brittle if the
 *      tile layout changes; spec uses data-testid + accessible name
 *      where possible.
 *
 * Run with:
 *   pnpm --filter web exec playwright test e2e/popup-vocabulary-captures.spec.ts \
 *     --project=minipay
 *
 * Playwright auto-starts pnpm dev (see webServer in playwright.config.ts).
 */

const REPO_ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(
  REPO_ROOT,
  "errors",
  "pantallas-lejanas",
  "auto-capture",
);

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

async function shot(page: import("@playwright/test").Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Phase 1 — fixture routes
// ─────────────────────────────────────────────────────────────────────

test.describe("Coach viewer states", () => {
  for (const variant of [
    "viewer-win-unminted",
    "viewer-win-minted",
    "viewer-loss",
    "viewer-partial-replay",
    "viewer-win-credits-hint",
    "viewer-win-pro-hint",
  ]) {
    test(variant, async ({ page }) => {
      await page.goto(`/dev/coach-viewer?variant=${variant}`);
      await shot(page, `coach-viewer-${variant}`);
    });
  }
});

test.describe("Arena end-state popups", () => {
  for (const variant of [
    "resigned",
    "checkmate",
    "stalemate",
    "draw",
    "win-celebration",
    "win-claiming",
    "win-success",
    "win-error",
    "win-timeout",
  ]) {
    test(variant, async ({ page }) => {
      await page.goto(`/dev/arena-end-state?variant=${variant}`);
      await shot(page, `arena-end-state-${variant}`);
    });
  }
});

test.describe("Rescue modal variants", () => {
  for (const variant of ["A", "B", "C", "D"] as const) {
    test(`rescue-${variant}`, async ({ page }) => {
      await page.goto(`/dev/rescue-modal?variant=${variant}&shields=8`);
      await shot(page, `rescue-modal-${variant}`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Phase 2 — live /exercises sheets via click sequences
// ─────────────────────────────────────────────────────────────────────

const ONBOARDED = () => {
  window.localStorage.setItem("chesscito:onboarded", "true");
  window.localStorage.setItem("chesscito:welcome-dismissed", "1");
};

test.describe("Exercises screen — sheets", () => {
  test("baseline", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/exercises");
    await shot(page, "exercises-baseline");
  });

  test("daily tactic sheet", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/exercises");
    await page.waitForLoadState("networkidle");
    const trigger = page
      .locator('[data-testid="daily-tactic-card"]')
      .first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, "daily-tactic-sheet-open");
  });

  test("shop sheet + confirm purchase", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/exercises");
    await page.waitForLoadState("networkidle");
    const shopButton = page.getByRole("button", { name: /shop/i }).first();
    if (await shopButton.isVisible().catch(() => false)) {
      await shopButton.click().catch(() => {});
      await page.waitForTimeout(500);
      await shot(page, "shop-sheet-open");
      // Try to surface the Confirm Purchase modal by tapping the first
      // SKU in the shop. The SKU rows are buttons; fall back gracefully.
      const sku = page.getByRole("button", { name: /coach credits|shield|founder/i }).first();
      if (await sku.isVisible().catch(() => false)) {
        await sku.click().catch(() => {});
        // 500ms isn't enough — the SKU click closes the shop sheet AND
        // mounts the confirm modal via state cascade; the scrim's bg
        // paint only stabilizes after the modal's animation frame
        // settles. Wait for the modal element then give the paint a
        // generous buffer so the screenshot lands with the scrim
        // applied.
        await page
          .waitForFunction(
            () =>
              !!document.querySelector(
                '[aria-labelledby="purchase-confirm-modal-title"]',
              ),
            null,
            { timeout: 5000 },
          )
          .catch(() => {});
        // Wait the full Shop-sheet exit animation + Confirm modal
        // fade-in: ~300ms each + paint buffer. Anything under 2s
        // intermittently captures the modal before its scrim is
        // opaque, so the dock leaks through.
        await page.waitForTimeout(3000);
        await shot(page, "confirm-purchase-sheet");
      }
    }
  });

  test("account sheet (new tile grid)", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/exercises");
    await page.waitForLoadState("networkidle");
    const accountTrigger = page.locator('[data-testid="account-trigger"]').first();
    if (await accountTrigger.isVisible().catch(() => false)) {
      await accountTrigger.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, "account-sheet-open");
  });

  test("trophies sheet", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/exercises");
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: /troph/i }).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, "trophies-sheet-open");
  });

  test("leaderboard sheet", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/exercises");
    await page.waitForLoadState("networkidle");
    const trigger = page
      .getByRole("button", { name: /leader|ranking/i })
      .first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, "leaderboard-sheet-open");
  });

  test("badges sheet", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/exercises");
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: /badg/i }).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, "badges-sheet-open");
  });
});

test.describe("Hub right rail sheets", () => {
  test("hub baseline", async ({ page }) => {
    await page.addInitScript(ONBOARDED);
    await page.goto("/");
    await shot(page, "hub-baseline");
  });

  test("mini-arena (mate) sheet — only when unlocked", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
      window.localStorage.setItem("chesscito:welcome-dismissed", "1");
      // Unlock condition is rook stars >= 12. Stars are aggregated from
      // chesscito:progress:rook.stars = [3,3,3,3,...]. Seed 4×3 = 12.
      window.localStorage.setItem(
        "chesscito:progress:rook",
        JSON.stringify({ stars: [3, 3, 3, 3, 3, 3] }),
      );
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const trigger = page.locator('[data-testid="mini-arena-trigger"] button').first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, "mini-arena-sheet");
  });
});
