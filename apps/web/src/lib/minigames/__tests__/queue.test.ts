import { describe, expect, it } from "vitest";
import { defaultMiniGamePools } from "@/lib/minigames/catalog";
import {
  FEATURED_LIMIT,
  resolveChallengePool,
  resolveConsumptionPolicy,
  resolveFeaturedChallenges,
  resolveLibrary,
} from "@/lib/minigames/queue";

const pools = defaultMiniGamePools();
const pool = resolveChallengePool(pools);

const ids = (queue: { items: readonly { challengeId: string }[] }) =>
  queue.items.map((entry) => entry.challengeId);
const engines = (queue: { items: readonly { engineId: string }[] }) =>
  queue.items.map((entry) => entry.engineId);

const featured = (completed: readonly string[] = []) =>
  resolveFeaturedChallenges({
    pool,
    completedChallengeIds: new Set(completed),
    limit: FEATURED_LIMIT,
  });

/* ⚠️ NOTHING here pins an authored title or a specific challenge id as an
 * expected VALUE. The pool is read and the expectations are derived from it,
 * so renaming a level or reordering the catalog in the builder cannot turn
 * this suite red for a content reason. */

describe("R-1 — a fresh account gets three different engines", () => {
  it("returns exactly the limit", () => {
    expect(featured().items).toHaveLength(FEATURED_LIMIT);
  });

  it("uses three distinct engines", () => {
    const set = new Set(engines(featured()));
    expect(set.size).toBe(FEATURED_LIMIT);
  });

  it("is not exhausted and reports the true pool size", () => {
    const queue = featured();
    expect(queue.exhausted).toBe(false);
    expect(queue.completedCount).toBe(0);
    expect(queue.poolSize).toBe(pool.length);
  });
});

describe("R-2 — completing one challenge advances exactly one", () => {
  it("replaces the completed entry and keeps the other two", () => {
    const first = featured();
    const done = ids(first)[0]!;
    const next = featured([done]);

    expect(next.items).toHaveLength(FEATURED_LIMIT);
    expect(ids(next)).not.toContain(done);
    // The two untouched cards must not move: a player who cleared one card
    // should not find the other two shuffled underneath them.
    expect(ids(next)).toEqual(expect.arrayContaining(ids(first).slice(1)));
    const fresh = ids(next).filter((id) => !ids(first).includes(id));
    expect(fresh).toHaveLength(1);
  });

  it("reveals exactly one previously-unseen challenge per completion", () => {
    const seen = new Set<string>(ids(featured()));
    let completed: string[] = [];
    for (let round = 0; round < 6; round += 1) {
      const queue = featured(completed);
      const fresh = ids(queue).filter((id) => !seen.has(id));
      // Round 0 is the opening set, already in `seen`; every later round may
      // surface at most the single card that replaced the one just completed.
      expect(fresh.length).toBeLessThanOrEqual(1);
      if (round > 0) expect(fresh).toHaveLength(queue.exhausted ? 0 : 1);
      for (const id of ids(queue)) seen.add(id);
      completed = [...completed, ids(queue)[0]!];
    }
  });
});

describe("R-3 — replay does not advance the queue", () => {
  it("is unchanged when an already-completed id is completed again", () => {
    const done = ids(featured())[0]!;
    const once = featured([done]);
    // A replay writes the same completion key again; the SET is the queue's
    // only input, so a second completion of the same id cannot be a second
    // consumption by construction.
    const twice = featured([done, done]);
    expect(ids(twice)).toEqual(ids(once));
    expect(twice.completedCount).toBe(once.completedCount);
  });

  it("counts distinct completions, not completion events", () => {
    expect(featured(["x", "x", "x"]).completedCount).toBe(0);
  });
});

describe("R-4 — deterministic", () => {
  it("returns the same result for the same completion set", () => {
    const completed = ids(featured()).slice(0, 2);
    const a = featured(completed);
    const b = featured(completed);
    expect(ids(a)).toEqual(ids(b));
  });

  it("does not depend on the ORDER completions arrived in", () => {
    const opening = ids(featured());
    const forwards = featured([opening[0]!, opening[1]!]);
    const backwards = featured([opening[1]!, opening[0]!]);
    expect(ids(forwards)).toEqual(ids(backwards));
  });

  it("is stable across 25 identical calls", () => {
    const completed = ids(featured()).slice(0, 1);
    const first = ids(featured(completed));
    for (let i = 0; i < 25; i += 1) expect(ids(featured(completed))).toEqual(first);
  });
});

