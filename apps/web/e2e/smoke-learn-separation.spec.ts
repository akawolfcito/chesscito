import { expect, test } from "@playwright/test";

/**
 * MANUAL SMOKE, DRIVEN — the 2026-08-19 Learn / Mini-games separation pass.
 *
 * ⛔ NOT A VR SPEC and not part of the VR baseline set. Every assertion here is
 * DOM or navigation, because that is what the smoke was actually about: the VR
 * tolerance on a 390×844 page is ~1.646 px and several of the things below are
 * a chip or a single row.
 *
 * It walks the four flows the founder named, against the REAL hub and the REAL
 * /exercises screen (not a `/dev` fixture), so it can catch what a fixture
 * cannot: routing, hydration, and the fact that a card actually opens the board
 * it advertises.
 *
 * ⛔ RUN IT AGAINST A PRODUCTION BUILD (`pnpm build && pnpm start`), NOT `pnpm dev`.
 *
 * Flow B fails under `pnpm dev` for a reason that has nothing to do with the
 * product: `next.config.js` sets `reactStrictMode: true`, so in DEVELOPMENT
 * React invokes every effect twice. The `[selectedPiece]` reset effect
 * (`exercises-screen.tsx:830`) clears `labyrinthMode` on its second pass, and
 * the deep-link effect cannot undo it because `implicitContentRequestRef`
 * already recorded the request — so a featured card lands on lane-1 exercise 1
 * instead of its challenge. Effects run ONCE in a production build and the
 * flow is correct there; verified 2026-08-19 by running this same probe against
 * both (`bandText: "Move to h4…"` in dev vs `"Two Roads 0 / 3 · 13 moves"` in
 * prod).
 *
 * ⚠️ That dev-only artifact is PREEXISTING — both the reset effect and the ref
 * guard predate the Mini-games surface — and is recorded as debt, not fixed
 * here. It is written down because it looks EXACTLY like the shipping bug this
 * pass was asked to close, and the next person to smoke on `pnpm dev` will
 * "reproduce" it.
 */

const LEARN_ENTRY = "[data-testid='learn-path-entry']";
const MINIGAMES = "[data-testid='minigames-section']";

/**
 * ⛔ RUN THIS IN LEARN MODE, OR IT MEASURES THE WRONG PRODUCT.
 *
 * `/` renders `HubLiteScaffold` only when `CHESSCITO_MODE === "learn"`;
 * otherwise it renders the FULL `HubScaffold`, a completely different screen
 * with its own vertical Training Path rail and no Mini-games section at all.
 *
 * ⚠️ The repo's own `apps/web/.env.local` ships
 * `NEXT_PUBLIC_CHESSCITO_LITE_MODE=false`, so a plain `pnpm dev` serves FULL —
 * this whole file failed that way on its first run, and every assertion was
 * "correctly" red about a screen that was never under test. Start the server
 * with `NEXT_PUBLIC_CHESSCITO_MODE=learn` (and unset the legacy flag, which
 * contradicts it and throws).
 *
 * This guard exists so that mistake announces itself in one line instead of
 * four confusing selector failures.
 */
async function assertLearnHub(page: import("@playwright/test").Page) {
  const scaffold = page.locator(".hub-lite-scaffold");
  await expect(
    scaffold,
    "Not the LEARN hub — `/` rendered the FULL HubScaffold. Start the dev " +
      "server with NEXT_PUBLIC_CHESSCITO_MODE=learn (see the note in this file).",
  ).toHaveCount(1);
}

/**
 * ⚠️ THE INTRO TOUR OWNS THE FIRST VISIT, AND IT BLOCKS TAPS.
 *
 * On a fresh profile `HubTour` auto-opens and spotlights the daily, the
 * challenge card and the Exercises entry in turn. Its overlay animates, so
 * Playwright's actionability check ("visible, enabled and stable") never
 * settles and every click times out — which is how Flows B and C first failed
 * while A and D, which only COUNT elements, passed. The elements were there the
 * whole time; they just were not tappable yet.
 *
 * Stamping the seen-flag before the first paint is the honest fix: it puts the
 * smoke on a RETURNING player, which is the state all four flows describe. The
 * tour's own coverage lives in its own suite.
 */
async function skipIntroTour(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("chesscito:hub-tour:learn:v2", "1");
      window.localStorage.setItem("chesscito:hub-tour:daily:v1", "1");
    } catch {
      // Private-mode storage throws; the tour then treats itself as seen anyway.
    }
  });
}

