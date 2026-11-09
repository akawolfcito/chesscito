/**
 * Slice 2C — the weekly tab (UI-1 … UI-18).
 *
 * Spec: docs/specs/2026-07-29-leaders-weekly-ui.md
 *
 * The companion file `leaderboard-sheet.test.tsx` is the FLAG-OFF contract and
 * must keep passing untouched: with the switch unset, this component renders
 * exactly what it rendered before the slice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeaderboardSheet } from "../leaderboard-sheet";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const accountState: { address?: string; isConnected: boolean } = {
  address: undefined,
  isConnected: false,
};

vi.mock("wagmi", () => ({ useAccount: () => accountState }));

const WALLET = "0xAAAAbbbbccccddddeeeeffff0000111122223333";
const variant = { piece: "rook", style: "golden", number: 2 } as const;

const weeklyRow = (over: Record<string, unknown> = {}) => ({
  rank: 1,
  rowId: "id_weekly_1",
  variant,
  score: 300,
  isVerified: false,
  ...over,
});

const allTimeRow = (over: Record<string, unknown> = {}) => ({
  rank: 1,
  rowId: "id_all_1",
  variant,
  score: 900,
  isVerified: false,
  hasOnchain: true,
  ...over,
});

type Payloads = {
  weekly?: unknown;
  alltime?: unknown;
  weeklyStatus?: number;
};

/** Routes by the `window` param, so a test never has to care about call order. */
function mockFetch(payloads: Payloads) {
  const calls: string[] = [];
  const spy = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("window=weekly")) {
      if (payloads.weeklyStatus && payloads.weeklyStatus >= 400) {
        return Promise.resolve({
          ok: false,
          status: payloads.weeklyStatus,
          json: async () => ({ error: "boom" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () =>
          payloads.weekly ?? {
            window: "weekly",
            rows: [],
            player: null,
            weekStart: "2026-07-27T00:00:00.000Z",
            weekEnd: "2026-08-03T00:00:00.000Z",
            surface: "learn",
          },
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: async () => payloads.alltime ?? [],
    } as Response);
  });
  global.fetch = spy as unknown as typeof fetch;
  return { spy, calls };
}

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED;

const open = (props: Record<string, unknown> = {}) =>
  render(
    <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} {...props} />,
  );

beforeEach(() => {
  accountState.address = undefined;
  accountState.isConnected = false;
  window.localStorage.clear();
  window.sessionStorage.clear();
  process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED = "true";
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_FLAG === undefined) {
    delete process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED = ORIGINAL_FLAG;
  }
  vi.clearAllMocks();
});

describe("kill switch (UI-1, UI-2)", () => {
  it("renders no tab control and issues no weekly request when OFF", async () => {
    delete process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED;
    const { spy } = mockFetch({});

    open();

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      spy.mock.calls.every(([u]) => !String(u).includes("window=weekly")),
    ).toBe(true);
  });

  it("treats any value other than the literal true as OFF", async () => {
    process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED = "1";
    mockFetch({});
    open();
    await waitFor(() =>
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument(),
    );
  });

  it("opens on the weekly tab when ON with no stored preference (UI-2)", async () => {
    mockFetch({});
    open();

    const tab = await screen.findByRole("tab", { name: /this week/i });
    await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
  });
});

