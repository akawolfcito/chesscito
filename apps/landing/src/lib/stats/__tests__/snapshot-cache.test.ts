/**
 * The snapshot cache: key, tag, TTL, reuse and invalidation.
 *
 * ⚠️ Tested through an INJECTED memoizer, not through `unstable_cache`.
 * `unstable_cache` throws "incrementalCache missing" outside a Next request, so
 * a test written straight against it would pass green over a memoizer that
 * never memoizes — the exact failure the `CacheFactory` seam exists to prevent.
 * The fake below really stores by key and really counts reads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CENSUS_KEY_PARTS,
  createCensusLoader,
  createSnapshotLoader,
  snapshotKeyParts,
  STATS_CACHE_TAG,
  STATS_REVALIDATE_SECONDS,
  type CacheFactory,
} from "../snapshot";
import type { StatsFilters } from "../filters";

/**
 * A memoizer with the shape of `unstable_cache`, plus observability.
 *
 * The factory is GENERIC over its payload — one fake instance backs both the
 * snapshot loader and the census loader, which is what lets a test assert they
 * land on two different keys under the same tag.
 */
function makeCache() {
  const store = new Map<string, unknown>();
  const recorded: Array<{ key: string; tags: string[]; revalidate: number }> = [];
  let reads = 0;

  const factory = (<T,>(
    read: (...args: never[]) => Promise<T>,
    keyParts: string[],
    options: { revalidate: number; tags: string[] },
  ) => {
    const key = keyParts.join("::");
    recorded.push({ key, tags: options.tags, revalidate: options.revalidate });
    return async () => {
      if (store.has(key)) return store.get(key) as T;
      reads += 1;
      const value = await (read as () => Promise<T>)();
      store.set(key, value);
      return value;
    };
  }) as unknown as CacheFactory<never>;

  return {
    factory,
    recorded,
    get reads() {
      return reads;
    },
    entries: () => [...store.keys()],
    /** What `revalidateTag` does: drop every entry carrying the tag. */
    invalidateTag(tag: string) {
      for (const r of recorded) {
        if (r.tags.includes(tag)) store.delete(r.key);
      }
    },
  };
}

const F = (surface: StatsFilters["surface"], container: StatsFilters["container"]) =>
  ({ surface, container }) as StatsFilters;

let snapshotReads = 0;
const fakeSnapshot = async () => {
  snapshotReads += 1;
  return {
    stats: { generatedAt: `read-${snapshotReads}` },
    breakdown: { learn: null, play: null, total: null },
  } as never;
};

beforeEach(() => {
  snapshotReads = 0;
});

describe("the key", () => {
  it("is surface and container, under the public-stats prefix", () => {
    expect(snapshotKeyParts(F("learn", "minipay"))).toEqual([
      "public-stats",
      "learn",
      "minipay",
    ]);
  });

  it("carries NOTHING else — no locale, no timestamp", () => {
    const parts = snapshotKeyParts(F("all", "all"));
    expect(parts).toHaveLength(3);
    expect(parts.join(" ")).not.toMatch(/\b(en|es|locale)\b/);
  });

  it("the census key carries no filters at all", () => {
    // The census is global; folding filters in would store the same payload
    // once per combination and let two views hold different hours of it.
    expect([...CENSUS_KEY_PARTS]).toEqual(["public-stats", "census"]);
  });
});

describe("reuse", () => {
  it("the same combination inside the TTL reuses the snapshot", async () => {
    const cache = makeCache();
    const load = () => createSnapshotLoader(cache.factory as never, F("all", "all"), fakeSnapshot)();

    const first = await load();
    const second = await load();

    expect(snapshotReads).toBe(1);
    expect(cache.reads).toBe(1);
    expect(second).toBe(first);
  });

  it("a DIFFERENT combination produces another entry", async () => {
    const cache = makeCache();
    await createSnapshotLoader(cache.factory as never, F("learn", "all"), fakeSnapshot)();
    await createSnapshotLoader(cache.factory as never, F("play", "all"), fakeSnapshot)();
    await createSnapshotLoader(cache.factory as never, F("learn", "minipay"), fakeSnapshot)();

    expect(snapshotReads).toBe(3);
    expect(cache.entries().sort()).toEqual([
      "public-stats::learn::all",
      "public-stats::learn::minipay",
      "public-stats::play::all",
    ]);
  });

  it("both surface AND container take part in the key", async () => {
    const cache = makeCache();
    await createSnapshotLoader(cache.factory as never, F("play", "minipay"), fakeSnapshot)();
    await createSnapshotLoader(cache.factory as never, F("play", "browser"), fakeSnapshot)();
    expect(cache.entries()).toHaveLength(2);
  });

  it("en and es with the same filters hit the SAME entry", async () => {
    // Locale is formatting. Two languages must not hold two photos of the same
    // moment — they render the one snapshot differently.
    const cache = makeCache();
    const load = () => createSnapshotLoader(cache.factory as never, F("all", "all"), fakeSnapshot)();
    await load(); // an "en" request
    await load(); // an "es" request — same filters
    expect(snapshotReads).toBe(1);
    expect(cache.entries()).toEqual(["public-stats::all::all"]);
  });
});

