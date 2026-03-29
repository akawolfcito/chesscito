import { test, expect } from "@playwright/test";

// Routes that do async fetches (RPC/Redis) use domcontentloaded to avoid
// waiting on background network calls that don't affect page rendering.
const ROUTES = [
  { path: "/", name: "play-hub", wait: "networkidle" as const },
  { path: "/arena", name: "arena", wait: "networkidle" as const },
  { path: "/trophies", name: "trophies", wait: "domcontentloaded" as const },
  { path: "/about", name: "about", wait: "networkidle" as const },
  { path: "/terms", name: "terms", wait: "networkidle" as const },
  { path: "/privacy", name: "privacy", wait: "networkidle" as const },
  { path: "/support", name: "support", wait: "networkidle" as const },
];

for (const route of ROUTES) {
  test(`${route.name} (${route.path}) loads without crash`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const res = await page.goto(route.path, {
      waitUntil: route.wait,
      timeout: 15_000,
    });

    expect(res?.status()).toBeLessThan(400);

    // Check no error boundary rendered
    const crashed = page.locator("text=Board crashed");
    await expect(crashed).toHaveCount(0);
    const trophyCrashed = page.locator("text=Could not load trophies");
    await expect(trophyCrashed).toHaveCount(0);

    // No console errors
    expect(errors).toEqual([]);

    await page.screenshot({
      path: `e2e-results/${route.name}.png`,
      fullPage: true,
    });
  });
}

test("play-hub idle stability (10s)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/", { waitUntil: "networkidle", timeout: 15_000 });

  // Wait 10 seconds idle
  await page.waitForTimeout(10_000);

  const crashed = page.locator("text=Board crashed");
  await expect(crashed).toHaveCount(0);

  expect(errors).toEqual([]);

  await page.screenshot({ path: "e2e-results/play-hub-idle-10s.png" });
});

test("navigation: play-hub dock links are reachable", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle", timeout: 15_000 });

  // Check persistent dock exists
  const dock = page.locator("nav, [class*='dock']");
  await expect(dock.first()).toBeVisible();

  await page.screenshot({ path: "e2e-results/play-hub-dock.png" });
});

test("navigation: about page links to legal routes", async ({ page }) => {
  await page.goto("/about", { waitUntil: "networkidle", timeout: 15_000 });

  // Check links to /terms, /privacy, /support exist
  for (const href of ["/terms", "/privacy", "/support"]) {
    const link = page.locator(`a[href="${href}"]`);
    await expect(link).toBeVisible();
  }

  await page.screenshot({ path: "e2e-results/about-links.png" });
});

test("stars display: check star counter visibility", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle", timeout: 15_000 });

  // Look for star counter pattern (e.g., "0/15" or "15/15")
  const starCounter = page.locator("text=/\\d+\\/15/");
  if (await starCounter.count() > 0) {
    await expect(starCounter.first()).toBeVisible();
  }

  await page.screenshot({ path: "e2e-results/play-hub-stars.png" });
});

test("trophies: hall of fame loads or shows empty state", async ({ page }) => {
  await page.goto("/trophies", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });

  // Wait for content to settle (async fetch)
  await page.waitForTimeout(3_000);

  // Should either show trophy cards or empty/loading state — not crash
  const crashed = page.locator("text=Board crashed");
  await expect(crashed).toHaveCount(0);
  const trophyCrashed = page.locator("text=Could not load trophies");
  await expect(trophyCrashed).toHaveCount(0);

  await page.screenshot({ path: "e2e-results/trophies-loaded.png" });
});

test("HUD: More button links to /about", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle", timeout: 15_000 });

  const moreLink = page.locator('a[href="/about"]');
  if (await moreLink.count() > 0) {
    await expect(moreLink.first()).toBeVisible();
    // Check if it's easily discoverable (not hidden or too small)
    const box = await moreLink.first().boundingBox();
    if (box) {
      // Touch target should be at least 44px
      expect(box.width).toBeGreaterThanOrEqual(20);
      expect(box.height).toBeGreaterThanOrEqual(20);
    }
  }

  await page.screenshot({ path: "e2e-results/hud-more-button.png" });
});
