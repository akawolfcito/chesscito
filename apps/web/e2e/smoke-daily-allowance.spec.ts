import { expect, test } from "@playwright/test";

/**
 * MANUAL SMOKE, DRIVEN — the 2026-08-21 personal daily allowance.
 *
 * ⛔ NOT A VR SPEC and not part of the VR baseline set. Every assertion is DOM
 * or navigation: the VR tolerance on 390×844 is ~1.646 px and everything this
 * pass changed — a status row, a count, one pill — is smaller than that.
 *
 * ⛔ RUN IT AGAINST A PRODUCTION BUILD IN LEARN MODE:
 *     NEXT_PUBLIC_CHESSCITO_MODE=learn pnpm build && pnpm start
 * `/` renders `HubLiteScaffold` only in LEARN; anything else is a different
 * screen with no Mini-games section at all. And `reactStrictMode` double-runs
 * effects in dev, which lands a featured deep link on lane-1 instead of its
 * challenge (documented at length in `smoke-learn-separation.spec.ts`).
 *
 * ⚠️ HOW THE WINDOW IS CROSSED (Flow D). The window id is a UTC date the
 * container reads once at mount. Rather than move the machine's clock — which
 * would also move the streak, the daily and every server `day_utc` — the smoke
 * REWRITES THE STORED ASSIGNMENT's window id to an older day and reloads. That
 * is exactly the state a player wakes up to, and it is deterministic.
 */

const MINIGAMES = "[data-testid='minigames-section']";
const STATUS = "[data-testid='minigames-status']";
const TODAY = "[data-testid='minigames-today']";
const REFILL = "[data-testid='minigames-refill']";
const CARD = "[data-testid^='minigame-card-']";

const WINDOW_KEY = "chesscito:minigames-window:v1";
const BESTS_KEY = (piece: string) => `chesscito:labyrinth-best:${piece}`;

/**
 * Puts the smoke on a RETURNING player, which is the state every flow here
 * describes.
 *
 * ⚠️ THREE OVERLAYS, not one, and each blocks taps differently:
 *  - `HubTour` auto-opens on the Learn home and animates, so Playwright's
 *    actionability check never settles;
 *  - `MissionBriefing` mounts on `/exercises` at z-40 and — because of a
 *    one-shot `useState(isFirstVisit)` — never unmounts in the session even
 *    after dismissal, so it must be prevented, not closed;
 *  - `WelcomeOverlay` mounts at z-70 on the same route.
 * Stamping all three before first paint is the only reliable fix; each one's
 * own coverage lives in its own suite.
 */
async function skipIntroTour(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("chesscito:hub-tour:learn:v2", "1");
      window.localStorage.setItem("chesscito:hub-tour:daily:v1", "1");
      window.localStorage.setItem("chesscito:onboarded", "true");
      window.localStorage.setItem("chesscito:welcome-dismissed", "1");
    } catch {
      // Private-mode storage throws; the overlays then treat themselves as seen.
    }
  });
}

async function assertLearnHub(page: import("@playwright/test").Page) {
  await expect(
    page.locator(".hub-lite-scaffold"),
    "Not the LEARN hub — start the server with NEXT_PUBLIC_CHESSCITO_MODE=learn.",
  ).toHaveCount(1);
}

async function openHub(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "load" });
  await assertLearnHub(page);
  await page.waitForSelector(MINIGAMES);
  await page.waitForSelector(STATUS);
}

/** The ids the window assigned, straight from the store the Home just wrote. */
async function assignedIds(page: import("@playwright/test").Page): Promise<string[]> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), WINDOW_KEY);
  expect(raw, "the Home must persist its assignment").not.toBeNull();
  return (JSON.parse(raw!) as { assigned: string[] }).assigned;
}

/** Record a completion the way the game does — a best under the piece. */
async function markCompleted(
  page: import("@playwright/test").Page,
  piece: string,
  challengeId: string,
) {
  await page.evaluate(
    ({ key, id }) => {
      const prev = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      window.localStorage.setItem(key, JSON.stringify({ ...prev, [id]: 7 }));
    },
    { key: BESTS_KEY(piece), id: challengeId },
  );
}

