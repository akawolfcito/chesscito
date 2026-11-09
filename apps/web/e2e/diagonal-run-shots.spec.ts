import { test, type Page } from "@playwright/test";

const DIR =
  "/private/tmp/claude-502/-Users-wolfcito-development-BLCKCHN-GOOD-WOLF-LABS-akawolfcito-celo-chesscito/b8cfd96d-1bf1-4285-a92a-da1c4e8c6117/scratchpad";
const cell = (page: Page, sq: string) => page.locator(`[data-square="${sq}"]`);
const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/dr-${name}.png` });

test("diagonal run — flow screenshots", async ({ page }) => {
  await page.goto("/dev/diagonal-run");
  await page.getByTestId("dr-board").waitFor();
  await page.waitForTimeout(250);
  await shot(page, "1-idle");

  await cell(page, "a1").click(); // select
  await page.waitForTimeout(200);
  await shot(page, "2-selected-sparks");

  await cell(page, "c3").click(); // NE direction — marker then glide
  await page.waitForTimeout(120); // catch the decision marker
  await shot(page, "3-marker");

  await page.waitForTimeout(600); // glide settled at d4, sparks for turn 2
  await shot(page, "4-after-glide");

  await cell(page, "g1").click(); // d4 -> SE -> g1 (star)
  await page.waitForTimeout(700);
  await shot(page, "5-won");
});
