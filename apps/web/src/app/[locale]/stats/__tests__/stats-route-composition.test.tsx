/**
 * The route composes two SIBLINGS, each with its own cache.
 *
 * The page's snapshot keys on (surface, container); the census keys on one
 * global entry. Folding the census into the filtered snapshot would store an
 * identical copy per filter combination and let two views of the same page hold
 * censuses from different hours — which is why the loader takes no arguments at
 * all, and why nothing derived from the URL may reach it.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §4.0, §7 stage 6
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const getPublicStats = vi.hoisted(() => vi.fn());
const loadPlayersCensus = vi.hoisted(() => vi.fn());
const statsPageSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stats/public-aggregator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stats/public-aggregator")>();
  return { ...actual, getPublicStats };
});

vi.mock("@/lib/stats/players-census", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stats/players-census")>();
  return { ...actual, loadPlayersCensus };
});

vi.mock("@/components/stats/stats-page", () => ({
  StatsPage: (props: unknown) => {
    statsPageSpy(props);
    return null;
  },
}));

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

vi.mock("next-intl/server", () => ({
  // `nicknameTokensFromTranslator` calls both `t(key)` and `t.raw(key)`, so the
  // stub needs the `.raw` companion or the route dies before it composes.
  getTranslations: vi.fn(async () => {
    const t = (key: string) => key;
    t.raw = (key: string) => key;
    return t;
  }),
}));

import StatsRoute from "../page";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/public-aggregator";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";

const CENSUS = {
  rows: [],
  total: 17,
  rowsRead: "ok" as const,
  asOf: "2026-07-30T10:30:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  getPublicStats.mockResolvedValue(EMPTY_PUBLIC_STATS);
  loadPlayersCensus.mockResolvedValue(CENSUS);
});

afterEach(cleanup);

/** The route is an async Server Component: awaiting it only runs the data
 *  phase. The tree has to be rendered for the props to reach the page. */
async function renderRoute(searchParams: Record<string, string> = {}) {
  render(await StatsRoute({ searchParams }));
}

describe("sibling composition", () => {
  it("loads the census with no arguments at all", async () => {
    await renderRoute({ surface: "learn", container: "minipay" });

    expect(loadPlayersCensus).toHaveBeenCalledTimes(1);
    expect(loadPlayersCensus).toHaveBeenCalledWith();
  });

  it("passes no URL-derived value into the census loader", async () => {
    // The filters go to the page snapshot and nowhere else. If one ever
    // reaches this call, the census has stopped being one shared read.
    await renderRoute({ surface: "play", container: "browser" });

    const args = loadPlayersCensus.mock.calls[0];
    expect(args).toHaveLength(0);
    expect(getPublicStats).toHaveBeenCalledWith({
      surface: "play",
      container: "browser",
    });
  });

  it("hands the census to the page as its own prop, not nested in stats", async () => {
    await renderRoute();

    const props = statsPageSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(props.census).toEqual(CENSUS);
    expect(props.stats).not.toHaveProperty("playersFull");
    expect(props.stats).not.toHaveProperty("playersTotal");
  });
});

describe("siblings degrade independently", () => {
  it("still renders the page when the census is unavailable", async () => {
    loadPlayersCensus.mockResolvedValue(EMPTY_PLAYERS_CENSUS);

    await renderRoute();

    expect(statsPageSpy).toHaveBeenCalledTimes(1);
    const props = statsPageSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(props.stats).toBeDefined();
  });

  it("still loads the census when the page snapshot came back empty", async () => {
    getPublicStats.mockResolvedValue(EMPTY_PUBLIC_STATS);

    await renderRoute();

    expect(loadPlayersCensus).toHaveBeenCalledTimes(1);
  });
});