describe("tab preference (UI-3)", () => {
  it("applies a stored all-time preference only AFTER hydration", async () => {
    // Deciding from unhydrated storage is the shape of an intermittent bug this
    // codebase has already hit three times: the first paint must be weekly no
    // matter what storage says.
    window.localStorage.setItem("chesscito:leaders-tab", "alltime");
    mockFetch({ alltime: [allTimeRow()] });

    open();

    const allTab = await screen.findByRole("tab", { name: /all time/i });
    await waitFor(() => expect(allTab).toHaveAttribute("aria-selected", "true"));
  });

  it("falls back to weekly on an unreadable stored value", async () => {
    window.localStorage.setItem("chesscito:leaders-tab", "monthly");
    mockFetch({});

    open();

    const weeklyTab = await screen.findByRole("tab", { name: /this week/i });
    await waitFor(() =>
      expect(weeklyTab).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("persists the tab the player picks", async () => {
    mockFetch({ alltime: [allTimeRow()] });
    const user = userEvent.setup();

    open();
    await user.click(await screen.findByRole("tab", { name: /all time/i }));

    await waitFor(() =>
      expect(window.localStorage.getItem("chesscito:leaders-tab")).toBe(
        "alltime",
      ),
    );
  });
});

describe("per-tab fetch state (UI-4, UI-5)", () => {
  it("fetches the other window once, and not again on the way back", async () => {
    const { spy } = mockFetch({ alltime: [allTimeRow()] });
    const user = userEvent.setup();

    open();
    await screen.findByRole("tab", { name: /all time/i });
    const weeklyCalls = () =>
      spy.mock.calls.filter(([u]) => String(u).includes("window=weekly")).length;
    const allCalls = () =>
      spy.mock.calls.filter(([u]) => !String(u).includes("window=weekly")).length;

    await waitFor(() => expect(weeklyCalls()).toBe(1));

    await user.click(screen.getByRole("tab", { name: /all time/i }));
    await waitFor(() => expect(allCalls()).toBe(1));

    await user.click(screen.getByRole("tab", { name: /this week/i }));
    await user.click(screen.getByRole("tab", { name: /all time/i }));

    // Both are served from state now.
    expect(weeklyCalls()).toBe(1);
    expect(allCalls()).toBe(1);
  });

  it("discards a response whose window is no longer the active one", async () => {
    // A single `hasFetched` ref cannot express per-tab state; reusing it renders
    // one tab's data under the other's header.
    let resolveWeekly: ((v: unknown) => void) | undefined;
    const spy = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("window=weekly")) {
        return new Promise((resolve) => {
          resolveWeekly = () =>
            resolve({
              ok: true,
              json: async () => ({
                window: "weekly",
                rows: [weeklyRow({ score: 4242 })],
                player: null,
                weekStart: "2026-07-27T00:00:00.000Z",
                weekEnd: "2026-08-03T00:00:00.000Z",
                surface: "learn",
              }),
            } as Response);
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [allTimeRow({ score: 900 })],
      } as Response);
    });
    global.fetch = spy as unknown as typeof fetch;
    const user = userEvent.setup();

    open();
    await user.click(await screen.findByRole("tab", { name: /all time/i }));
    await screen.findByText("900");

    // The weekly response lands late, while all-time is the active tab.
    resolveWeekly?.(undefined);
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText("4242")).not.toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
  });
});

