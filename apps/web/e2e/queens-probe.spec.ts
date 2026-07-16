import { test, expect, type Page } from "@playwright/test";

/**
 * N-Queens — DEV probe at /dev/queens, which renders the REAL board against the
 * REAL catalog (no spike copy).
 *
 * Level queens-1: blocks seal everything outside a 5x5 room (files a-e, ranks
 * 1-5) with the level's queen on a1. Exact ceiling: 5 queens, 80% = 4 of them.
 *
 * ⚠️ Every play-out below is HARD-CODED from the solver, never discovered at
 * runtime. A test that branches on "if stuck" passes without ever ending a run,
 * which is a green light for nothing at all.
 */
const cell = (page: Page, sq: string) => page.locator(`[data-square="${sq}"]`);
const sparks = (page: Page) => page.locator('[data-testid^="q-spark-"]');

async function selectQueen(page: Page, sq = "a1") {
  await cell(page, sq).click();
  await expect(page.getByTestId("q-band")).toHaveAttribute("data-phase", "selected");
}

test.describe("N-Queens probe", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/queens");
  });

  test("tapping the board before selecting asks for the queen first", async ({ page }) => {
    await expect(page.getByTestId("q-band")).toHaveAttribute("data-phase", "idle");
    await cell(page, "c4").click();
    await expect(page.getByTestId("q-band-msg")).toContainText(/Tap your queen first/i);
    await expect(page.getByTestId("q-piece-hint")).toBeVisible();
    await expect(page.getByTestId("q-queen-c4")).toHaveCount(0);
  });

  test("the band shows the count from the very first turn", async ({ page }) => {
    // The 80% line has to be visible WHILE playing, not only at the end: the
    // level's own queen is 1 of 5 before the player has placed anything.
    await expect(page.getByTestId("q-band-msg")).toContainText("1/5");
    await expect(page.getByTestId("q-band-msg")).toContainText("20%");
  });

  test("selecting sparks only the squares no queen can see", async ({ page }) => {
    await selectQueen(page);
    // The 5x5 room holds 25 squares. a1 is taken, and it watches 12 of the rest
    // (4 up the file, 4 along the rank, 4 on the diagonal) — 12 are safe.
    await expect(sparks(page)).toHaveCount(12);
    await expect(page.getByTestId("q-spark-a5")).toHaveCount(0); // a1's file
    await expect(page.getByTestId("q-spark-e1")).toHaveCount(0); // a1's rank
    await expect(page.getByTestId("q-spark-c3")).toHaveCount(0); // a1's diagonal
  });

  test("a watched square is refused, named, and costs nothing", async ({ page }) => {
    await selectQueen(page);
    await cell(page, "a5").click();
    await expect(page.getByTestId("q-band-msg")).toContainText(/watched by a queen/i);
    await expect(page.getByTestId("q-queen-a5")).toHaveCount(0);
    // The refusal TEACHES: the square is ringed and so is the queen watching it.
    await expect(page.getByTestId("q-attack-a5")).toBeVisible();
    await expect(page.getByTestId("q-attacker-a1")).toBeVisible();
    // And it costs NOTHING: same count, same 12 safe squares, still playable.
    await expect(page.getByTestId("q-band-msg")).toContainText("1/5");
    await expect(sparks(page)).toHaveCount(12);
  });

  test("a blocked square is refused as a wall, not as a watched square", async ({ page }) => {
    await selectQueen(page);
    // f1 is outside the room — a block. Saying "a queen watches it" would send
    // the player hunting for a queen that is not there.
    await cell(page, "f1").click();
    await expect(page.getByTestId("q-band-msg")).toContainText(/is a wall/i);
  });

  test("placing a queen closes the lines she now watches", async ({ page }) => {
    await selectQueen(page);
    await cell(page, "b3").click();
    await expect(page.getByTestId("q-queen-b3")).toBeVisible();
    await expect(page.getByTestId("q-band-msg")).toContainText("2/5");
    // b3 now watches b4/b5/c4/d5/a4..., so the safe set shrinks — the whole
    // tension of the game: every queen you place makes the next one harder.
    await expect(sparks(page)).toHaveCount(4);
  });

  test("running out of safe squares ends the run and grades it BELOW the pass line", async ({ page }) => {
    await selectQueen(page);
    // The shortest dead end on this level, found by walking the game's own
    // states with the solver: a1 then these two, and the room is sealed at 3
    // of 5. Hard-coded so the test asserts one exact end state.
    for (const sq of ["b4", "d3"]) await cell(page, sq).click();
    await expect(page.getByTestId("q-band")).toHaveAttribute("data-phase", "done");
    // 3/5 = 60%: the run is over and it is NOT a pass. The whole point of the
    // coverage grader — the labyrinth grader would call this 3 stars.
    await expect(page.getByTestId("q-band-msg")).toContainText("3/5");
    await expect(page.getByTestId("q-band-msg")).toContainText("60%");
    await expect(page.getByTestId("q-result")).toContainText("3/5");
    await expect(page.getByTestId("q-result")).toContainText("0★");
    await expect(page.getByTestId("q-result")).toContainText("below 80%");
  });

  test("filling the room clears it at 3 stars", async ({ page }) => {
    await selectQueen(page);
    for (const sq of ["b3", "c5", "d2", "e4"]) await cell(page, sq).click();
    await expect(page.getByTestId("q-band")).toHaveAttribute("data-phase", "done");
    await expect(page.getByTestId("q-result")).toContainText("5/5");
    await expect(page.getByTestId("q-result")).toContainText("3★");
    await expect(page.getByTestId("q-result")).toContainText("PASS");
  });

  test("queens-3 fits NINE queens, because a block cuts the a-file", async ({ page }) => {
    // The level the founder's rule earns (2026-07-16). An open 8x8 holds eight
    // non-attacking queens and no more; the block on a3 splits the a-file, so
    // a1 and a4 coexist on it and a ninth queen fits.
    await page.getByTestId("q-level-queens-3").click();
    await selectQueen(page);
    for (const sq of ["a4", "b6", "c8", "d2", "e7", "f1", "g3", "h5"]) {
      await cell(page, sq).click();
    }
    await expect(page.getByTestId("q-band")).toHaveAttribute("data-phase", "done");
    // Both a-file queens are on the board at once — the rule, made visible.
    await expect(page.getByTestId("q-queen-a1")).toBeVisible();
    await expect(page.getByTestId("q-queen-a4")).toBeVisible();
    await expect(page.getByTestId("q-result")).toContainText("9/9");
    await expect(page.getByTestId("q-result")).toContainText("3★");
  });

  test("retry puts the whole board back", async ({ page }) => {
    await selectQueen(page);
    await cell(page, "b3").click();
    await expect(page.getByTestId("q-queen-b3")).toBeVisible();
    await page.getByTestId("q-retry").click();
    await expect(page.getByTestId("q-queen-b3")).toHaveCount(0);
    await expect(page.getByTestId("q-queen-a1")).toBeVisible();
    await expect(page.getByTestId("q-band-msg")).toContainText("1/5");
  });

  test("renders within the MiniPay viewport without horizontal overflow", async ({ page }) => {
    const ok = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(ok).toBe(true);
  });
});
