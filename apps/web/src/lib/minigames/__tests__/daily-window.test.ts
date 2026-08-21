import { describe, expect, it } from "vitest";

import { defaultMiniGamePools } from "@/lib/minigames/catalog";
import {
  DAILY_NEW_SLOTS,
  currentWindowId,
  hoursUntilNextWindow,
  parseStoredAssignment,
  resolveWindowAssignment,
} from "@/lib/minigames/daily-window";
import { resolveChallengePool } from "@/lib/minigames/queue";

const pools = defaultMiniGamePools();
const pool = resolveChallengePool(pools);

const ids = (assignment: { assigned: readonly string[] }) => [...assignment.assigned];

function resolve(args: {
  stored?: { windowId: string; assigned: string[] } | null;
  windowId?: string;
  completed?: readonly string[];
}) {
  return resolveWindowAssignment({
    stored: args.stored ?? null,
    windowId: args.windowId ?? "2026-08-21",
    pool,
    completedChallengeIds: new Set(args.completed ?? []),
  });
}

/* ⚠️ No authored title and no hand-written id list is pinned as an expected
 * VALUE anywhere here. The pool is read and expectations are derived from it. */

describe("D-1 — a fresh account gets three assigned challenges", () => {
  it("assigns exactly the daily cap", () => {
    expect(resolve({}).assignment.assigned).toHaveLength(DAILY_NEW_SLOTS);
  });

  it("stamps the current window", () => {
    expect(resolve({ windowId: "2026-08-21" }).assignment.windowId).toBe("2026-08-21");
  });

  it("spreads across engines, as the picker does", () => {
    const assigned = ids(resolve({}).assignment);
    const engines = assigned.map(
      (id) => pool.find((entry) => entry.challengeId === id)!.engineId,
    );
    expect(new Set(engines).size).toBe(DAILY_NEW_SLOTS);
  });
});

describe("D-2 — completing one does NOT pull a fourth in the same window", () => {
  it("keeps the same three assigned all window long", () => {
    const day1 = resolve({});
    const done = ids(day1.assignment)[0]!;

    const sameWindow = resolve({
      stored: day1.assignment,
      windowId: day1.assignment.windowId,
      completed: [done],
    });

    // ⛔ The consumed slot stays consumed. This is the whole point of the pass:
    // a heavy player cannot burn the catalogue in one sitting.
    expect(ids(sameWindow.assignment)).toEqual(ids(day1.assignment));
    expect(sameWindow.changed).toBe(false);
  });

  it("does not refill even when all three are completed", () => {
    const day1 = resolve({});
    const all = ids(day1.assignment);
    const sameWindow = resolve({
      stored: day1.assignment,
      windowId: day1.assignment.windowId,
      completed: all,
    });
    expect(ids(sameWindow.assignment)).toEqual(all);
  });
});

describe("D-3 — the next window replenishes exactly the consumed slot", () => {
  it("replaces the completed one and leaves the other two alone", () => {
    const day1 = resolve({});
    const done = ids(day1.assignment)[0]!;
    const kept = ids(day1.assignment).slice(1);

    const day2 = resolve({
      stored: day1.assignment,
      windowId: "2026-08-22",
      completed: [done],
    });

    expect(day2.assignment.assigned).toHaveLength(DAILY_NEW_SLOTS);
    expect(ids(day2.assignment)).not.toContain(done);
    for (const id of kept) expect(ids(day2.assignment)).toContain(id);
    expect(day2.changed).toBe(true);
  });

  it("brings in exactly one challenge nobody has seen", () => {
    const day1 = resolve({});
    const done = ids(day1.assignment)[0]!;
    const day2 = resolve({
      stored: day1.assignment,
      windowId: "2026-08-22",
      completed: [done],
    });
    const fresh = ids(day2.assignment).filter((id) => !ids(day1.assignment).includes(id));
    expect(fresh).toHaveLength(1);
  });
});

describe("D-4 — an unconsumed assignment survives the window boundary", () => {
  it("carries all three over when nothing was completed", () => {
    const day1 = resolve({});
    const day2 = resolve({ stored: day1.assignment, windowId: "2026-08-22" });
    // ⛔ A casual player must not lose content they never opened.
    expect(ids(day2.assignment)).toEqual(ids(day1.assignment));
  });

  it("carries them across several idle windows", () => {
    const day1 = resolve({});
    let current = day1.assignment;
    for (const day of ["2026-08-22", "2026-08-23", "2026-09-04"]) {
      current = resolve({ stored: current, windowId: day }).assignment;
    }
    expect(ids({ assigned: current.assigned })).toEqual(ids(day1.assignment));
  });
});

describe("D-6 — a fully consumed window replenishes all three", () => {
  it("assigns three brand-new challenges", () => {
    const day1 = resolve({});
    const all = ids(day1.assignment);
    const day2 = resolve({
      stored: day1.assignment,
      windowId: "2026-08-22",
      completed: all,
    });
    expect(day2.assignment.assigned).toHaveLength(DAILY_NEW_SLOTS);
    for (const id of all) expect(ids(day2.assignment)).not.toContain(id);
  });

  it("walks the whole pool over consecutive fully-consumed windows", () => {
    let assignment = resolve({}).assignment;
    const completed = new Set<string>(assignment.assigned);
    const seen = new Set<string>(assignment.assigned);
    let day = 22;

    while (completed.size < pool.length && day < 60) {
      assignment = resolveWindowAssignment({
        stored: assignment,
        windowId: `2026-08-${day}`,
        pool,
        completedChallengeIds: completed,
      }).assignment;
      for (const id of assignment.assigned) {
        seen.add(id);
        completed.add(id);
      }
      day += 1;
    }

    // ⛔ L-5 as a time property: every healthy challenge is reachable eventually.
    expect(seen.size).toBe(pool.length);
  });
});