describe("weekly rendering (UI-8, UI-9, UI-12, UI-14)", () => {
  it("renders the empty state with no champion on a fresh week", async () => {
    mockFetch({});
    open();
    expect(await screen.findByText(/just getting started/i)).toBeInTheDocument();
    expect(screen.queryByText(/champion:/i)).not.toBeInTheDocument();
  });

  it("renders a thin week as-is, with no all-time rows mixed in", async () => {
    mockFetch({
      weekly: {
        window: "weekly",
        rows: [weeklyRow({ score: 300 })],
        player: null,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
      alltime: [allTimeRow({ score: 900 })],
    });

    open();

    expect(await screen.findByText("300")).toBeInTheDocument();
    expect(screen.queryByText("900")).not.toBeInTheDocument();
  });

  it("shows a rank-11 own row in the footer while the list stays a top-10", async () => {
    accountState.address = WALLET;
    accountState.isConnected = true;
    mockFetch({
      weekly: {
        window: "weekly",
        rows: Array.from({ length: 10 }, (_, i) =>
          weeklyRow({ rank: i + 1, rowId: `id_${i}`, score: 1000 - i * 10 }),
        ),
        player: weeklyRow({ rank: 11, rowId: "id_own", score: 120 }),
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
    });

    open();

    const footer = await screen.findByTestId("leaderboard-own-row");
    expect(footer).toHaveTextContent("11");
    expect(screen.getAllByText(/^\d+$/).filter((n) => n.textContent === "11"))
      .toHaveLength(1);
  });

  it("never paints the on-chain seal on a weekly row", async () => {
    mockFetch({
      weekly: {
        window: "weekly",
        rows: [weeklyRow()],
        player: null,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
    });

    open();
    await screen.findByText("300");
    expect(screen.queryByLabelText(/saved on celo/i)).not.toBeInTheDocument();
  });
});

describe("weekly footer CTA (UI-10, UI-11)", () => {
  beforeEach(() => {
    accountState.address = WALLET;
    accountState.isConnected = true;
  });

  it("renders the CTA, not a rank, when the player has no weekly activity", async () => {
    mockFetch({});
    open();
    expect(await screen.findByText(/play to join this week/i)).toBeInTheDocument();
    expect(screen.queryByTestId("leaderboard-own-row")).not.toBeInTheDocument();
  });

  it("renders the CTA in Spanish too", async () => {
    mockFetch({});
    render(
      <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />,
      { locale: "es" },
    );
    expect(
      await screen.findByText(/juega para entrar esta semana/i),
    ).toBeInTheDocument();
  });

  it("keeps the CTA and the rank footer the same height", async () => {
    // Switching tabs must not jump the layout, so both live in the same shell.
    mockFetch({});
    open();
    const cta = await screen.findByTestId("leaderboard-weekly-cta");
    expect(cta.className).toContain("leaderboard-own-rank-footer");
  });
});

describe("refresh and rollover (UI-6, UI-7)", () => {
  it("refetches the active tab and marks the other stale", async () => {
    const { spy } = mockFetch({ alltime: [allTimeRow()] });
    const { rerender } = render(
      <LeaderboardSheet
        open
        onOpenChange={() => {}}
        showTrigger={false}
        refreshTrigger={0}
      />,
    );
    await screen.findByRole("tab", { name: /this week/i });
    const weeklyCalls = () =>
      spy.mock.calls.filter(([u]) => String(u).includes("window=weekly")).length;
    await waitFor(() => expect(weeklyCalls()).toBe(1));

    rerender(
      <LeaderboardSheet
        open
        onOpenChange={() => {}}
        showTrigger={false}
        refreshTrigger={1}
      />,
    );

    await waitFor(() => expect(weeklyCalls()).toBe(2));
  });

  it("marks the OTHER tab stale, so it refetches on activation (UI-6)", async () => {
    const { spy } = mockFetch({ alltime: [allTimeRow()] });
    const user = userEvent.setup();
    const { rerender } = render(
      <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={0} />,
    );
    const allCalls = () =>
      spy.mock.calls.filter(([u]) => !String(u).includes("window=weekly")).length;

    // Visit all-time once so it is cached, then come back to weekly.
    await user.click(await screen.findByRole("tab", { name: /all time/i }));
    await waitFor(() => expect(allCalls()).toBe(1));
    await user.click(screen.getByRole("tab", { name: /this week/i }));

    // A save lands while weekly is active.
    rerender(
      <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={1} />,
    );

    // All-time must not refetch yet — one board is on screen, one request.
    await new Promise((r) => setTimeout(r, 0));
    expect(allCalls()).toBe(1);

    // …but it is stale now, so activating it refetches instead of serving the
    // pre-save cache.
    await user.click(screen.getByRole("tab", { name: /all time/i }));
    await waitFor(() => expect(allCalls()).toBe(2));
  });

  it("replaces the rows when weekStart changes, rather than merging", async () => {
    let week = 1;
    const spy = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("window=weekly")) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      const body =
        week === 1
          ? {
              window: "weekly",
              rows: [weeklyRow({ rowId: "old", score: 111 })],
              player: null,
              weekStart: "2026-07-27T00:00:00.000Z",
              weekEnd: "2026-08-03T00:00:00.000Z",
              surface: "learn",
            }
          : {
              window: "weekly",
              rows: [weeklyRow({ rowId: "new", score: 222 })],
              player: null,
              weekStart: "2026-08-03T00:00:00.000Z",
              weekEnd: "2026-08-10T00:00:00.000Z",
              surface: "learn",
            };
      return Promise.resolve({ ok: true, json: async () => body } as Response);
    });
    global.fetch = spy as unknown as typeof fetch;

    const { rerender } = render(
      <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={0} />,
    );
    await screen.findByText("111");

    week = 2;
    rerender(
      <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={1} />,
    );

    await screen.findByText("222");
    expect(screen.queryByText("111")).not.toBeInTheDocument();
  });
});