describe("tag and TTL", () => {
  it("registers exactly the public-stats tag", async () => {
    const cache = makeCache();
    await createSnapshotLoader(cache.factory as never, F("all", "all"), fakeSnapshot)();
    expect(cache.recorded[0].tags).toEqual(["public-stats"]);
    expect(STATS_CACHE_TAG).toBe("public-stats");
  });

  it("never registers the content tag", async () => {
    // ⛔ `"content"` is the puzzle catalogue and already caused a false green.
    const cache = makeCache();
    await createSnapshotLoader(cache.factory as never, F("all", "all"), fakeSnapshot)();
    await createCensusLoader(cache.factory as never, async () => ({}) as never)();
    for (const r of cache.recorded) expect(r.tags).not.toContain("content");
  });

  it("uses a 900 second floor", () => {
    expect(STATS_REVALIDATE_SECONDS).toBe(900);
  });

  it("the census carries the same tag, so one call refreshes both", async () => {
    const cache = makeCache();
    await createCensusLoader(cache.factory as never, async () => ({}) as never)();
    expect(cache.recorded[0].tags).toEqual(["public-stats"]);
    expect(cache.recorded[0].revalidate).toBe(900);
  });
});

describe("invalidation", () => {
  it("forces a fresh read on the next request", async () => {
    const cache = makeCache();
    const load = () => createSnapshotLoader(cache.factory as never, F("all", "all"), fakeSnapshot)();

    await load();
    await load();
    expect(snapshotReads).toBe(1);

    cache.invalidateTag("public-stats");

    const after = await load();
    expect(snapshotReads).toBe(2);
    expect((after as { stats: { generatedAt: string } }).stats.generatedAt).toBe("read-2");
  });

  it("clears every filter combination, not just one", async () => {
    const cache = makeCache();
    await createSnapshotLoader(cache.factory as never, F("learn", "all"), fakeSnapshot)();
    await createSnapshotLoader(cache.factory as never, F("play", "all"), fakeSnapshot)();
    expect(cache.entries()).toHaveLength(2);

    cache.invalidateTag("public-stats");
    expect(cache.entries()).toHaveLength(0);
  });
});

describe("what a cache HIT costs", () => {
  it("zero RPCs, zero on-chain queries, zero census reads", async () => {
    const cache = makeCache();
    let censusReads = 0;
    const loadSnapshot = () =>
      createSnapshotLoader(cache.factory as never, F("all", "all"), fakeSnapshot)();
    const loadCensus = () =>
      createCensusLoader(cache.factory as never, async () => {
        censusReads += 1;
        return {} as never;
      })();

    await loadSnapshot();
    await loadCensus();
    expect(snapshotReads).toBe(1);
    expect(censusReads).toBe(1);

    // Second render of the same page: nothing underneath is touched.
    await loadSnapshot();
    await loadCensus();
    expect(snapshotReads).toBe(1);
    expect(censusReads).toBe(1);
  });
});

describe("a degraded snapshot caches like any other", () => {
  it("keeps its nulls and its generatedAt instead of retrying on every view", async () => {
    // Bypassing the cache on failure trades a stale table for a retry storm
    // against a database that is already unwell. The view shows the age, so a
    // stuck snapshot is visible rather than silent.
    const cache = makeCache();
    let reads = 0;
    const failing = async () => {
      reads += 1;
      return {
        stats: {
          installs: null,
          generatedAt: "2026-08-05T00:00:00.000Z",
          dataIntegrity: { failedRpcs: ["stats_install_counts"] },
        },
        breakdown: { learn: null, play: null, total: null },
      } as never;
    };

    const load = () => createSnapshotLoader(cache.factory as never, F("all", "all"), failing)();
    const a = (await load()) as never as {
      stats: { installs: null; generatedAt: string; dataIntegrity: { failedRpcs: string[] } };
    };
    const b = (await load()) as never as typeof a;

    expect(reads).toBe(1);
    expect(a.stats.installs).toBeNull();
    expect(b.stats.installs).toBeNull(); // still null, NOT 0
    expect(b.stats.generatedAt).toBe("2026-08-05T00:00:00.000Z"); // age is visible
    expect(b.stats.dataIntegrity.failedRpcs).toEqual(["stats_install_counts"]);
  });
});

describe("the census keeps its own clock", () => {
  it("is a separate entry from every snapshot", async () => {
    const cache = makeCache();
    await createSnapshotLoader(cache.factory as never, F("all", "all"), fakeSnapshot)();
    await createCensusLoader(cache.factory as never, async () => ({ asOf: "own" }) as never)();

    expect(cache.entries().sort()).toEqual([
      "public-stats::all::all",
      "public-stats::census",
    ]);
  });

  it("stamps its own asOf, not the page's generatedAt", async () => {
    const cache = makeCache();
    const census = (await createCensusLoader(
      cache.factory as never,
      async () => ({ asOf: "census-clock", total: null, rows: [], rowsRead: "unavailable" }) as never,
    )()) as never as { asOf: string; total: number | null };

    expect(census.asOf).toBe("census-clock");
    // A failed rows read must not invent a total.
    expect(census.total).toBeNull();
  });
});
