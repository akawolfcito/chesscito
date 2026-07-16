import { test, expect, type Page } from "@playwright/test";

/**
 * Diagonal Run — REAL production flow (Gate D3). Bishop Special Training now
 * surfaces the three Diagonal Run levels (kind:"diagonal-run", projected as
 * labyrinth nodes). Seeds progress past the unlock gate, enters a level via the
 * training-path drawer, and plays a turn: select the bishop → tap the winning
 * pivot → capture the star. bishop-lab-3/-4 stay in content but hidden.
 */
const cell = (page: Page, sq: string) => page.locator(`[data-square="${sq}"]`);

async function seed(page: Page, locale = "en"): Promise<void> {
  await page.addInitScript(() => {
    window.addEventListener("error", (e) => e.stopImmediatePropagation(), true);
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
    window.localStorage.setItem(
      "chesscito:progress:bishop",
      JSON.stringify({ piece: "bishop", currentId: "bishop-1", stars: { "bishop-1": 3, "bishop-2": 3, "bishop-3": 3 } }),
    );
    // Earlier runs complete so all three ladder nodes are tappable.
    window.localStorage.setItem(
      "chesscito:labyrinth-best:bishop",
      JSON.stringify({ "bishop-run-1": 1, "bishop-run-2": 2 }),
    );
  });
  await page.goto(`/${locale}/exercises?piece=bishop`);
  await page.waitForLoadState("networkidle");
}

test("real flow — First Pivot: select, tap d4, capture the star", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Exercises" }).first().click();
  await page.getByRole("button", { name: "First Pivot" }).click();

  const board = page.getByTestId("dr-board");
  await expect(board).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("dr-band")).toHaveAttribute("data-phase", "idle");

  await cell(page, "a1").click(); // select the bishop
  await expect(page.getByTestId("dr-band")).toHaveAttribute("data-phase", "selected");
  await cell(page, "d4").click(); // winning pivot: turns SE onto g1
  await expect(page.getByTestId("dr-band")).toHaveAttribute("data-phase", "won", { timeout: 4_000 });
  await expect(page.getByTestId("dr-bishop")).toHaveAttribute("data-bishop-square", "g1");
  // Completion flows through the labyrinth ledger → the generic overlay.
  await expect(page.getByText(/Training Complete/i)).toBeVisible({ timeout: 4_000 });
});

test("real flow (ES) — the drawer node localizes to 'Primer pivote'", async ({ page }) => {
  await seed(page, "es");
  await page.getByRole("button", { name: /Ejercicios/i }).first().click();
  await expect(page.getByRole("button", { name: "Primer pivote" })).toBeVisible({ timeout: 15_000 });
});
