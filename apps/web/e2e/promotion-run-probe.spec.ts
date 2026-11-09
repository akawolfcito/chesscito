import { test, expect, type Page } from "@playwright/test";

/**
 * Promotion Run — DEV probe at /dev/promotion-run, which renders the REAL board
 * against the REAL catalog (no spike copy).
 *
 * Every square below was MEASURED against the solver before it was written here.
 *
 * Level pawn-promotion-1: pawn c2, black rook b4, wall c4. A corridor — the wall
 * blocks the file, so the rook is not in the way, it IS the way. Note it cannot
 * be lost: every move is forced.
 *
 * Level pawn-promotion-3: pawn c2, knight a6, rooks b4 and d4, wall c4. TWO
 * rooks to eat and only one is dinner: the knight on a6 watches b4, so taking
 * that rook lands the pawn where the knight can see it. The live route is
 * c3 xd4 d5 d6 d7 d8 — and d5-d8 are watched by the d4 rook until the pawn eats
 * it, which is the whole game in one level.
 *
 * What this guards that a unit test cannot: that the shipped page never leaks
 * the watched squares, that the LIVE map survives real hydration, and that the
 * loop holds end to end.
 */
const cell = (page: Page, sq: string) => page.locator(`[data-square="${sq}"]`);

/** The pawn deselects after every move, so each step is pick-up-then-place. */
async function step(page: Page, from: string, to: string) {
  await cell(page, from).click();
  await cell(page, to).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/promotion-run");
  await expect(page.getByTestId("pr-board")).toBeVisible();
});

test("the player never sees the watched squares", async ({ page }) => {
  // D2, and the founder restated it for this game: "la idea es que aprenda con
  // el juego lúdico y que esté obligado a pensar, no a que se le dé la
  // respuesta".
  await expect(page.locator('[data-testid^="pr-watched-"]')).toHaveCount(0);
});

test("the authoring toggle draws the rook's file and rank", async ({ page }) => {
  // D3 — the founder cannot author a level he cannot see. The b-file plus the
  // 4th rank up to the wall, which the ray includes and stops on.
  await page.getByTestId("pr-zones").click();

  await expect(page.locator('[data-testid^="pr-watched-"]')).toHaveCount(9);
  for (const sq of ["a4", "b1", "b2", "b3", "b5", "b6", "b7", "b8", "c4"]) {
    await expect(page.getByTestId(`pr-watched-${sq}`)).toBeVisible();
  }
});

test("eating the rook unwatches every square it held — the map is LIVE", async ({ page }) => {
  // The difference from Safe Path, on the shipped page. Safe Path's enemies are
  // untouchable, so its map is a per-level constant; here the danger dies when
  // you eat it. b5..b8 are watched at the start, and the pawn walks up that very
  // file after taking the piece that watched it.
  await page.getByTestId("pr-zones").click();
  await expect(page.getByTestId("pr-watched-b8")).toBeVisible();

  await step(page, "c2", "c3");
  await step(page, "c3", "b4"); // xb4

  await expect(page.locator('[data-testid^="pr-watched-"]')).toHaveCount(0);
});

test("the corridor promotes, and the probe refuses to grade it", async ({ page }) => {
  // ⚠️ The result deliberately shows NO stars: every winning run measures
  // 7 - startRank, so a move grade is three stars for anyone who wins.
  for (const [from, to] of [
    ["c2", "c3"],
    ["c3", "b4"],
    ["b4", "b5"],
    ["b5", "b6"],
    ["b6", "b7"],
    ["b7", "b8"],
  ]) {
    await step(page, from, to);
  }

  await expect(page.getByTestId("pr-pawn-b8")).toBeVisible();
  await expect(page.getByTestId("pr-result")).toContainText("Promoted in 6 moves");
  await expect(page.getByTestId("pr-result")).toContainText("optimal 6");
  await expect(page.getByTestId("pr-result")).not.toContainText("★");
});

test("the wrong rook is a grave, and the knight that saw it is named", async ({ page }) => {
  // pawn-promotion-3, the founder's own screenshot: two rooks, one dinner.
  await page.getByTestId("pr-level-pawn-promotion-3").click();

  await step(page, "c2", "c3");
  await step(page, "c3", "b4"); // the rook the knight is watching

  await expect(page.getByTestId("pr-caught-b4")).toBeVisible();
  await expect(page.getByTestId("pr-beam-a6")).toBeVisible();
  await expect(page.getByTestId("pr-killer-a6")).toBeVisible();
  await expect(page.getByTestId("pr-caught-note")).toBeVisible();
});

test("retry runs from the start, and brings the eaten pieces back", async ({ page }) => {
  await page.getByTestId("pr-level-pawn-promotion-3").click();
  await step(page, "c2", "c3");
  await step(page, "c3", "d4"); // eat the right one
  await expect(page.getByTestId("pr-enemy-d4")).toHaveCount(0);

  await page.getByTestId("pr-retry").click();

  await expect(page.getByTestId("pr-pawn-c2")).toBeVisible();
  // The board resets the SURVIVORS, not just the pawn. A reset that forgot them
  // would hand the player a cleared board on their second try.
  await expect(page.getByTestId("pr-enemy-d4")).toBeVisible();
});

test("the safe rook is dinner, and its own file opens up behind it", async ({ page }) => {
  await page.getByTestId("pr-level-pawn-promotion-3").click();

  for (const [from, to] of [
    ["c2", "c3"],
    ["c3", "d4"],
    ["d4", "d5"],
    ["d5", "d6"],
    ["d6", "d7"],
    ["d7", "d8"],
  ]) {
    await step(page, from, to);
  }

  await expect(page.getByTestId("pr-pawn-d8")).toBeVisible();
  await expect(page.getByTestId("pr-result")).toContainText("Promoted in 6 moves");
});
