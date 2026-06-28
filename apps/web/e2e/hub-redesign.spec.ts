import { test, expect } from "@playwright/test";

/**
 * SPEC 1 — Hub redesign priority smoke. Covers the destination
 * deep-links + new Hero/Secondary CTA shape + dock taxonomy that
 * Phases 4–7 introduced. Trophies candy port has its own spec
 * (trophies-candy.spec.ts); this one focuses on the hub surface.
 */
test.describe("Hub redesign", () => {
  test("first direct root visit renders the canonical Hub", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByRole("main", { name: "Chesscito Hub" })).toBeVisible();
  });

  test("secondary Enter Arena navigates to /arena", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /enter arena/i }).click();
    await expect(page).toHaveURL(/\/arena/);
  });

  // The avatar HUD chip is deferred — Task 5.5 explicitly skipped the
  // `notifDotCount` + `onAvatarTap` props because HubScaffold does not
  // yet expose an avatar slot. When that follow-up lands, flip
  // `test.fixme` back to `test` and verify the data-testid below.
  test.fixme("avatar tap opens Profile sheet", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="hub-avatar"]').click();
    await expect(page.getByText(/general stats/i)).toBeVisible();
  });

  test("/trophies renders the candy page with back button", async ({
    page,
  }) => {
    await page.goto("/trophies");
    await expect(
      page.getByRole("button", { name: /^back$/i }),
    ).toBeVisible();
  });

  test("/?sheet=profile deep-links into the Profile sheet", async ({
    page,
  }) => {
    await page.goto("/?sheet=profile");
    await expect(page.getByText(/general stats/i)).toBeVisible();
  });

  test("?hub=v2 query is ignored (V2 retired)", async ({ page }) => {
    await page.goto("/?hub=v2");
    await expect(page.getByRole("main", { name: "Chesscito Hub" })).toBeVisible();
  });

  test("canonical root is direct and legacy aliases redirect once with queries", async ({
    page,
  }) => {
    const direct = await page.request.get("/", { maxRedirects: 0 });
    expect(direct.status()).toBe(200);
    expect(direct.headers().location).toBeUndefined();

    const cases = [
      ["/hub", "/"],
      ["/hub?sheet=profile", "/?sheet=profile"],
      ["/hub?legacy=1&piece=rook", "/?legacy=1&piece=rook"],
      ["/hub?legacy=1&action=shop", "/?legacy=1&action=shop"],
      ["/en/hub", "/"],
      ["/es/hub?sheet=profile", "/es?sheet=profile"],
    ] as const;

    for (const [source, expected] of cases) {
      const response = await page.request.get(source, { maxRedirects: 0 });
      expect(response.status(), source).toBe(307);
      const location = new URL(response.headers().location!, "http://localhost:3000");
      expect(`${location.pathname}${location.search}`, source).toBe(expected);
    }

    const repeated = await page.request.get(
      "/hub?piece=rook&piece=bishop",
      { maxRedirects: 0 },
    );
    expect(repeated.status()).toBe(307);
    const repeatedLocation = new URL(
      repeated.headers().location!,
      "http://localhost:3000",
    );
    expect(repeatedLocation.pathname).toBe("/");
    expect(repeatedLocation.searchParams.getAll("piece")).toEqual([
      "rook",
      "bishop",
    ]);

    await page.goto("/hub");
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.locator(".hub-scaffold, .hub-v2-root")).toBeVisible();

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex.*nofollow/,
    );
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(new URL(canonical!).pathname).toBe("/");

    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).not.toContain("/hub");
  });
});
