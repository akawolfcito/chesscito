import { test, expect, type Page } from "@playwright/test";

/**
 * Safe Path — DEV probe at /dev/safe-path, which renders the REAL board against
 * the REAL catalog (no spike copy).
 *
 * Level king-safe-1: king a1, refuge h8, one black knight on c6 watching d4 and
 * e5. a1 -> h8 in 7 is ONLY the main diagonal (a king covering 7 files and 7
 * ranks in 7 moves must advance both every step), so watching two of its rungs
 * forces the detour: the catalog measures the safe route at 8.
 *
 * What this guards that a unit test cannot: that the shipped page never leaks
 * the watched squares to the player, and that the whole loop survives real
 * hydration.
 */
const cell = (page: Page, sq: string) => page.locator(`[data-square="${sq}"]`);

/** The king deselects after every move, so each step is pick-up-then-place. */
async function step(page: Page, from: string, to: string) {
  await cell(page, from).click();
  await cell(page, to).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/safe-path");
  await expect(page.getByTestId("sp-board")).toBeVisible();
});

test("the player never sees the watched squares", async ({ page }) => {
  // The whole design (plan D2): the enemy pieces are visible, so the danger is
  // a DEDUCTION. Painting it would do the reading for the player, and reading
  // the threat is the skill.
  await expect(page.locator('[data-testid^="sp-watched-"]')).toHaveCount(0);
});

test("the authoring toggle draws the knight's eight jumps", async ({ page }) => {
  // D3 — the founder cannot author a level he cannot see.
  await page.getByTestId("sp-zones").click();

  await expect(page.locator('[data-testid^="sp-watched-"]')).toHaveCount(8);
  for (const sq of ["a5", "a7", "b4", "b8", "d4", "d8", "e5", "e7"]) {
    await expect(page.getByTestId(`sp-watched-${sq}`)).toBeVisible();
  }
});

test("the king starts unpicked, and says so instead of doing nothing", async ({ page }) => {
  await expect(page.getByTestId("sp-king-a1")).toHaveAttribute(
    "data-selected",
    "false",
  );

  await cell(page, "b2").click();

  await expect(page.getByTestId("sp-select-hint")).toBeVisible();
  await expect(page.getByTestId("sp-king-a1")).toBeVisible();
});

test("a watched square is tappable, and it kills", async ({ page }) => {
  // The founder's model: "puedes pasar físicamente por ahí, pero es una zona
  // vigilada, así que no debes hacerlo". A wall maze would refuse this move.
  await step(page, "a1", "b2");
  await step(page, "b2", "c3");
  await step(page, "c3", "d4");

  await expect(page.getByTestId("sp-king-d4")).toBeVisible();
  await expect(page.getByTestId("sp-caught-d4")).toBeVisible();
  await expect(page.getByTestId("sp-caught-note")).toBeVisible();
});

test("the shot leaves the piece that took it", async ({ page }) => {
  await step(page, "a1", "b2");
  await step(page, "b2", "c3");
  await step(page, "c3", "d4");

  // From the knight on c6 — naming the killer is the lesson.
  await expect(page.getByTestId("sp-beam-c6")).toBeVisible();
  await expect(page.getByTestId("sp-killer-c6")).toBeVisible();
});

test("retry walks him home, not back to where he died", async ({ page }) => {
  await step(page, "a1", "b2");
  await step(page, "b2", "c3");
  await step(page, "c3", "d4");
  await expect(page.getByTestId("sp-king-d4")).toBeVisible();

  await page.getByTestId("sp-retry").click();

  await expect(page.getByTestId("sp-king-a1")).toBeVisible();
  await expect(page.locator('[data-testid^="sp-beam-"]')).toHaveCount(0);
});

test("the safe route reaches the refuge and scores", async ({ page }) => {
  const ROUTE = ["b2", "c3", "d3", "e4", "f5", "g6", "g7", "h8"];
  let from = "a1";
  for (const to of ROUTE) {
    await step(page, from, to);
    from = to;
  }

  await expect(page.getByTestId("sp-king-h8")).toBeVisible();
  await expect(page.getByTestId("sp-result")).toContainText("8 moves");
  await expect(page.getByTestId("sp-result")).toContainText("optimal 8");
  await expect(page.getByTestId("sp-result")).toContainText("3★");
});