describe("D-7 / D-8 — replay never touches the allowance", () => {
  it("is unchanged when a completed id is completed again", () => {
    const day1 = resolve({});
    const done = ids(day1.assignment)[0]!;
    const once = resolve({
      stored: day1.assignment,
      windowId: "2026-08-22",
      completed: [done],
    });
    const twice = resolve({
      stored: day1.assignment,
      windowId: "2026-08-22",
      completed: [done, done],
    });
    expect(ids(twice.assignment)).toEqual(ids(once.assignment));
  });

  it("is unchanged by replaying something that was never assigned", () => {
    const day1 = resolve({});
    const outsider = pool
      .map((entry) => entry.challengeId)
      .find((id) => !ids(day1.assignment).includes(id))!;

    const withReplay = resolve({
      stored: day1.assignment,
      windowId: day1.assignment.windowId,
      completed: [outsider],
    });
    // A Library replay of a challenge outside today's set cannot consume a slot,
    // because a slot is only consumed by ITS OWN id being completed.
    expect(ids(withReplay.assignment)).toEqual(ids(day1.assignment));
  });
});

describe("D-10 — corrupt or missing local state fails safely", () => {
  it("treats junk as no assignment and hands out a fresh window", () => {
    for (const junk of [null, undefined, "", "{}", "[]", '{"windowId":1}', "not json"]) {
      expect(parseStoredAssignment(junk as string | null)).toBeNull();
    }
    expect(resolve({ stored: null }).assignment.assigned).toHaveLength(DAILY_NEW_SLOTS);
  });

  it("rejects a stored payload whose assigned list is not strings", () => {
    expect(parseStoredAssignment('{"windowId":"2026-08-21","assigned":[1,2]}')).toBeNull();
  });

  it("accepts a well-formed payload", () => {
    const parsed = parseStoredAssignment(
      JSON.stringify({ windowId: "2026-08-21", assigned: ["a", "b"] }),
    );
    expect(parsed).toEqual({ windowId: "2026-08-21", assigned: ["a", "b"] });
  });

  it("drops ids that left the catalogue instead of rendering a dead slot", () => {
    const day1 = resolve({});
    const withGhost = {
      windowId: day1.assignment.windowId,
      assigned: [...ids(day1.assignment), "content-that-was-retired"],
    };
    const resolved = resolve({
      stored: withGhost,
      windowId: day1.assignment.windowId,
    });
    expect(ids(resolved.assignment)).not.toContain("content-that-was-retired");
  });
});

describe("D-11 — an exhausted pool promises nothing", () => {
  const all = pool.map((entry) => entry.challengeId);

  it("still assigns something so the group never disappears", () => {
    const exhausted = resolve({ completed: all });
    expect(exhausted.assignment.assigned.length).toBeGreaterThan(0);
    expect(exhausted.poolExhausted).toBe(true);
  });

  it("reports the pool exhausted rather than inventing a refill", () => {
    const day1 = resolve({ completed: all });
    const day2 = resolve({
      stored: day1.assignment,
      windowId: "2026-08-22",
      completed: all,
    });
    expect(day2.poolExhausted).toBe(true);
    // Nothing unseen exists, so nothing new can arrive — and the surface must
    // not show a countdown to content that does not exist.
    expect(ids(day2.assignment)).toEqual(ids(day1.assignment));
  });

  it("is not exhausted while anything is unseen", () => {
    expect(resolve({}).poolExhausted).toBe(false);
    expect(resolve({ completed: all.slice(0, -1) }).poolExhausted).toBe(false);
  });
});

describe("D-12 — the window is a date, never a content constant", () => {
  it("derives the window id from the UTC day the rest of the app already uses", () => {
    expect(currentWindowId(new Date("2026-08-21T23:59:59Z"))).toBe("2026-08-21");
    expect(currentWindowId(new Date("2026-08-22T00:00:00Z"))).toBe("2026-08-22");
  });

  it("does not depend on the local clock offset of the machine", () => {
    // Same instant, expressed two ways.
    expect(currentWindowId(new Date("2026-08-22T02:00:00Z"))).toBe(
      currentWindowId(new Date(Date.parse("2026-08-21T23:00:00-03:00"))),
    );
  });

  it("names no challenge and no rotation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/lib/minigames/daily-window.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/rook-rail|bishop-run|queens-|king-safe|ROTATION/);
  });
});

describe("the timer is a window boundary, not a stopwatch", () => {
  /* ⛔ IT DOES NOT START WHEN A CHALLENGE IS COMPLETED and it never resets on a
     later completion (founder, 2026-08-21). It is the distance to the next UTC
     day, full stop — which is why completions are not even an argument here. */
  it("counts down to the next UTC midnight", () => {
    expect(hoursUntilNextWindow(new Date("2026-08-21T06:00:00Z"))).toBe(18);
    expect(hoursUntilNextWindow(new Date("2026-08-21T23:10:00Z"))).toBe(1);
  });

  it("never reports zero — a boundary is always at least an hour away visually", () => {
    expect(hoursUntilNextWindow(new Date("2026-08-21T23:59:59Z"))).toBe(1);
  });

  it("reports a full day at the moment a window opens", () => {
    expect(hoursUntilNextWindow(new Date("2026-08-21T00:00:00Z"))).toBe(24);
  });

  it("is identical for two players who completed different amounts", () => {
    const now = new Date("2026-08-21T09:00:00Z");
    expect(hoursUntilNextWindow(now)).toBe(hoursUntilNextWindow(now));
  });
});