describe("R-5 — no duplicate challenge ids", () => {
  it("never repeats an id inside one visible set, at any completion depth", () => {
    let completed: string[] = [];
    for (let round = 0; round <= pool.length; round += 1) {
      const queue = featured(completed);
      expect(new Set(ids(queue)).size).toBe(queue.items.length);
      const next = ids(queue)[0];
      if (next) completed = [...completed, next];
    }
  });
});

describe("R-6 — engine variety while alternatives exist", () => {
  it("never repeats an engine while an unseen challenge from another exists", () => {
    let completed: string[] = [];
    for (let round = 0; round < pool.length; round += 1) {
      const queue = featured(completed);
      if (queue.exhausted) break;
      const unseenEngines = new Set(
        pool.filter((e) => !completed.includes(e.challengeId)).map((e) => e.engineId),
      );
      const shown = engines(queue);
      if (unseenEngines.size >= shown.length) {
        expect(new Set(shown).size).toBe(shown.length);
      }
      completed = [...completed, ids(queue)[0]!];
    }
  });

  it("still fills the set when only one engine has content left", () => {
    // Complete everything except one engine's challenges.
    const survivor = pool[0]!.engineId;
    const completed = pool
      .filter((entry) => entry.engineId !== survivor)
      .map((entry) => entry.challengeId);
    const queue = featured(completed);
    const remaining = pool.length - completed.length;
    // Variety is a preference, not a cap: it must not starve the set.
    expect(queue.items.length).toBe(Math.min(FEATURED_LIMIT, remaining));
    expect(queue.exhausted).toBe(false);
  });
});

describe("R-7 — an exhausted pool is an intentional state", () => {
  const all = pool.map((entry) => entry.challengeId);

  it("is flagged exhausted, not empty", () => {
    const queue = featured(all);
    expect(queue.exhausted).toBe(true);
    // ⛔ An empty items array would make the Learn Home group render NOTHING
    // (the section returns null on zero cards), so "you cleared everything"
    // would look identical to "mini-games are gone".
    expect(queue.items).toHaveLength(FEATURED_LIMIT);
  });

  it("offers replays, and none of them is flagged unseen", () => {
    const queue = featured(all);
    for (const entry of queue.items) {
      expect(all).toContain(entry.challengeId);
      expect(entry.unseen).toBe(false);
    }
  });

  it("reports the full completion count", () => {
    const queue = featured(all);
    expect(queue.completedCount).toBe(pool.length);
    expect(queue.poolSize).toBe(pool.length);
  });

  it("marks unseen challenges as unseen while any remain", () => {
    expect(featured().items.every((entry) => entry.unseen)).toBe(true);
  });
});

describe("R-8 — the Library holds everything, completed included", () => {
  const library = resolveLibrary(pools);

  it("lists every healthy challenge exactly once", () => {
    const flat = library.groups.flatMap((group) => group.challenges);
    expect(flat).toHaveLength(pool.length);
    expect(new Set(flat.map((c) => c.challengeId)).size).toBe(pool.length);
  });

  it("keeps a completed challenge listed", () => {
    const done = pool[0]!.challengeId;
    const after = resolveLibrary(pools, new Set([done]));
    const flat = after.groups.flatMap((group) => group.challenges);
    expect(flat.map((c) => c.challengeId)).toContain(done);
    expect(flat.find((c) => c.challengeId === done)?.completed).toBe(true);
  });

  it("groups by engine and never emits an empty group", () => {
    for (const group of library.groups) {
      expect(group.challenges.length).toBeGreaterThan(0);
    }
  });
});

describe("R-9 — no global rotation decides what is featured", () => {
  it("derives the visible set from completions alone", () => {
    // Two accounts with different histories must see different sets; under the
    // old model both saw ACTIVE_ROTATION_ID's three ids regardless.
    const a = ids(featured());
    const b = ids(featured(a));
    expect(a).not.toEqual(b);
  });

  it("reads no calendar and no rotation constant", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/lib/minigames/queue.ts"), "utf8")
      // Comments are stripped first: this is a claim about the CODE, and the
      // module's own header documents the ban by naming the things it bans.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/ACTIVE_ROTATION_ID|MINIGAME_ROTATIONS|new Date|Date\.now/);
  });
});

describe("consumption policy — the future paywall seam", () => {
  it("is unrestricted today and encodes no limit", () => {
    const policy = resolveConsumptionPolicy({});
    expect(policy.unrestricted).toBe(true);
    expect(policy.policy).toBe("early_access_free");
    expect(policy.featuredLimit).toBe(FEATURED_LIMIT);
  });

  it("declares no daily cap, no price and no reset window", () => {
    expect(Object.keys(resolveConsumptionPolicy({})).sort()).toEqual([
      "featuredLimit",
      "policy",
      "unrestricted",
    ]);
  });
});