test.describe("Learn / Mini-games separation", () => {
  test.beforeEach(async ({ page }) => {
    await skipIntroTour(page);
  });

  /* ── FLOW A — Learn Home ────────────────────────────────────────────── */
  test("Flow A: the home offers ONE door per surface, in order, and no roster", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "load" });
    await assertLearnHub(page);
    await page.waitForSelector(".hub-lite-scaffold");
    await page.waitForTimeout(1200);

    const minigames = page.locator(MINIGAMES);
    const entry = page.locator(LEARN_ENTRY);
    await expect(minigames).toHaveCount(1);
    await expect(entry).toHaveCount(1);

    /* ⛔ The defect itself: six piece tiles competing with the rail.
       ⚠️ NOT a `.reward-tile` count — `HubActionTile` renders that class, so
       every tile in the rail has it and the count is 4, not 0. The roster was
       `RewardColumn`, whose root is `.reward-column`; that is the thing whose
       absence actually means "no roster". */
    await expect(page.locator(".reward-column")).toHaveCount(0);

    /* Rail order: Exercises → DIVIDER → Mini-games. The divider is the
       assertion: once both surfaces share one rail, it and the EARLY ACCESS
       tag are all that keep them legible as two destinations, and dropping it
       would break nothing visible. */
    const order = await page.evaluate(
      ([en, dv, mg]) => {
        const all = Array.from(document.querySelectorAll("*"));
        const at = (sel: string) =>
          all.indexOf(document.querySelector(sel) as Element);
        return [at(en), at(dv), at(mg)];
      },
      [LEARN_ENTRY, "[data-testid='learn-rail-divider']", MINIGAMES],
    );
    expect(order[1]).toBeGreaterThan(-1); // the divider is rendered
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);

    // The entry names itself and is a real tap target.
    await expect(entry).toContainText(/exercises/i);
    const box = await entry.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  /* ── FLOW B — Featured mini-game ────────────────────────────────────── */
  test("Flow B: a featured card opens ITS challenge, flagged as featured", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "load" });
    await assertLearnHub(page);
    await page.waitForSelector(MINIGAMES);
    await page.waitForTimeout(1200);

    const card = page.locator("[data-testid^='minigame-card-']").first();
    const challengeId = await card.getAttribute("data-testid");
    await card.click();

    await page.waitForURL(/\/exercises\?content=/, { timeout: 20_000 });
    const url = new URL(page.url());
    // ⛔ `featured` must be EARNED: the route only sets it when the id is
    // genuinely inside the shipped rotation. Its presence is what lets the
    // screen skip the lane's progression lock AND what marks the origin.
    expect(url.searchParams.get("featured")).toBeTruthy();
    expect(challengeId).toContain(url.searchParams.get("content")!);

    /* ⛔ AND THE BOARD THAT MOUNTS MUST BE THAT CHALLENGE.
       Asserting the URL alone measured nothing: the screen resolves
       `?content=` through a hydration step that can settle back onto lane 1,
       and a probe that stops at the query string would call that a pass. This
       is the founder's complaint #4 in one assertion — "I entered a mini-game,
       but the app thinks I'm in the Rook path".
       The mission band carries `data-labyrinth-id`, which is set ONLY while a
       lane-2 board is mounted; a lane-1 exercise leaves it absent. */
    // ⚠️ `data-labyrinth-id` lives on the band's inner <span>, NOT on the
    // button that carries `data-testid="mission-band"`. Read the attribute
    // from the DOM rather than from a locator that looks right.
    const labyrinthId = page.locator("[data-labyrinth-id]");
    await labyrinthId.waitFor({ state: "attached", timeout: 20_000 });
    await expect(labyrinthId).toHaveAttribute(
      "data-labyrinth-id",
      url.searchParams.get("content")!,
      { timeout: 20_000 },
    );

    // PART 3: the sweep counter must name what it counts. `0 / 3` on its own
    // is what the smoke read as "three levels"; the accessible name is the
    // only place the board says otherwise.
    const counter = page.locator("[data-testid='sweep-counter']");
    if (await counter.count()) {
      await expect(counter).toHaveAttribute(
        "aria-label",
        /stars on this board/i,
      );
    }
  });

  /* ── FLOW C — Exercise path ─────────────────────────────────────────── */
  test("Flow C: the Exercises entry opens the exercise path, NOT a mini-game", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "load" });
    await assertLearnHub(page);
    await page.waitForSelector(LEARN_ENTRY);
    await page.waitForTimeout(1200);

    await page.locator(LEARN_ENTRY).click();
    await page.waitForURL(/\/exercises/, { timeout: 20_000 });

    const url = new URL(page.url());
    // The path entry carries a piece and NEVER the featured flag — a door into
    // lane 1 that arrived pre-flagged as featured would re-open the exact
    // origin confusion this pass closes.
    expect(url.searchParams.get("piece")).toBeTruthy();
    expect(url.searchParams.get("featured")).toBeNull();
    expect(url.searchParams.get("content")).toBeNull();
  });

  /* ── FLOW D — Small viewport ────────────────────────────────────────── */
  test("Flow D: the hierarchy is still readable and ordered at the minimum", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/", { waitUntil: "load" });
    await assertLearnHub(page);
    await page.waitForSelector(".hub-lite-scaffold");
    await page.waitForTimeout(1200);

    // The page must never scroll SIDEWAYS, at any width.
    const horizontal = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(horizontal).toBeLessThanOrEqual(0);

    // Both surfaces exist and keep their order; position is reported, not
    // asserted (the founder's Flow D explicitly relaxes no-scroll here).
    await expect(page.locator(MINIGAMES)).toHaveCount(1);
    await expect(page.locator(LEARN_ENTRY)).toHaveCount(1);

    const entryBottom = await page
      .locator(LEARN_ENTRY)
      .boundingBox()
      .then((b) => Math.round(b!.y + b!.height));
    console.log(
      `FLOW D 360x640 — Exercises entry bottom=${entryBottom} (viewport 640)`,
    );
  });
});