describe("error state (UI-13)", () => {
  it("renders the error state and never a board on a 500", async () => {
    mockFetch({ weeklyStatus: 500 });
    open();
    expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
    // "The weekly board is just getting started" is a claim about the week, and
    // a failed fetch is not evidence for it.
    expect(screen.queryByText(/just getting started/i)).not.toBeInTheDocument();
  });

  it("retries only the tab that failed", async () => {
    const { spy } = mockFetch({ weeklyStatus: 500 });
    const user = userEvent.setup();

    open();
    await screen.findByText(/could not load/i);
    const before = spy.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(spy.mock.calls.length).toBe(before + 1));
    expect(String(spy.mock.calls.at(-1)?.[0])).toContain("window=weekly");
  });
});

/**
 * The hero's player count (backlog §2, seen on device 2026-07-29).
 *
 * It read `rows.length`, the size of the top-10 cut, so it announced "10
 * players" while the same player's footer read rank 13 — and on the weekly tab
 * it happened to be right only because three people had played. The figure now
 * comes from `total`, counted over the uncut relation, or it does not appear.
 */
describe("hero population (never the top-10 cut)", () => {
  const tenRows = (score = 1000) =>
    Array.from({ length: 10 }, (_, i) =>
      weeklyRow({ rank: i + 1, rowId: `id_${i}`, score: score - i * 10 }),
    );

  it("shows the population, not the row count, on the weekly tab", async () => {
    mockFetch({
      weekly: {
        window: "weekly",
        rows: tenRows(),
        player: null,
        total: 13,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
    });

    open();

    expect(await screen.findByText(/13 players/i)).toBeInTheDocument();
    expect(screen.queryByText(/10 players/i)).not.toBeInTheDocument();
  });

  it("agrees with a rank-13 footer instead of contradicting it", async () => {
    // The exact screen the founder photographed: hero "10 players", footer 13.
    accountState.address = WALLET;
    accountState.isConnected = true;
    mockFetch({
      weekly: {
        window: "weekly",
        rows: tenRows(),
        player: weeklyRow({ rank: 13, rowId: "id_own", score: 120 }),
        total: 13,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
    });

    open();

    const footer = await screen.findByTestId("leaderboard-own-row");
    expect(footer).toHaveTextContent("13");
    expect(screen.getByText(/13 players/i)).toBeInTheDocument();
  });

  it("asks for the windowed all-time shape, the only one carrying a population", async () => {
    // The legacy bare-array shape is frozen and cannot grow a `total`, so the
    // all-time tab has to request the envelope to have a number to show.
    const { calls } = mockFetch({
      alltime: {
        window: "alltime",
        rows: [allTimeRow()],
        player: null,
        total: 42,
      },
    });
    const user = userEvent.setup();

    open();
    await user.click(await screen.findByRole("tab", { name: /all time/i }));

    await waitFor(() =>
      expect(calls.some((u) => u.includes("window=alltime"))).toBe(true),
    );
    expect(await screen.findByText(/42 players/i)).toBeInTheDocument();
  });

  it("DROPS the figure when the count is absent, never falling back to rows", async () => {
    // A failed count must not resurrect the defect. Ten rows on screen and no
    // population means the line says the score and stops.
    mockFetch({
      weekly: {
        window: "weekly",
        rows: tenRows(),
        player: null,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
    });

    open();

    expect(await screen.findByText(/1000 pts/i)).toBeInTheDocument();
    expect(screen.queryByText(/players/i)).not.toBeInTheDocument();
  });

  it("renders a genuine population of 1 rather than dropping it", async () => {
    // 0 and 1 are facts; only null is unknown. A falsy check here would hide a
    // real number.
    mockFetch({
      weekly: {
        window: "weekly",
        rows: [weeklyRow({ score: 300 })],
        player: null,
        total: 1,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
    });

    open();

    expect(await screen.findByText(/1 players/i)).toBeInTheDocument();
  });

  it("keeps each tab's own population when switching", async () => {
    mockFetch({
      weekly: {
        window: "weekly",
        rows: [weeklyRow({ score: 300 })],
        player: null,
        total: 3,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
      alltime: {
        window: "alltime",
        rows: [allTimeRow({ score: 900 })],
        player: null,
        total: 13,
      },
    });
    const user = userEvent.setup();

    open();
    expect(await screen.findByText(/3 players/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /all time/i }));
    expect(await screen.findByText(/13 players/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /this week/i }));
    expect(await screen.findByText(/3 players/i)).toBeInTheDocument();
  });
});

/**
 * The list must DECLARE that it is a cut.
 *
 * Founder, 2026-07-29: with the population fixed, the hero says 17 over a list
 * of 10 and nothing on screen explains the gap — it reads as seven missing rows,
 * which makes the honest number feel like a lie. The label closes it by naming
 * both figures at once.
 *
 * It appears ONLY when the list is actually cut. Announcing "TOP 10 OF 3" on a
 * thin week would invent a cut that is not there, and claiming one while the
 * population is unknown would be a guess.
 */
describe("cut label above the list", () => {
  const rowsOf = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      weeklyRow({ rank: i + 1, rowId: `id_${i}`, score: 1000 - i * 10 }),
    );

  const weeklyPayload = (rows: unknown[], total?: number) => ({
    window: "weekly",
    rows,
    player: null,
    ...(total === undefined ? {} : { total }),
    weekStart: "2026-07-27T00:00:00.000Z",
    weekEnd: "2026-08-03T00:00:00.000Z",
    surface: "learn",
  });

  it("names the cut and the population when the board is cut", async () => {
    mockFetch({ weekly: weeklyPayload(rowsOf(10), 17) });

    open();

    expect(await screen.findByText(/top 10 of 17/i)).toBeInTheDocument();
  });

  it("stays silent when everyone ranked is already on screen", async () => {
    // Three players, three rows: there is no cut to declare, and "TOP 10 OF 3"
    // would invent one.
    mockFetch({ weekly: weeklyPayload(rowsOf(3), 3) });

    open();

    await screen.findByText("1000");
    expect(screen.queryByText(/top \d+ of/i)).not.toBeInTheDocument();
  });

  it("stays silent when the population is unknown", async () => {
    // No total means the count failed. A cut claim would be a guess, and the
    // hero is already omitting its figure for the same reason.
    mockFetch({ weekly: weeklyPayload(rowsOf(10)) });

    open();

    await screen.findByText("1000");
    expect(screen.queryByText(/top \d+ of/i)).not.toBeInTheDocument();
  });

  it("declares the cut on the all-time tab too", async () => {
    mockFetch({
      alltime: {
        window: "alltime",
        rows: Array.from({ length: 10 }, (_, i) =>
          allTimeRow({ rank: i + 1, rowId: `all_${i}`, score: 9000 - i * 10 }),
        ),
        player: null,
        total: 42,
      },
    });
    const user = userEvent.setup();

    open();
    await user.click(await screen.findByRole("tab", { name: /all time/i }));

    expect(await screen.findByText(/top 10 of 42/i)).toBeInTheDocument();
  });
});

describe("copy parity and source guards (UI-15, UI-18)", () => {
  const NEW_KEYS = [
    "tabsAriaLabel",
    "tabWeekly",
    "tabAllTime",
    "weeklyEmptyHeadline",
    "weeklyEmptyHint",
    "weeklyCtaTitle",
    "weeklyCtaHint",
  ] as const;

  it("defines every new key in EN and ES (UI-15)", async () => {
    // The ES bundle is a top-level namespace spread: overwriting a namespace
    // drops the keys it does not re-copy, and next-intl then prints the raw
    // path on screen.
    const en = (await import("@/lib/content/editorial")).LEADERBOARD_SHEET_COPY;
    const es = (await import("@/lib/content/messages/es")).default
      .LEADERBOARD_SHEET_COPY as Record<string, string>;

    for (const key of NEW_KEYS) {
      expect(en[key], `EN missing ${key}`).toBeTruthy();
      expect(es[key], `ES missing ${key}`).toBeTruthy();
      // A copy-paste of the English string is not a translation.
      expect(es[key]).not.toBe(en[key]);
    }
  });

  it("never compares an optimistic score against a row score (UI-18)", async () => {
    // A SOURCE guard, because this one is invisible to behaviour: both values
    // are `number`, so a `>=` between them type-checks, reads as correct, and
    // silently compares one exercise's score against a per-player total. No
    // rendered output would look wrong.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/components/exercises/leaderboard-sheet.tsx"),
      "utf-8",
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/optimistic\.score\s*[<>=!]/);
    expect(code).not.toMatch(/[<>=!]=?\s*optimistic\.score/);
  });
});

describe("optimistic row (UI-16, UI-17, UI-18)", () => {
  beforeEach(() => {
    accountState.address = WALLET;
    accountState.isConnected = true;
    window.sessionStorage.setItem(
      "chesscito:optimistic-score",
      JSON.stringify({ player: WALLET, score: 55, ts: Date.now() }),
    );
  });

  it("never appends the optimistic row on the weekly tab", async () => {
    mockFetch({});
    open();
    await screen.findByText(/just getting started/i);
    expect(screen.queryByText("55")).not.toBeInTheDocument();
  });

  it("clears the entry once a response contains the matching rowId", async () => {
    // Presence by rowId is the signal that already exists in this component;
    // comparing optimistic.score (one exercise) against a row's score (a
    // per-player total) would type-check and mean nothing.
    const { deriveRowId } = await import("@/lib/identity/identity-lite");
    mockFetch({
      weekly: {
        window: "weekly",
        rows: [weeklyRow({ rowId: deriveRowId(WALLET.toLowerCase()) })],
        player: null,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
    });

    open();
    await screen.findByText("300");
    await waitFor(() =>
      expect(
        window.sessionStorage.getItem("chesscito:optimistic-score"),
      ).toBeNull(),
    );
  });

  it("does not double-append after a tab switch", async () => {
    const { deriveRowId } = await import("@/lib/identity/identity-lite");
    const own = deriveRowId(WALLET.toLowerCase());
    mockFetch({
      weekly: {
        window: "weekly",
        rows: [weeklyRow({ rowId: own, score: 300 })],
        player: null,
        weekStart: "2026-07-27T00:00:00.000Z",
        weekEnd: "2026-08-03T00:00:00.000Z",
        surface: "learn",
      },
      alltime: [allTimeRow({ rowId: own, score: 900 })],
    });
    const user = userEvent.setup();

    open();
    await screen.findByText("300");
    await user.click(screen.getByRole("tab", { name: /all time/i }));
    await screen.findByText("900");

    expect(screen.queryByText("55")).not.toBeInTheDocument();
  });
});