/** The piece a card belongs to, read from the tile the Home rendered. */
async function pieceOf(page: import("@playwright/test").Page, challengeId: string) {
  // The card carries its engine; the piece is what the bests map is keyed by,
  // and the id prefix is not reliable enough to guess from.
  return page.evaluate((id) => {
    const tile = document.querySelector(`[data-testid='minigame-card-${id}']`);
    return tile?.getAttribute("data-engine") ?? "";
  }, challengeId);
}

const ENGINE_PIECE: Record<string, string> = {
  "rook-rail": "rook",
  "pivot-run": "bishop",
  "n-queens": "queen",
  "safe-path": "king",
};

test.describe("personal daily allowance", () => {
  test.beforeEach(async ({ page }) => {
    await skipIntroTour(page);
  });

  /* ── FLOW A — fresh state ───────────────────────────────────────────── */
  test("Flow A: a fresh player gets three, at 0/3, with NO timer", async ({ page }) => {
    await openHub(page);

    await expect(page.locator(CARD)).toHaveCount(3);
    await expect(page.locator(TODAY)).toHaveText("0/3 today");

    /* ⛔ Nothing has been consumed, so nothing is charging. A countdown here is
       the noise that trains people to stop reading this row. */
    await expect(page.locator(REFILL)).toHaveCount(0);
    await expect(page.locator(STATUS)).toHaveAttribute("data-hours", "none");

    // U-1: the catalogue size must not reach the Home in any form.
    await expect(page.locator(STATUS)).not.toContainText("13");
  });

  /* ── FLOW B + G — completing one, and replay ────────────────────────── */
  test("Flow B: completing one shows 1/3 and does NOT hand out a fourth", async ({
    page,
  }) => {
    await openHub(page);
    const before = await assignedIds(page);
    expect(before).toHaveLength(3);

    const target = before[0]!;
    const engine = await pieceOf(page, target);
    await markCompleted(page, ENGINE_PIECE[engine]!, target);

    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(STATUS);

    await expect(page.locator(TODAY)).toHaveText("1/3 today");
    // ⛔ THE WHOLE PASS: the consumed slot stays consumed for the window.
    await expect(page.locator(CARD)).toHaveCount(3);
    expect(await assignedIds(page)).toEqual(before);

    // The refill hint appears the moment something is consumed.
    await expect(page.locator(REFILL)).toHaveCount(1);
    await expect(page.locator(REFILL)).toHaveText(/^\d+h$/);
  });

  /* ── FLOW C — leaving and coming back ───────────────────────────────── */
  test("Flow C: leaving and re-entering keeps the same remaining two", async ({
    page,
  }) => {
    await openHub(page);
    const before = await assignedIds(page);
    const target = before[0]!;
    await markCompleted(page, ENGINE_PIECE[await pieceOf(page, target)]!, target);

    await page.goto("/minigames", { waitUntil: "load" });
    await page.waitForSelector("[data-testid='minigames-library']");
    await openHub(page);

    expect(await assignedIds(page)).toEqual(before);
    await expect(page.locator(TODAY)).toHaveText("1/3 today");
  });

  /* ── FLOW D — crossing the window ───────────────────────────────────── */
  test("Flow D: the next window replenishes exactly the consumed slot", async ({
    page,
  }) => {
    await openHub(page);
    const day1 = await assignedIds(page);
    const consumed = day1[0]!;
    await markCompleted(page, ENGINE_PIECE[await pieceOf(page, consumed)]!, consumed);

    // Age the stored window. This is the state a player wakes up to.
    await page.evaluate((key) => {
      const stored = JSON.parse(window.localStorage.getItem(key)!);
      window.localStorage.setItem(
        key,
        JSON.stringify({ ...stored, windowId: "2020-01-01" }),
      );
    }, WINDOW_KEY);

    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(STATUS);

    const day2 = await assignedIds(page);
    expect(day2).toHaveLength(3);
    expect(day2).not.toContain(consumed);
    // ⛔ The two the player never opened are still there — untouched.
    for (const kept of day1.slice(1)) expect(day2).toContain(kept);
    // …and exactly one new thing arrived.
    expect(day2.filter((id) => !day1.includes(id))).toHaveLength(1);

    await expect(page.locator(TODAY)).toHaveText("0/3 today");
    await expect(page.locator(REFILL)).toHaveCount(0);
  });

  /* ── FLOW E — the cap ───────────────────────────────────────────────── */
  test("Flow E: 3/3 reads complete and anticipatory, with no fourth challenge", async ({
    page,
  }) => {
    await openHub(page);
    const assigned = await assignedIds(page);
    for (const id of assigned) {
      await markCompleted(page, ENGINE_PIECE[await pieceOf(page, id)]!, id);
    }

    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(STATUS);

    await expect(page.locator(TODAY)).toHaveText("3/3 today");
    await expect(page.locator(REFILL)).toHaveCount(1);
    await expect(page.locator(CARD)).toHaveCount(3);
    expect(await assignedIds(page)).toEqual(assigned);

    // U-7: no paid affordance while monetization is disabled.
    await expect(page.locator("[data-testid='minigames-unlock']")).toHaveCount(0);

    // U-4: the old explanatory sentence is gone, not reworded.
    await expect(page.locator("[data-testid='minigames-all-clear']")).toHaveCount(0);
    await expect(page.locator(".hub-lite-scaffold")).not.toContainText(
      "from time to time",
    );
  });

  /* ── FLOW F — the Library respects the allowance ────────────────────── */
  test("Flow F: the Library plays today's and replays completed, never the future", async ({
    page,
  }) => {
    await openHub(page);
    const assigned = await assignedIds(page);
    const done = assigned[0]!;
    await markCompleted(page, ENGINE_PIECE[await pieceOf(page, done)]!, done);

    await page.goto("/minigames", { waitUntil: "load" });
    await page.waitForSelector("[data-testid='minigames-library']");

    // Today's remaining two are playable…
    for (const id of assigned.slice(1)) {
      await expect(
        page.locator(`[data-testid='library-challenge-${id}']`),
      ).toHaveCount(1);
    }
    // …the completed one is listed and replayable…
    const completedRow = page.locator(`[data-testid='library-challenge-${done}']`);
    await expect(completedRow).toHaveCount(1);
    await expect(completedRow).toHaveAttribute("data-completed", "true");

    // …and everything else is one quiet line, not a wall of locks.
    const rows = await page.locator("[data-testid^='library-challenge-']").count();
    expect(rows).toBe(assigned.length);
    await expect(page.locator("[data-testid='library-upcoming']")).toHaveCount(1);
    // ⛔ No catalogue count anywhere on this page either.
    await expect(page.locator("[data-testid='library-upcoming']")).not.toContainText(
      /\d/,
    );
  });

  /* ── FLOW H — the separation still holds ────────────────────────────── */
  test("Flow H: Exercises is lane-1 only, with no mini-game rows and no pin", async ({
    page,
  }) => {
    await page.goto("/exercises?piece=rook", { waitUntil: "load" });
    await page.waitForSelector("[data-testid='piece-chip-trigger']");
    await page.click("[data-testid='piece-chip-trigger']");
    await page.waitForSelector("[role='dialog']");

    const drawer = page.locator("[role='dialog']").first();
    // Lane-2 titles must not appear on the path in LEARN.
    for (const title of ["Two Roads", "Dead End", "Rook Run", "Two Turns"]) {
      await expect(drawer).not.toContainText(title);
    }
    await page.keyboard.press("Escape");

    /* ⛔ And the contextual pin is gone too. It opened the next unlocked lane
       node with source `automatic` — NOT the daily assignment — so a capped
       player could have walked into a fourth challenge from inside Exercises,
       straight past the window. */
    await expect(
      page.getByRole("button", { name: /Enter Labyrinth/i }),
    ).toHaveCount(0);
  });
});
