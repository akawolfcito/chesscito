import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Review artifact — captures the four Rook Rails levels at the MiniPay viewport,
 * with the rook selected so the opening decisions are visible. Not a regression
 * test; the shipping guards are the BFS verifier + the linter's decorative-obstacle
 * check. This is for the human visual review before Phase B.
 */
const OUT = process.env.SHOT_DIR ?? "rook-rails-shots";

// Full unlock: exercise stars over the gate, and the earlier rails marked
// complete (a present labyrinth-best = completed), so every rail is tappable.
const RAILS = [
  { n: 1, id: "rook-rail-one-turn", title: "One Turn", optimal: 2 },
  { n: 2, id: "rook-rail-two-turns", title: "Two Turns", optimal: 3 },
  { n: 3, id: "rook-rail-dead-end", title: "Dead End", optimal: 4 },
  { n: 4, id: "rook-rail-two-roads", title: "Two Roads", optimal: 6 },
];

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

for (const rail of RAILS) {
  test(`rail ${rail.n} — ${rail.title}`, async ({ page }) => {
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
          "rook-rail-one-turn": 2,
          "rook-rail-two-turns": 3,
          "rook-rail-dead-end": 4,
        }),
      );
    });

    await page.goto("/en/exercises?piece=rook");
    await page.waitForLoadState("networkidle");

    // Open the training-path drawer (the stars pill, aria-label "Exercises").
    await page.getByRole("button", { name: "Exercises" }).first().click();
    // Tap "Labyrinth N".
    await page.getByRole("button", { name: new RegExp(`Labyrinth ${rail.n}\\b`, "i") }).click();

    // The board is now the rail. The mission chip shows the labyrinth's optimal
    // move count (not a target coordinate), which pins the level.
    await expect(page.getByText(String(rail.optimal), { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    const mover = page.locator(".playhub-board-piece-float:not(.is-friendly-blocker)").first();
    const highlights = page.locator(".playhub-board-cell.is-highlighted");
    await expect(async () => {
      await mover.click();
      await expect(highlights.first()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // Labyrinth obstacles must be ambient stone WALLS, never friendly pieces (A9).
    await expect(page.locator(".playhub-board-cell.is-wall").first()).toBeVisible();
    await expect(page.locator(".playhub-board-piece-float.is-friendly-blocker")).toHaveCount(0);

    await page.screenshot({ path: `${OUT}/rail-${rail.n}-${rail.id}.png` });
  });
}
