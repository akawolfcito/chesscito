/**
 * The daily quota gate, at the seam where it was silently off.
 *
 * WHAT THIS SUITE IS FOR
 * ----------------------
 * `isFreeSlot` (`slot === "daily" || slot === "challenge"`) used to short-circuit
 * the ONE effect that produces `quotaDisplayState`, and that state is the only
 * input to both surfaces that enforce the limit: the "great focus" banner and
 * the drawer's `quotaState`. So arriving through `?slot=daily` handed the player
 * an unlimited session for as long as the screen stayed mounted — while
 * `recordExtraConsumed`, which was NOT gated by the slot, kept spending slots
 * nobody would ever read.
 *
 * That entry is not an edge case. It is the hub's primary CTA (`hero-cta.ts:47`)
 * and the content loop's highest-priority action (`content-loop.ts:94`), so in
 * production the biggest button in the app was the one that removed the gate.
 * Measured 2026-08-05: eight wallets cleared 47–64 distinct levels in a single
 * day against a limit of five.
 *
 * WHY THE ASSERTION IS ON THE DRAWER AND NOT ON A BOOLEAN
 * ------------------------------------------------------
 * The defect was never in `session-quota.ts` — every pure helper there was
 * correct and unit-tested, and stayed green throughout. It was in which
 * component got told. Only a test that mounts the screen and reads what the
 * drawer renders can see that, which is exactly why the existing suites missed
 * it.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import {
  dailySessionStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import {
  buildContentId,
  computeRecordExtra,
  FREE_EXTRA_QUOTA,
} from "@/lib/daily/session-quota";
import { todayUtc } from "@/lib/daily/progress";
import type { Exercise } from "@/lib/game/types";

const liteMode = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/feature-flags")>();
  return {
    ...actual,
    get CHESSCITO_MODE() {
      return liteMode.value ? ("learn" as const) : ("play" as const);
    },
    get CHESSCITO_LITE_MODE() {
      return liteMode.value;
    },
    isLearnMode: () => liteMode.value,
    isPlayMode: () => !liteMode.value,
    isFullMode: () => false,
  };
});

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
  usePathname: () => "/exercises",
  redirect: (path: string) => path,
  getPathname: ({ href }: { href: string }) => href,
}));

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
}
vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);

const { ExercisesScreen } = await import("../exercises-screen");

/** Twelve reachable one-move exercises: enough pool to have an 11th and a 12th
 *  past a limit of ten, so the boundary is a real row and not the end of the
 *  list. Ids are `t-rook-N`; `N` is 1-based and matches the drawer label. */
