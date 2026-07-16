import { test, expect, type Page } from "@playwright/test";

/**
 * Knight's Tour — DEV probe at /dev/knight-tour, which renders the REAL board
 * against the REAL catalog (no spike copy).
 *
 * Level knight-tour-1: walls seal ranks 4+5, so the knight lives in the ranks
 * 1-3 band — 24 reachable squares, 80% = 20 of them.
 */
const cell = (page: Page, sq: string) => page.locator(`[data-square="${sq}"]`);

async function selectKnight(page: Page) {
  await cell(page, "a1").click();
  await expect(page.getByTestId("kt-band")).toHaveAttribute("data-phase", "selected");
}

test.describe("Knight's Tour probe", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/knight-tour");
  });

  test("tapping the board before selecting asks for the knight first", async ({ page }) => {
    await expect(page.getByTestId("kt-band")).toHaveAttribute("data-phase", "idle");
    await cell(page, "c2").click();
    await expect(page.getByTestId("kt-band-msg")).toContainText(/Tap your knight first/i);
    await expect(page.getByTestId("kt-piece-hint")).toBeVisible();
    await expect(page.getByTestId("kt-knight")).toHaveAttribute("data-knight-square", "a1");
  });

  test("the band shows the coverage count from the very first turn", async ({ page }) => {
    // The spec asks for the 80% line to be visible WHILE playing, not only at
    // the end: one square of 24 covered before a single jump.
    await expect(page.getByTestId("kt-band-msg")).toContainText("1/24");
    await expect(page.getByTestId("kt-band-msg")).toContainText("4%");
  });

  test("selecting sparks only the legal jumps", async ({ page }) => {
    await selectKnight(page);
    // From a1 inside the band: b3 and c2. Everything else is off-board.
    await expect(page.getByTestId("kt-spark")).toHaveCount(2);
  });

  test("jumping X-es out the square the knight left, for good", async ({ page }) => {
    await selectKnight(page);
    await expect(page.getByTestId("kt-x")).toHaveCount(0);
    await cell(page, "b3").click();
    await expect(page.getByTestId("kt-knight")).toHaveAttribute("data-knight-square", "b3");
    await expect(page.getByTestId("kt-band-msg")).toContainText("2/24");
    // a1 is now closed: exactly one X, and it is not under the knight.
    await expect(page.getByTestId("kt-x")).toHaveCount(1);
    // And it cannot be re-entered — a1 is a knight's move from b3, but used.
    await cell(page, "a1").click();
    await expect(page.getByTestId("kt-band-msg")).toContainText(/cannot jump there/i);
    await expect(page.getByTestId("kt-knight")).toHaveAttribute("data-knight-square", "b3");
  });

  test("a walled square is never a legal landing", async ({ page }) => {
    await selectKnight(page);
    await cell(page, "b3").click();
    // c5 sits on the sealed rank 5.
    await cell(page, "c5").click();
    await expect(page.getByTestId("kt-band-msg")).toContainText(/cannot jump there/i);
    await expect(page.getByTestId("kt-knight")).toHaveAttribute("data-knight-square", "b3");
  });

  test("running out of jumps ends the run and grades it BELOW the pass line", async ({ page }) => {
    await selectKnight(page);
    // The shortest dead end on this level, found by BFS over the game's own
    // states rather than guessed: a1 then these five, and the knight is
    // stranded on 6 of 24. Hard-coded so the test asserts one exact end state
    // — an earlier version broke off "when stuck" and would have passed
    // vacuously if the run never ended at all.
    for (const sq of ["b3", "c1", "e2", "c3", "a2"]) {
      await cell(page, sq).click();
    }
    await expect(page.getByTestId("kt-band")).toHaveAttribute("data-phase", "done");
    // 6/24 = 25%: the run is over, and it is NOT a pass. The whole point of the
    // coverage grader — the labyrinth grader would call this 3 stars.
    await expect(page.getByTestId("kt-band-msg")).toContainText("6/24");
    await expect(page.getByTestId("kt-band-msg")).toContainText("25%");
    await expect(page.getByTestId("kt-result")).toContainText("6/24");
    await expect(page.getByTestId("kt-result")).toContainText("0★");
    await expect(page.getByTestId("kt-result")).toContainText("below 80%");
  });

  test("retry puts the whole board back", async ({ page }) => {
    await selectKnight(page);
    await cell(page, "b3").click();
    await expect(page.getByTestId("kt-x")).toHaveCount(1);
    await page.getByTestId("kt-retry").click();
    await expect(page.getByTestId("kt-x")).toHaveCount(0);
    await expect(page.getByTestId("kt-knight")).toHaveAttribute("data-knight-square", "a1");
    await expect(page.getByTestId("kt-band-msg")).toContainText("1/24");
  });

  test("renders within the MiniPay viewport without horizontal overflow", async ({ page }) => {
    const ok = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(ok).toBe(true);
  });
});
