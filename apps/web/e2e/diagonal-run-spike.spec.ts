import { test, expect, type Page } from "@playwright/test";

/**
 * Diagonal Run — DEV probe (Gate D2, pivot model) at /dev/diagonal-run.
 * Level a1 → g1, friendly knight e5, optimalMoves 1 (the pivot d4).
 * One tap picks a pivot: the bishop slides to it, then TURNS onto a perpendicular
 * diagonal and slides to the star / a blocker / the edge.
 */
const cell = (page: Page, sq: string) => page.locator(`[data-square="${sq}"]`);

async function selectBishop(page: Page) {
  await cell(page, "a1").click();
  await expect(page.getByTestId("dr-band")).toHaveAttribute("data-phase", "selected");
}

test.describe("Diagonal Run spike", () => {
  test("tapping the board before selecting asks for the bishop first", async ({ page }) => {
    await page.goto("/dev/diagonal-run");
    await expect(page.getByTestId("dr-band")).toHaveAttribute("data-phase", "idle");
    await cell(page, "d4").click();
    await expect(page.getByTestId("dr-band-msg")).toContainText(/Tap your bishop first/i);
    // The same contextual bubble the canonical board shows, anchored to the piece.
    await expect(page.getByTestId("dr-piece-hint")).toBeVisible();
    await expect(page.getByTestId("dr-piece-hint")).toContainText(/Tap your bishop first/i);
    await expect(page.getByTestId("dr-bishop")).toHaveAttribute("data-bishop-square", "a1");
  });

  test("selecting zooms the bishop and sparks every reachable pivot", async ({ page }) => {
    await page.goto("/dev/diagonal-run");
    await selectBishop(page);
    await expect(page.getByTestId("dr-bishop")).toHaveClass(/is-selected/);
    // From a1 the NE ray (blocked at e5) offers three pivots: b2, c3, d4.
    await expect(page.getByTestId("dr-spark")).toHaveCount(3);
  });

  test("the pivot d4 turns SE onto the star and wins in one tap (3 stars)", async ({ page }) => {
    await page.goto("/dev/diagonal-run");
    await selectBishop(page);
    await cell(page, "d4").click();
    await expect(page.getByTestId("dr-marker")).toBeVisible(); // the pivot marker
    await expect(page.getByTestId("dr-bishop")).toHaveAttribute("data-bishop-square", "d4", { timeout: 3_000 });
    await expect(page.getByTestId("dr-band")).toHaveAttribute("data-phase", "won", { timeout: 4_000 });
    await expect(page.getByTestId("dr-bishop")).toHaveAttribute("data-bishop-square", "g1");
    await expect(page.getByTestId("dr-band-msg")).toContainText("1/1");
    await expect(page.getByTestId("dr-band-msg")).toContainText("★★★");
  });

  test("a legal but suboptimal pivot executes (marker, no error)", async ({ page }) => {
    await page.goto("/dev/diagonal-run");
    await selectBishop(page);
    await cell(page, "b2").click(); // legal pivot, but its turn does not reach the star
    await expect(page.getByTestId("dr-marker")).toBeVisible(); // legal → marker shown
    await expect(page.getByTestId("dr-band-msg")).not.toContainText(/cannot move/i);
  });

  test("an illegal tap (non-diagonal) does not move and shows the hint", async ({ page }) => {
    await page.goto("/dev/diagonal-run");
    await selectBishop(page);
    await cell(page, "a5").click(); // same file as a1 → not a diagonal
    await expect(page.getByTestId("dr-band-msg")).toContainText(/cannot move there/i);
    await expect(page.getByTestId("dr-bishop")).toHaveAttribute("data-bishop-square", "a1");
    await expect(page.getByTestId("dr-marker")).toHaveCount(0);
  });

  test("a square past the blocker is not a legal pivot", async ({ page }) => {
    await page.goto("/dev/diagonal-run");
    await selectBishop(page);
    await cell(page, "f6").click(); // beyond the e5 knight on the NE ray
    await expect(page.getByTestId("dr-band-msg")).toContainText(/cannot move there/i);
    await expect(page.getByTestId("dr-bishop")).toHaveAttribute("data-bishop-square", "a1");
  });

  test("renders within the MiniPay viewport without horizontal overflow", async ({ page }) => {
    await page.goto("/dev/diagonal-run");
    const ok = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(ok).toBe(true);
  });
});