const ROOK_POOL: Exercise[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t-rook-${i + 1}`,
  startPos: { file: 0, rank: i % 8 },
  targetPos: { file: 7, rank: i % 8 },
  optimalMoves: 1,
}));

const ROOK_LAB: Exercise = {
  id: "t-lab-1",
  startPos: { file: 3, rank: 0 },
  targetPos: { file: 3, rank: 7 },
  optimalMoves: 1,
  obstacles: [],
};

/**
 * A day in which the player solved the first `count` exercises.
 *
 * Stars and the quota ledger are seeded TOGETHER because that is the only state
 * a real session can produce: `recordExtraConsumed` fires from the same handler
 * that persists the stars. Seeding the ledger alone builds a player who spent
 * ten slots without completing anything, and the drawer's OTHER lock — the
 * linear path (`index > lastCompleted + 1`) — then hides the quota lock behind
 * itself, so the assertion would pass for the wrong reason.
 *
 * `quotaDate` exists only for the UTC-rollover case, where yesterday's ledger
 * must be discarded while the stars (which are not date-scoped) survive.
 */
function seedDay(count: number, opts: { quotaDate?: string } = {}) {
  const solved = ROOK_POOL.slice(0, count);

  const stars: Record<string, number> = {};
  for (const ex of solved) stars[ex.id] = 3;
  window.localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({ piece: "rook", currentId: null, stars }),
  );

  window.localStorage.setItem(
    dailySessionStorageKey(),
    JSON.stringify({
      date: opts.quotaDate ?? todayUtc(),
      consumedContentIds: solved.map((ex) =>
        buildContentId("exercise", "rook", ex.id),
      ),
      paidUnlocked: 0,
    }),
  );
}

function renderScreen(slot?: string, withLab = false) {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: withLab ? [ROOK_LAB] : [] },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen slot={slot} />
    </ContentCatalogProvider>,
  );
}

async function openDrawer() {
  const trigger = await screen.findByTestId("piece-chip-trigger");
  fireEvent.click(trigger);
}

/** The drawer row for pool exercise `n` (1-based), by its fallback description. */
async function row(n: number): Promise<HTMLButtonElement> {
  const label = await screen.findByText(`Exercise ${n}`);
  const button = label.closest("button");
  if (!button) throw new Error(`No drawer row for exercise ${n}`);
  return button as HTMLButtonElement;
}

function isQuotaLocked(button: HTMLButtonElement): boolean {
  return button.getAttribute("data-quota-locked") === "true";
}

beforeEach(() => {
  liteMode.value = true;
  window.localStorage.clear();
  markMilestonesSeeded();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("daily quota — the limit itself", () => {
  it("the shipped free quota is ten unique carril-1 exercises", () => {
    expect(FREE_EXTRA_QUOTA).toBe(10);
  });

  it("allows ten unique exercises and blocks the eleventh", async () => {
    // Nine solved: the tenth is still free content.
    seedDay(FREE_EXTRA_QUOTA - 1);
    renderScreen();
    await openDrawer();
    expect(isQuotaLocked(await row(10))).toBe(false);
    cleanup();

    // Ten solved: the eleventh is the first one the limit refuses.
    seedDay(FREE_EXTRA_QUOTA);
    renderScreen();
    await openDrawer();
    await waitFor(async () => expect(isQuotaLocked(await row(11))).toBe(true));
  });

  it("lets the player replay a completed exercise at the limit", async () => {
    seedDay(FREE_EXTRA_QUOTA);
    renderScreen();
    await openDrawer();
    await waitFor(async () => expect(isQuotaLocked(await row(11))).toBe(true));
    // Same screen, same limit: an exercise already earned stays open.
    expect(isQuotaLocked(await row(1))).toBe(false);
  });

  it("survives a refresh — the ledger is the source, not component state", async () => {
    seedDay(FREE_EXTRA_QUOTA);
    renderScreen();
    await openDrawer();
    await waitFor(async () => expect(isQuotaLocked(await row(11))).toBe(true));
    cleanup();

    // A remount is what a refresh is, from the ledger's point of view.
    renderScreen();
    await openDrawer();
    await waitFor(async () => expect(isQuotaLocked(await row(11))).toBe(true));
  });

  it("resets when the UTC day rolls over", async () => {
    // Yesterday's ledger, at the limit, with today's stars intact — exactly
    // what a player who returns the next morning has. `parseDailySession`
    // discards the stale ledger, so nothing is quota-locked.
    seedDay(FREE_EXTRA_QUOTA, { quotaDate: "2020-01-01" });
    renderScreen();
    await openDrawer();
    expect(isQuotaLocked(await row(11))).toBe(false);
  });

  it("counts unique ids, not completions — a repeated solve spends one slot", async () => {
    // The screen reads `getUsedCount`, which is the LENGTH of the ledger, so
    // idempotence has to hold at the write. Asserting it on the writer is the
    // honest level: a hand-built array with a duplicate is a state
    // `recordExtraConsumed` cannot produce, so testing that would prove nothing.
    const first = computeRecordExtra(
      { date: todayUtc(), consumedContentIds: [], paidUnlocked: 0 },
      buildContentId("exercise", "rook", ROOK_POOL[0].id),
    );
    const again = computeRecordExtra(
      first,
      buildContentId("exercise", "rook", ROOK_POOL[0].id),
    );
    expect(first.consumedContentIds).toHaveLength(1);
    expect(again.consumedContentIds).toHaveLength(1);
  });
});

describe("daily quota — slot no longer disables it", () => {
  it.each([
    ["no slot (direct entry)", undefined],
    ["?slot=daily (hub hero CTA + content loop)", "daily"],
    ["?slot=challenge", "challenge"],
  ])("enforces the limit on %s", async (_label, slot) => {
    seedDay(FREE_EXTRA_QUOTA);
    renderScreen(slot);
    await openDrawer();
    await waitFor(async () => expect(isQuotaLocked(await row(11))).toBe(true));
  });

  it("a daily-slot session is not unlimited — the 11th is refused there too", async () => {
    // The regression, stated as the founder found it: enter through the Daily
    // CTA and the whole session used to be free. Below the limit nothing is
    // locked; at the limit the gate holds, slot or not.
    seedDay(FREE_EXTRA_QUOTA - 1);
    renderScreen("daily");
    await openDrawer();
    expect(isQuotaLocked(await row(10))).toBe(false);
    cleanup();

    seedDay(FREE_EXTRA_QUOTA);
    renderScreen("daily");
    await openDrawer();
    await waitFor(async () => expect(isQuotaLocked(await row(11))).toBe(true));
  });
});

describe("daily quota — what it must NOT gate", () => {
  it("leaves carril 2 open at the limit", async () => {
    // Carril 2 costs no quota (`recordExtraConsumed` is only ever called with
    // kind:"exercise"), so quota cannot price it. Before the fix this node was
    // locked by a `labyrinth:` id nothing writes.
    seedDay(FREE_EXTRA_QUOTA);
    renderScreen(undefined, true);
    await openDrawer();
    await waitFor(async () => expect(isQuotaLocked(await row(11))).toBe(true));
    const lab = (await screen.findByText("Special Training 1")).closest("button");
    expect(lab).not.toHaveAttribute("data-quota-locked");
  });

  it("leaves carril 2 open below the limit too", async () => {
    seedDay(3);
    renderScreen(undefined, true);
    await openDrawer();
    const lab = (await screen.findByText("Special Training 1")).closest("button");
    expect(lab).not.toHaveAttribute("data-quota-locked");
  });

  it("does not apply in PLAY — the quota is a LEARN product", async () => {
    liteMode.value = false;
    seedDay(FREE_EXTRA_QUOTA);
    renderScreen();
    await openDrawer();
    expect(isQuotaLocked(await row(11))).toBe(false);
  });
});
