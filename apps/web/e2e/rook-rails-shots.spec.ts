import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Rook Rails guard + review artifact. Captures the four levels at the MiniPay
 * viewport AND pins each rendered board to its catalog entry: optimalMoves,
 * id and title come from a dedicated mission-chip testid (`mission-optimal-moves`),
 * NOT a bare on-board number — the rank labels 1–8 also read as "8", which is
 * how a stale catalog once passed this spec green (see the regression test below).
 * Position is checked by algebraic `[data-square]`, so a swapped board fails.
 */
const OUT = process.env.SHOT_DIR ?? "rook-rails-shots";

// Every rail is identified by the tuple that uniquely fingerprints its board:
// mover + target + optimalMoves. order = n - 1 (ladder position, "Labyrinth N").
const RAILS = [
  { n: 1, id: "rook-rail-two-turns", title: "Two Turns", mover: "c6", target: "e1", optimal: 8 },
  { n: 2, id: "rook-rail-dead-end", title: "Dead End", mover: "a4", target: "e4", optimal: 6 },
  { n: 3, id: "rook-rail-two-roads", title: "Two Roads", mover: "g1", target: "b7", optimal: 6 },
  { n: 4, id: "rook-rail-rook-run", title: "Rook Run", mover: "d8", target: "f1", optimal: 8 },
];

// Full unlock: exercise stars over the gate + the first three rails marked
// complete (a present labyrinth-best = completed), so every rail is tappable.
async function seedAndOpenRail(page: Page, n: number): Promise<void> {
  const railTitle = RAILS.find((r) => r.n === n)!.title;
  // The dev error overlay steals the lower third of the shot; silence it.
  await page.addInitScript(() => {
    window.addEventListener("error", (e) => e.stopImmediatePropagation(), true);
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
    // 10 rook exercises at 3★ — well over the 6-star / 3-exercise labyrinth gate.
    const stars: Record<string, number> = {};
    ["rook-1", "rook-2", "rook-distance-1", "rook-no-diagonal-1", "rook-4",
     "rook-9", "rook-10", "rook-8", "rook-6", "rook-7"].forEach((id) => (stars[id] = 3));
    window.localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({ piece: "rook", currentId: "rook-1", stars }),
    );
    // Earlier rails complete so the whole ladder is unlocked.
    window.localStorage.setItem(
      "chesscito:labyrinth-best:rook",
      JSON.stringify({
        "rook-rail-two-turns": 8,
        "rook-rail-dead-end": 6,
        "rook-rail-two-roads": 6,
      }),
    );
  });

  await page.goto("/en/exercises?piece=rook");
  await page.waitForLoadState("networkidle");

  // Open the training-path drawer (the stars pill, aria-label "Exercises").
  await page.getByRole("button", { name: "Exercises" }).first().click();
  // Special Training nodes now carry their authored title (B4.2.3).
  await page.getByRole("button", { name: railTitle }).click();
}

/** Select the mover and wait for its reachable squares to light up. */
async function selectMover(page: Page): Promise<void> {
  const mover = page.locator(".playhub-board-piece-float:not(.is-friendly-blocker)").first();
  const highlights = page.locator(".playhub-board-cell.is-highlighted");
  await expect(async () => {
    await mover.click();
    await expect(highlights.first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

for (const rail of RAILS) {
  test(`rail ${rail.n} — ${rail.title}`, async ({ page }) => {
    await seedAndOpenRail(page, rail.n);

    // Pin the level by its catalog identity — NOT a bare number match. The chip
    // carries the optimalMoves, id and title of the active labyrinth as data-*.
    const chip = page.getByTestId("mission-optimal-moves");
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveAttribute("data-optimal-moves", String(rail.optimal));
    await expect(chip).toHaveAttribute("data-labyrinth-id", rail.id);
    await expect(chip).toHaveAttribute("data-labyrinth-title", rail.title);

    // Target star renders on the expected square (ties board → FEN target).
    await expect(page.locator(`[data-square="${rail.target}"] .playhub-board-target`)).toBeVisible();

    // Selecting the mover marks the expected mover square as selected.
    await selectMover(page);
    await expect(
      page.locator(`[data-square="${rail.mover}"] .playhub-board-cell.is-selected`),
    ).toBeVisible();

    // Labyrinth obstacles must be ambient stone WALLS, never friendly pieces (A9).
    await expect(page.locator(".playhub-board-cell.is-wall").first()).toBeVisible();
    await expect(page.locator(".playhub-board-piece-float.is-friendly-blocker")).toHaveCount(0);

    await page.screenshot({ path: `${OUT}/rail-${rail.n}-${rail.id}.png` });
  });
}

/**
 * Regression for the stale-catalog false positive: level 1 (Two Turns) must be
 * the dense board c6→e1 with optimalMoves 8 — and must NOT be the retired
 * Delivery-1 board b2→g6 with optimalMoves 2. This test fails on the old data
 * where the previous `getByText("8")` (matching a rank label) passed.
 */
test("regression — level 1 is the dense c6→e1 board (opt 8), not the old b2→g6 (opt 2)", async ({
  page,
}) => {
  await seedAndOpenRail(page, 1);

  const chip = page.getByTestId("mission-optimal-moves");
  await expect(chip).toBeVisible({ timeout: 15_000 });
  // Current board.
  await expect(chip).toHaveAttribute("data-optimal-moves", "8");
  await expect(chip).toHaveAttribute("data-labyrinth-id", "rook-rail-two-turns");
  await expect(page.locator('[data-square="e1"] .playhub-board-target')).toBeVisible();
  await selectMover(page);
  await expect(page.locator('[data-square="c6"] .playhub-board-cell.is-selected')).toBeVisible();

  // Old board must be absent.
  await expect(chip).not.toHaveAttribute("data-optimal-moves", "2");
  await expect(page.locator('[data-square="g6"] .playhub-board-target')).toHaveCount(0);
  await expect(page.locator('[data-square="b2"] .playhub-board-cell.is-selected')).toHaveCount(0);
});
