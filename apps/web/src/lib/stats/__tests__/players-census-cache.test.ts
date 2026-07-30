/**
 * The census cache — its own entry, and one frozen unit.
 *
 * Two properties are load-bearing and neither is observable from the shape of
 * the data:
 *
 * 1. The key carries NO filters. The census is global by design, so folding it
 *    into the page's `(surface, container)` entry would duplicate it
 *    identically per combination and let two views hold snapshots from
 *    different hours.
 * 2. Rows and total are cached TOGETHER. They are read independently, but if
 *    they were cached separately the table could show 17 rows under a total of
 *    18 — an inconsistency inside a single view. F1 accepts drift against the
 *    live Leaders hero; it does not accept drift inside this table.
 *
 * `unstable_cache` throws "incrementalCache missing" outside a Next request
 * (see app/api/scores/save/__tests__/route.test.ts), so vitest has no real
 * cache to poison. A test written against it directly would pass green over a
 * memoizer that never memoizes. Hence the injected factory below, which is a
 * real memoizer keyed by the key array.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §4.2, §7 stage 3
 */
import { describe, expect, it, vi } from "vitest";

import {
  PLAYERS_CENSUS_CACHE_KEY,
  PLAYERS_CENSUS_REVALIDATE_SECONDS,
  createPlayersCensusLoader,
  type CensusCacheFactory,
  type PlayersCensus,
} from "../players-census";

/** A real memoizer keyed by the key array — what `unstable_cache` does, minus
 *  the Next request context the test process cannot provide. */
function recordingCache() {
  const store = new Map<string, PlayersCensus>();
  const seen: { keyParts: string[]; options: { revalidate: number } }[] = [];

  const factory: CensusCacheFactory = (read, keyParts, options) => {
    seen.push({ keyParts, options });
    return async () => {
      const k = JSON.stringify(keyParts);
      const hit = store.get(k);
      if (hit) return hit;
      const fresh = await read();
      store.set(k, fresh);
      return fresh;
    };
  };

  return { factory, seen };
}

function census(total: number | null, rowCount: number): PlayersCensus {
  return {
    rows: Array.from({ length: rowCount }, (_, i) => ({
      rank: i + 1,
      rowId: `id_${i}`,
      variant: { piece: "rook", style: "blue", number: i } as never,
      totalScore: 100 - i,
      isVerified: false,
      hasOnchain: false,
    })),
    total,
    rowsRead: "ok",
  };
}

describe("cache key", () => {
  it("is the census key, with nothing else in it", () => {
    const { factory, seen } = recordingCache();

    createPlayersCensusLoader(factory, async () => census(17, 17));

    expect(seen).toHaveLength(1);
    expect(seen[0].keyParts).toEqual([...PLAYERS_CENSUS_CACHE_KEY]);
  });

  it("carries no filter value of any kind", () => {
    // The page's own snapshot keys on (surface, container). If any of those
    // values reaches this key, the census has been folded into the filtered
    // entry and stops being one shared read.
    //
    // Compared part-by-part, NOT as a substring of the joined key: "play" is a
    // substring of "stats-players-census", and a substring assertion here fails
    // on a key that is perfectly correct.
    const { factory, seen } = recordingCache();

    createPlayersCensusLoader(factory, async () => census(17, 17));

    const filterValues = ["learn", "play", "minipay", "browser", "all"];
    expect(seen[0].keyParts.filter((part) => filterValues.includes(part))).toEqual(
      [],
    );
  });

  it("revalidates hourly, like the rest of the page", () => {
    const { factory, seen } = recordingCache();

    createPlayersCensusLoader(factory, async () => census(17, 17));

    expect(seen[0].options.revalidate).toBe(PLAYERS_CENSUS_REVALIDATE_SECONDS);
    expect(PLAYERS_CENSUS_REVALIDATE_SECONDS).toBe(3600);
  });
});

describe("one frozen unit", () => {
  it("reads once no matter how many consumers ask", async () => {
    const { factory } = recordingCache();
    const read = vi.fn(async () => census(17, 17));

    const load = createPlayersCensusLoader(factory, read);
    await load();
    await load();
    await load();

    expect(read).toHaveBeenCalledTimes(1);
  });

  it("never serves rows from one snapshot with a total from another", async () => {
    // The underlying reads move between calls. Whatever a consumer gets, the
    // rows and the total must have been taken in the same breath.
    const { factory } = recordingCache();
    let call = 0;
    const read = vi.fn(async () => {
      call += 1;
      return call === 1 ? census(17, 17) : census(18, 18);
    });

    const load = createPlayersCensusLoader(factory, read);
    const first = await load();
    const second = await load();

    expect(first.total).toBe(first.rows.length);
    expect(second.total).toBe(second.rows.length);
    expect(second).toBe(first);
  });

  it("composes a partial failure BEFORE caching, and caches the composite", async () => {
    // The independent-failure logic runs inside the cached read, so what gets
    // stored is one already-resolved answer rather than two halves that a
    // later consumer could re-pair differently.
    const { factory } = recordingCache();
    const read = vi.fn(async (): Promise<PlayersCensus> => {
      const composed = census(null, 3);
      return { ...composed, rowsRead: "ok" };
    });

    const load = createPlayersCensusLoader(factory, read);
    const first = await load();
    const second = await load();

    expect(first.total).toBeNull();
    expect(first.rows).toHaveLength(3);
    expect(second).toBe(first);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("isolation from the page's filtered cache", () => {
  it("takes no arguments, so no filter can reach it", () => {
    // Structural, not behavioural: a loader that accepted filters could be
    // called with them, and someone would.
    const { factory } = recordingCache();

    const load = createPlayersCensusLoader(factory, async () => census(17, 17));

    expect(load.length).toBe(0);
  });

  it("gives every caller the same entry, whatever page they came from", async () => {
    const { factory } = recordingCache();
    const read = vi.fn(async () => census(17, 17));

    // Two loaders built over the SAME cache — as two requests with different
    // filters would be. They must land on one entry, not two.
    const a = createPlayersCensusLoader(factory, read);
    const b = createPlayersCensusLoader(factory, read);
    await a();
    await b();

    expect(read).toHaveBeenCalledTimes(1);
  });
});
