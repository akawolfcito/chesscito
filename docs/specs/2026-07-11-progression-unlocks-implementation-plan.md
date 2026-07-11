# Progression Unlocks and Celebration Queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every earned reward in LEARN fire at the moment it is earned, through one milestone machine with persisted, idempotent events and an ordered celebration queue.

**Architecture:** A pure derivation core (`lib/progression/*.ts`) computes milestone conditions from progress that is *already persisted* — no new source of truth for stars. Only *acknowledgement* is new state. Persistence precedes rendering. A React hook drains an ordered queue of at most one major celebration, and the existing overlays are re-pointed at it.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest + RTL, localStorage.

**Spec:** `docs/specs/2026-07-11-progression-unlocks-celebration-queue.md`

## Global Constraints

- Copy is authored in `lib/content/editorial.ts` and mirrored by hand in `lib/content/messages/es.ts`. **Never edit `messages/en.ts` by hand** — it is derived.
- Reward copy: ≤ 5 words, no web3 jargon. No em-dashes or en-dashes in user-facing prose.
- Never prefix a Bash call with `cd`. Use `pnpm -C <abs-path>` and `git -C <abs-path>`.
- Typecheck with a bare `pnpm exec tsc --noEmit`.
- Stars are `0..3` per exercise, sparse map keyed by `exerciseId` (`PieceProgress.stars`).
- `dailyStars` counts **net improvement over previous best**, exercises AND labyrinths.
- Labyrinth stars feed `dailyStars` but **never** `pieceStars` (circular dependency).
- `mastery` depends on `piece-badge-claimed`, never on eligibility.
- `openedAt` is written **only** on navigable milestones: `first-reward`, `first-labyrinth`, `special-training`.
- Persist the event, THEN render the overlay. Never the reverse.
- No retroactive celebration fires for a milestone a player already passed.
- Do not touch the on-chain badge semantics (soulbound, already minted on mainnet).
- Run the full suite before each commit. Baseline: 4875 passing / 404 files.

---

### Task 1: Milestone types (SDD — the contract first)

**Files:**
- Create: `apps/web/src/lib/progression/types.ts`

**Interfaces:**
- Consumes: `PieceId` from `@/lib/game/types`.
- Produces: `MilestoneId`, `MilestoneEvent`, `MilestoneStore`, `milestoneKey()`, `NAVIGABLE_MILESTONES`.

- [ ] **Step 1: Write the type module**

```ts
import type { PieceId } from "@/lib/game/types";

/** Every recognizable moment in the LEARN progression ladder.
 *  `piece-badge-eligible` is the RIGHT to claim (10 stars reached).
 *  `piece-badge-claimed` is the confirmed on-chain mint. They are two
 *  events because a badge does not exist until a transaction confirms. */
export type MilestoneId =
  | "first-reward"
  | "first-labyrinth"
  | "special-training"
  | "piece-badge-eligible"
  | "piece-badge-claimed"
  | "mastery"
  | "great-focus-session"
  | "first-great-session";

/** Milestones that lead somewhere. Only these carry `openedAt` — a Great
 *  Focus Session, a claimed badge and a mastery crown are recognitions,
 *  not destinations, so an "opened" flag on them would mean nothing. */
export const NAVIGABLE_MILESTONES: readonly MilestoneId[] = [
  "first-reward",
  "first-labyrinth",
  "special-training",
] as const;

export type MilestoneEvent = {
  id: MilestoneId;
  /** Scopes per-piece milestones. Absent on global ones. */
  piece?: PieceId;
  /** ISO timestamp the condition first became true. */
  earnedAt: string;
  /** Set once the celebration overlay has actually been shown. */
  celebratedAt?: string;
  /** Set the first time the player opens the content. Clears the NEW dot.
   *  Only ever written for a milestone in NAVIGABLE_MILESTONES. */
  openedAt?: string;
};

/** Idempotency key. Per-piece milestones are scoped; global ones are not. */
export function milestoneKey(id: MilestoneId, piece?: PieceId): string {
  return piece ? `${id}:${piece}` : id;
}

export type MilestoneStore = {
  version: 1;
  /** Keyed by `milestoneKey()`. A present entry means the event fired. */
  events: Record<string, MilestoneEvent>;
  /** UTC date the daily milestones were last reset. */
  dailyDate: string | null;
};

export const EMPTY_STORE: MilestoneStore = {
  version: 1,
  events: {},
  dailyDate: null,
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/types.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): milestone event contract

Eligible and claimed are separate events because a badge does not exist
until a transaction confirms. openedAt exists only on milestones that
lead somewhere.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: Net-star accounting

**Files:**
- Create: `apps/web/src/lib/progression/stars.ts`
- Modify: `apps/web/src/lib/lite-progress-storage.ts` (add `dailyStarsStorageKey`)
- Test: `apps/web/src/lib/progression/__tests__/stars.test.ts`

**Interfaces:**
- Produces: `netStars(previousBest, newStars)`, `DailyStarLedger`, `parseDailyStars()`, `computeAddNetStars()`, and the IO wrappers `getDailyStarLedger()`, `getDailyStars()`, `addNetStars(previousBest, newStars)` — Task 13 calls `getDailyStars()` and `addNetStars()` from the save flow.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  computeAddNetStars,
  netStars,
  parseDailyStars,
  type DailyStarLedger,
} from "@/lib/progression/stars";

describe("netStars", () => {
  it("counts only the improvement over the previous best", () => {
    expect(netStars(1, 3)).toBe(2);
  });

  it("is zero when a replay does not beat the previous best", () => {
    expect(netStars(3, 3)).toBe(0);
  });

  it("is zero when a replay is worse than the previous best", () => {
    expect(netStars(3, 1)).toBe(0);
  });

  it("counts the full result for a never-played exercise", () => {
    expect(netStars(0, 2)).toBe(2);
  });
});

describe("parseDailyStars", () => {
  it("returns a zeroed ledger for a stored date that is not today", () => {
    const raw = JSON.stringify({ date: "2026-07-10", stars: 8 });
    expect(parseDailyStars(raw, "2026-07-11")).toEqual({
      date: "2026-07-11",
      stars: 0,
    });
  });

  it("returns a zeroed ledger for corrupt input", () => {
    expect(parseDailyStars("{{{", "2026-07-11")).toEqual({
      date: "2026-07-11",
      stars: 0,
    });
  });

  it("keeps today's ledger", () => {
    const raw = JSON.stringify({ date: "2026-07-11", stars: 5 });
    expect(parseDailyStars(raw, "2026-07-11")).toEqual({
      date: "2026-07-11",
      stars: 5,
    });
  });
});

describe("computeAddNetStars", () => {
  it("adds the net gain and leaves the reference untouched on a no-op", () => {
    const state: DailyStarLedger = { date: "2026-07-11", stars: 5 };
    expect(computeAddNetStars(state, 0)).toBe(state);
    expect(computeAddNetStars(state, 2)).toEqual({
      date: "2026-07-11",
      stars: 7,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/stars.test.ts`
Expected: FAIL — cannot resolve `@/lib/progression/stars`.

- [ ] **Step 3: Write the minimal implementation**

```ts
import { todayUtc } from "@/lib/daily/progress";

/** Stars earned today. The ONLY daily counter in the progression system.
 *  Fed by exercises AND labyrinths, always as net improvement — replaying
 *  a solved exercise must never inflate a session. */
export type DailyStarLedger = {
  date: string;
  stars: number;
};

/** The improvement a result represents over the player's previous best.
 *  A replay that does not beat the best contributes nothing. */
export function netStars(previousBest: number, newStars: number): number {
  return Math.max(0, newStars - previousBest);
}

export function parseDailyStars(
  raw: string | null,
  today: string = todayUtc(),
): DailyStarLedger {
  const fresh: DailyStarLedger = { date: today, stars: 0 };
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStarLedger>;
    if (parsed?.date !== today) return fresh;
    return {
      date: today,
      stars: typeof parsed.stars === "number" ? Math.max(0, parsed.stars) : 0,
    };
  } catch {
    return fresh;
  }
}

export function computeAddNetStars(
  state: DailyStarLedger,
  gain: number,
): DailyStarLedger {
  if (gain <= 0) return state;
  return { ...state, stars: state.stars + gain };
}

// ─── localStorage I/O ────────────────────────────────────────────────────

export function getDailyStarLedger(): DailyStarLedger {
  if (typeof window === "undefined") return parseDailyStars(null);
  try {
    return parseDailyStars(localStorage.getItem(dailyStarsStorageKey()));
  } catch {
    return parseDailyStars(null);
  }
}

/** Convenience read for callers that only need the number. */
export function getDailyStars(): number {
  return getDailyStarLedger().stars;
}

/** Adds the net improvement a result represents. Call this once per solved
 *  activity, exercise or labyrinth, with the previous best in hand. */
export function addNetStars(previousBest: number, newStars: number): DailyStarLedger {
  const current = getDailyStarLedger();
  const next = computeAddNetStars(current, netStars(previousBest, newStars));
  if (next === current) return current;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(dailyStarsStorageKey(), JSON.stringify(next));
    } catch {
      // Quota or privacy mode — the caller still gets the correct state back.
    }
  }
  return next;
}
```

Import `dailyStarsStorageKey` from `@/lib/lite-progress-storage` and add it there beside `dailySessionStorageKey`:

```ts
export function dailyStarsStorageKey(): string {
  return `${progressPrefix()}daily-stars`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/stars.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/stars.ts apps/web/src/lib/progression/__tests__/stars.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): net-star accounting

Replaying a solved exercise contributes zero, so a session measures real
progress rather than repetition.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Milestone condition derivation (pure)

**Files:**
- Create: `apps/web/src/lib/progression/milestones.ts`
- Test: `apps/web/src/lib/progression/__tests__/milestones.test.ts`

**Interfaces:**
- Consumes: `MilestoneId`, `milestoneKey` (Task 1).
- Produces: `MilestoneInput`, `deriveEarnedMilestones(input): { id: MilestoneId; piece?: PieceId }[]`, and the threshold constants `GIFT_STARS`, `GIFT_EXERCISES`, `LABYRINTH_EXERCISES`, `GREAT_SESSION_STARS`.

**Note on thresholds:** `LABYRINTH_UNLOCK_THRESHOLD` (6) lives in `lib/training/path.ts:66` and `BADGE_THRESHOLD` (10) in `lib/game/exercises.ts:28`. Import them; do not redeclare.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  deriveEarnedMilestones,
  type MilestoneInput,
} from "@/lib/progression/milestones";

function input(overrides: Partial<MilestoneInput> = {}): MilestoneInput {
  return {
    piece: "rook",
    lifetimeStars: 0,
    completedExercises: 0,
    pieceStars: 0,
    pieceCompletedExercises: 0,
    rookStars: 0,
    dailyStars: 0,
    sessionQuotaExhausted: false,
    badgeClaimed: false,
    allLabyrinthsComplete: false,
    hadGreatSessionBefore: false,
    ...overrides,
  };
}

function ids(result: ReturnType<typeof deriveEarnedMilestones>): string[] {
  return result.map((event) => event.id);
}

describe("first-reward", () => {
  it("does not fire on a single perfect solve — the exercise floor is not met", () => {
    const earned = deriveEarnedMilestones(
      input({ lifetimeStars: 3, completedExercises: 1 }),
    );
    expect(ids(earned)).not.toContain("first-reward");
  });

  it("fires at 4 stars across 2 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ lifetimeStars: 4, completedExercises: 2 }),
    );
    expect(ids(earned)).toContain("first-reward");
  });

  it("fires for a struggling player at 1 star across 4 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ lifetimeStars: 4, completedExercises: 4 }),
    );
    expect(ids(earned)).toContain("first-reward");
  });
});

describe("first-labyrinth", () => {
  it("does not fire at 6 piece stars across only 2 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 6, pieceCompletedExercises: 2 }),
    );
    expect(ids(earned)).not.toContain("first-labyrinth");
  });

  it("fires at 6 piece stars across 3 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 6, pieceCompletedExercises: 3 }),
    );
    expect(ids(earned)).toContain("first-labyrinth");
  });
});

describe("piece badge", () => {
  it("is eligible at 10 piece stars but not claimed", () => {
    const earned = deriveEarnedMilestones(input({ pieceStars: 10 }));
    expect(ids(earned)).toContain("piece-badge-eligible");
    expect(ids(earned)).not.toContain("piece-badge-claimed");
  });

  it("is claimed once the transaction confirms", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 10, badgeClaimed: true }),
    );
    expect(ids(earned)).toContain("piece-badge-claimed");
  });
});

describe("mastery", () => {
  it("stays locked when every labyrinth is done but the badge was never claimed", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 10, allLabyrinthsComplete: true, badgeClaimed: false }),
    );
    expect(ids(earned)).not.toContain("mastery");
  });

  it("fires when the badge is claimed and every labyrinth is done", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 10, allLabyrinthsComplete: true, badgeClaimed: true }),
    );
    expect(ids(earned)).toContain("mastery");
  });
});

describe("special-training", () => {
  it("fires at 12 rook stars", () => {
    expect(ids(deriveEarnedMilestones(input({ rookStars: 12 })))).toContain(
      "special-training",
    );
  });

  it("does not fire at 11 rook stars", () => {
    expect(ids(deriveEarnedMilestones(input({ rookStars: 11 })))).not.toContain(
      "special-training",
    );
  });
});

describe("great-focus-session", () => {
  it("fires at 8 daily stars", () => {
    expect(ids(deriveEarnedMilestones(input({ dailyStars: 8 })))).toContain(
      "great-focus-session",
    );
  });

  it("fires on an exhausted quota even at 7 daily stars — the wall never beats the praise", () => {
    const earned = deriveEarnedMilestones(
      input({ dailyStars: 7, sessionQuotaExhausted: true }),
    );
    expect(ids(earned)).toContain("great-focus-session");
  });

  it("grants first-great-session only the first time", () => {
    const first = deriveEarnedMilestones(input({ dailyStars: 8 }));
    expect(ids(first)).toContain("first-great-session");

    const later = deriveEarnedMilestones(
      input({ dailyStars: 8, hadGreatSessionBefore: true }),
    );
    expect(ids(later)).toContain("great-focus-session");
    expect(ids(later)).not.toContain("first-great-session");
  });
});

describe("per-piece scoping", () => {
  it("scopes piece milestones to the piece under play", () => {
    const earned = deriveEarnedMilestones(
      input({ piece: "bishop", pieceStars: 10 }),
    );
    const badge = earned.find((event) => event.id === "piece-badge-eligible");
    expect(badge?.piece).toBe("bishop");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/milestones.test.ts`
Expected: FAIL — cannot resolve `@/lib/progression/milestones`.

- [ ] **Step 3: Write the minimal implementation**

```ts
import type { PieceId } from "@/lib/game/types";
import { BADGE_THRESHOLD } from "@/lib/game/exercises";
import { LABYRINTH_UNLOCK_THRESHOLD } from "@/lib/training/path";
import type { MilestoneId } from "./types";

/** The gift is a once-ever event, so it reads once-ever counters. A daily
 *  threshold would strand a player who earns 3 stars on Monday and 1 on
 *  Tuesday: the counter resets at UTC midnight and the gift never lands. */
export const GIFT_STARS = 4;
export const GIFT_EXERCISES = 2;

/** The exercise floor that keeps the gift and the labyrinth from firing on
 *  the same solve for a perfect player. */
export const LABYRINTH_EXERCISES = 3;

export const SPECIAL_TRAINING_ROOK_STARS = 12;

export const GREAT_SESSION_STARS = 8;

export type MilestoneInput = {
  /** The piece currently under play — scopes the per-piece milestones. */
  piece: PieceId;
  /** Best exercise stars summed across every piece. Cumulative. */
  lifetimeStars: number;
  /** Exercises solved at least once, across every piece. Cumulative. */
  completedExercises: number;
  /** Best exercise stars for `piece`. Labyrinth stars NEVER count here. */
  pieceStars: number;
  /** Exercises of `piece` solved at least once. */
  pieceCompletedExercises: number;
  /** Rook exercise stars — the Special Training gate. */
  rookStars: number;
  /** Net stars earned today, exercises AND labyrinths. */
  dailyStars: number;
  sessionQuotaExhausted: boolean;
  /** On-chain claim state for `piece`. */
  badgeClaimed: boolean;
  allLabyrinthsComplete: boolean;
  /** Whether a Great Focus Session was ever recognized before today. */
  hadGreatSessionBefore: boolean;
};

export type EarnedMilestone = {
  id: MilestoneId;
  piece?: PieceId;
};

/** Pure. Returns every milestone whose condition is currently TRUE — it does
 *  NOT know or care which ones already fired. Idempotence lives in storage. */
export function deriveEarnedMilestones(input: MilestoneInput): EarnedMilestone[] {
  const earned: EarnedMilestone[] = [];
  const { piece } = input;

  if (
    input.lifetimeStars >= GIFT_STARS &&
    input.completedExercises >= GIFT_EXERCISES
  ) {
    earned.push({ id: "first-reward" });
  }

  if (
    input.pieceStars >= LABYRINTH_UNLOCK_THRESHOLD &&
    input.pieceCompletedExercises >= LABYRINTH_EXERCISES
  ) {
    earned.push({ id: "first-labyrinth", piece });
  }

  if (input.rookStars >= SPECIAL_TRAINING_ROOK_STARS) {
    earned.push({ id: "special-training" });
  }

  if (input.pieceStars >= BADGE_THRESHOLD) {
    earned.push({ id: "piece-badge-eligible", piece });
    if (input.badgeClaimed) {
      earned.push({ id: "piece-badge-claimed", piece });
    }
  }

  // The crown cannot rest on a badge that was never minted.
  if (input.badgeClaimed && input.allLabyrinthsComplete) {
    earned.push({ id: "mastery", piece });
  }

  const greatSession =
    input.dailyStars >= GREAT_SESSION_STARS || input.sessionQuotaExhausted;
  if (greatSession) {
    earned.push({ id: "great-focus-session" });
    if (!input.hadGreatSessionBefore) {
      earned.push({ id: "first-great-session" });
    }
  }

  return earned;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/milestones.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/milestones.ts apps/web/src/lib/progression/__tests__/milestones.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): derive milestone conditions

Compound conditions with an exercise floor, so a single perfect solve
cannot skip the arc and the gift never strands a player who spreads stars
across days.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: Celebration queue ordering (pure)

**Files:**
- Create: `apps/web/src/lib/progression/celebration-queue.ts`
- Test: `apps/web/src/lib/progression/__tests__/celebration-queue.test.ts`

**Interfaces:**
- Consumes: `EarnedMilestone` (Task 3), `MilestoneId` (Task 1).
- Produces: `buildCelebrationQueue(pending): CelebrationStep[]`, `CelebrationStep`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildCelebrationQueue } from "@/lib/progression/celebration-queue";

describe("buildCelebrationQueue", () => {
  it("returns nothing when nothing fired", () => {
    expect(buildCelebrationQueue([])).toEqual([]);
  });

  it("shows incremental unlocks in ladder order, each its own overlay", () => {
    const queue = buildCelebrationQueue([
      { id: "special-training" },
      { id: "first-reward" },
      { id: "first-labyrinth", piece: "rook" },
    ]);
    expect(queue.map((step) => step.id)).toEqual([
      "first-reward",
      "first-labyrinth",
      "special-training",
    ]);
  });

  it("closes with the great focus session when it is the only major", () => {
    const queue = buildCelebrationQueue([
      { id: "first-reward" },
      { id: "great-focus-session" },
    ]);
    expect(queue.map((step) => step.id)).toEqual([
      "first-reward",
      "great-focus-session",
    ]);
  });

  it("renders exactly one closer and absorbs the lower major into it", () => {
    const queue = buildCelebrationQueue([
      { id: "great-focus-session" },
      { id: "mastery", piece: "rook" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("mastery");
    expect(queue[0].absorbed).toEqual(["great-focus-session"]);
  });

  it("lets the claim flow close and absorb the session", () => {
    const queue = buildCelebrationQueue([
      { id: "great-focus-session" },
      { id: "piece-badge-eligible", piece: "rook" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("piece-badge-eligible");
    expect(queue[0].absorbed).toEqual(["great-focus-session"]);
  });

  it("always renders first-great-session inside the closer, never alone", () => {
    const queue = buildCelebrationQueue([
      { id: "great-focus-session" },
      { id: "first-great-session" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("great-focus-session");
    expect(queue[0].absorbed).toContain("first-great-session");
  });

  it("shows the incremental unlock before the closer when both fire", () => {
    const queue = buildCelebrationQueue([
      { id: "mastery", piece: "rook" },
      { id: "special-training" },
    ]);
    expect(queue.map((step) => step.id)).toEqual(["special-training", "mastery"]);
  });

  it("never renders two majors back to back", () => {
    const queue = buildCelebrationQueue([
      { id: "mastery", piece: "rook" },
      { id: "piece-badge-eligible", piece: "rook" },
      { id: "great-focus-session" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("mastery");
    expect(queue[0].absorbed).toEqual([
      "piece-badge-eligible",
      "great-focus-session",
    ]);
  });

  it("drops piece-badge-claimed from the queue — the claim flow owns that moment", () => {
    const queue = buildCelebrationQueue([
      { id: "piece-badge-claimed", piece: "rook" },
    ]);
    expect(queue).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/celebration-queue.test.ts`
Expected: FAIL — cannot resolve `@/lib/progression/celebration-queue`.

- [ ] **Step 3: Write the minimal implementation**

```ts
import type { PieceId } from "@/lib/game/types";
import type { EarnedMilestone } from "./milestones";
import type { MilestoneId } from "./types";

/** Incremental unlocks. Each gets its own overlay because each carries a CTA
 *  to different content. None of them concludes anything — they invite action. */
const INCREMENTAL_ORDER: MilestoneId[] = [
  "first-reward",
  "first-labyrinth",
  "special-training",
];

/** Majors, highest hierarchy first. Exactly ONE renders per drain; every
 *  other major that fired is absorbed as a line inside it. Showing MASTERY!
 *  and then GREAT FOCUS SESSION! drops the intensity after the climax. */
const CLOSER_ORDER: MilestoneId[] = [
  "mastery",
  "piece-badge-eligible",
  "great-focus-session",
];

export type CelebrationStep = {
  id: MilestoneId;
  piece?: PieceId;
  /** Lower majors rendered as lines inside this overlay, never as modals. */
  absorbed: MilestoneId[];
};

export function buildCelebrationQueue(
  pending: readonly EarnedMilestone[],
): CelebrationStep[] {
  const find = (id: MilestoneId) => pending.find((event) => event.id === id);

  const steps: CelebrationStep[] = [];

  for (const id of INCREMENTAL_ORDER) {
    const event = find(id);
    if (event) steps.push({ id, piece: event.piece, absorbed: [] });
  }

  const firedClosers = CLOSER_ORDER.filter((id) => find(id));
  if (firedClosers.length === 0) return steps;

  const [closerId, ...absorbedClosers] = firedClosers;
  const closer = find(closerId);
  const absorbed: MilestoneId[] = [...absorbedClosers];

  // first-great-session is an achievement, never an overlay of its own.
  if (find("first-great-session")) absorbed.push("first-great-session");

  steps.push({ id: closerId, piece: closer?.piece, absorbed });
  return steps;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/celebration-queue.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/celebration-queue.ts apps/web/src/lib/progression/__tests__/celebration-queue.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): one closer per drain

Incremental unlocks invite action and come first; the highest-hierarchy
event closes and absorbs every lower major as a line. Never two major
celebrations back to back.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5: Milestone persistence and idempotence

**Files:**
- Create: `apps/web/src/lib/progression/milestone-storage.ts`
- Modify: `apps/web/src/lib/lite-progress-storage.ts` (add one key helper)
- Test: `apps/web/src/lib/progression/__tests__/milestone-storage.test.ts`

**Interfaces:**
- Consumes: `MilestoneStore`, `MilestoneEvent`, `milestoneKey`, `EMPTY_STORE`, `NAVIGABLE_MILESTONES` (Task 1); `EarnedMilestone` (Task 3).
- Produces: `parseMilestoneStore()`, `computeRecordEarned()`, `computeMarkCelebrated()`, `computeMarkOpened()`, `selectPending()`, `getMilestoneStore()`, `recordEarned()`, `markCelebrated()`, `markOpened()`.

- [ ] **Step 1: Add the storage key helper**

In `apps/web/src/lib/lite-progress-storage.ts`, after `dailySessionStorageKey`:

```ts
export function milestoneStorageKey(): string {
  return `${progressPrefix()}milestones`;
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  computeMarkCelebrated,
  computeMarkOpened,
  computeRecordEarned,
  parseMilestoneStore,
  selectPending,
} from "@/lib/progression/milestone-storage";
import { EMPTY_STORE, type MilestoneStore } from "@/lib/progression/types";

const NOW = "2026-07-11T10:00:00.000Z";
const TODAY = "2026-07-11";

describe("parseMilestoneStore", () => {
  it("returns an empty store for corrupt input", () => {
    expect(parseMilestoneStore("{{{", TODAY)).toEqual(EMPTY_STORE);
  });

  it("clears daily milestones when the stored date is not today", () => {
    const stored: MilestoneStore = {
      version: 1,
      dailyDate: "2026-07-10",
      events: {
        "great-focus-session": {
          id: "great-focus-session",
          earnedAt: "2026-07-10T09:00:00.000Z",
          celebratedAt: "2026-07-10T09:00:00.000Z",
        },
        "first-reward": { id: "first-reward", earnedAt: "2026-07-10T08:00:00.000Z" },
      },
    };
    const parsed = parseMilestoneStore(JSON.stringify(stored), TODAY);
    expect(parsed.events["great-focus-session"]).toBeUndefined();
    expect(parsed.events["first-reward"]).toBeDefined();
    expect(parsed.dailyDate).toBe(TODAY);
  });

  it("keeps first-great-session across days — it never resets", () => {
    const stored: MilestoneStore = {
      version: 1,
      dailyDate: "2026-07-10",
      events: {
        "first-great-session": {
          id: "first-great-session",
          earnedAt: "2026-07-10T09:00:00.000Z",
        },
      },
    };
    const parsed = parseMilestoneStore(JSON.stringify(stored), TODAY);
    expect(parsed.events["first-great-session"]).toBeDefined();
  });
});

describe("computeRecordEarned", () => {
  it("records a new event with its earnedAt", () => {
    const next = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    expect(next.events["first-reward"]).toEqual({
      id: "first-reward",
      earnedAt: NOW,
    });
  });

  it("scopes per-piece events by their idempotency key", () => {
    const next = computeRecordEarned(
      EMPTY_STORE,
      [{ id: "piece-badge-eligible", piece: "bishop" }],
      NOW,
    );
    expect(next.events["piece-badge-eligible:bishop"]?.piece).toBe("bishop");
  });

  it("is idempotent — re-deriving a recorded event returns the same reference", () => {
    const first = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    const second = computeRecordEarned(first, [{ id: "first-reward" }], NOW);
    expect(second).toBe(first);
  });

  it("never overwrites earnedAt on a re-derive", () => {
    const first = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    const later = computeRecordEarned(
      first,
      [{ id: "first-reward" }],
      "2026-07-12T10:00:00.000Z",
    );
    expect(later.events["first-reward"].earnedAt).toBe(NOW);
  });
});

describe("selectPending", () => {
  it("returns events that have never been celebrated", () => {
    const store = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    expect(selectPending(store)).toEqual([{ id: "first-reward", piece: undefined }]);
  });

  it("excludes an already celebrated event", () => {
    const earned = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    const celebrated = computeMarkCelebrated(earned, "first-reward", undefined, NOW);
    expect(selectPending(celebrated)).toEqual([]);
  });
});

describe("computeMarkOpened", () => {
  it("clears the NEW dot on a navigable milestone", () => {
    const earned = computeRecordEarned(EMPTY_STORE, [{ id: "special-training" }], NOW);
    const opened = computeMarkOpened(earned, "special-training", undefined, NOW);
    expect(opened.events["special-training"].openedAt).toBe(NOW);
  });

  it("refuses to write openedAt on a recognition — it has no destination", () => {
    const earned = computeRecordEarned(
      EMPTY_STORE,
      [{ id: "great-focus-session" }],
      NOW,
    );
    const opened = computeMarkOpened(earned, "great-focus-session", undefined, NOW);
    expect(opened.events["great-focus-session"].openedAt).toBeUndefined();
    expect(opened).toBe(earned);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/milestone-storage.test.ts`
Expected: FAIL — cannot resolve `@/lib/progression/milestone-storage`.

- [ ] **Step 4: Write the minimal implementation**

```ts
import type { PieceId } from "@/lib/game/types";
import { todayUtc } from "@/lib/daily/progress";
import { milestoneStorageKey } from "@/lib/lite-progress-storage";
import type { EarnedMilestone } from "./milestones";
import {
  EMPTY_STORE,
  milestoneKey,
  NAVIGABLE_MILESTONES,
  type MilestoneEvent,
  type MilestoneId,
  type MilestoneStore,
} from "./types";

/** Resets with the UTC day. Everything else is cumulative and permanent. */
const DAILY_MILESTONES: readonly MilestoneId[] = ["great-focus-session"];

export function parseMilestoneStore(
  raw: string | null,
  today: string = todayUtc(),
): MilestoneStore {
  if (!raw) return { ...EMPTY_STORE, dailyDate: today };
  let parsed: Partial<MilestoneStore>;
  try {
    parsed = JSON.parse(raw) as Partial<MilestoneStore>;
  } catch {
    return { ...EMPTY_STORE, dailyDate: today };
  }
  if (parsed.version !== 1 || typeof parsed.events !== "object" || !parsed.events) {
    return { ...EMPTY_STORE, dailyDate: today };
  }

  const events = { ...parsed.events };
  if (parsed.dailyDate !== today) {
    for (const id of DAILY_MILESTONES) {
      delete events[id];
    }
  }
  return { version: 1, events, dailyDate: today };
}

/** Records every earned milestone that is not already on disk. Returns the
 *  SAME reference when nothing is new, so callers can skip the write. */
export function computeRecordEarned(
  store: MilestoneStore,
  earned: readonly EarnedMilestone[],
  now: string,
): MilestoneStore {
  const fresh = earned.filter(
    (event) => !store.events[milestoneKey(event.id, event.piece)],
  );
  if (fresh.length === 0) return store;

  const events = { ...store.events };
  for (const event of fresh) {
    const record: MilestoneEvent = { id: event.id, earnedAt: now };
    if (event.piece) record.piece = event.piece;
    events[milestoneKey(event.id, event.piece)] = record;
  }
  return { ...store, events };
}

export function computeMarkCelebrated(
  store: MilestoneStore,
  id: MilestoneId,
  piece: PieceId | undefined,
  now: string,
): MilestoneStore {
  const key = milestoneKey(id, piece);
  const event = store.events[key];
  if (!event || event.celebratedAt) return store;
  return {
    ...store,
    events: { ...store.events, [key]: { ...event, celebratedAt: now } },
  };
}

/** Only a navigable milestone has somewhere to go. Writing `openedAt` on a
 *  recognition would invent a state with no meaning, so it is refused. */
export function computeMarkOpened(
  store: MilestoneStore,
  id: MilestoneId,
  piece: PieceId | undefined,
  now: string,
): MilestoneStore {
  if (!NAVIGABLE_MILESTONES.includes(id)) return store;
  const key = milestoneKey(id, piece);
  const event = store.events[key];
  if (!event || event.openedAt) return store;
  return {
    ...store,
    events: { ...store.events, [key]: { ...event, openedAt: now } },
  };
}

/** Earned but never celebrated. This is what the queue drains. */
export function selectPending(store: MilestoneStore): EarnedMilestone[] {
  return Object.values(store.events)
    .filter((event) => !event.celebratedAt)
    .map((event) => ({ id: event.id, piece: event.piece }));
}

// ─── localStorage I/O ────────────────────────────────────────────────────

export function getMilestoneStore(): MilestoneStore {
  if (typeof window === "undefined") return parseMilestoneStore(null);
  try {
    return parseMilestoneStore(localStorage.getItem(milestoneStorageKey()));
  } catch {
    return parseMilestoneStore(null);
  }
}

function persist(store: MilestoneStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(milestoneStorageKey(), JSON.stringify(store));
  } catch {
    // Quota or privacy mode — the caller still gets the correct state back.
  }
}

/** Persists BEFORE anything is rendered. If the app dies mid-overlay the
 *  event is already on disk, so it neither replays nor gets lost. */
export function recordEarned(
  earned: readonly EarnedMilestone[],
  now: string = new Date().toISOString(),
): MilestoneStore {
  const current = getMilestoneStore();
  const next = computeRecordEarned(current, earned, now);
  if (next !== current) persist(next);
  return next;
}

export function markCelebrated(
  id: MilestoneId,
  piece?: PieceId,
  now: string = new Date().toISOString(),
): MilestoneStore {
  const current = getMilestoneStore();
  const next = computeMarkCelebrated(current, id, piece, now);
  if (next !== current) persist(next);
  return next;
}

export function markOpened(
  id: MilestoneId,
  piece?: PieceId,
  now: string = new Date().toISOString(),
): MilestoneStore {
  const current = getMilestoneStore();
  const next = computeMarkOpened(current, id, piece, now);
  if (next !== current) persist(next);
  return next;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/milestone-storage.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/milestone-storage.ts apps/web/src/lib/progression/__tests__/milestone-storage.test.ts apps/web/src/lib/lite-progress-storage.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): persist milestones idempotently

An event is written before it is ever rendered, so an app killed mid-overlay
loses nothing and repeats nothing. openedAt is refused on recognitions.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 6: Migration — seed what the player already passed

**Files:**
- Create: `apps/web/src/lib/progression/migration.ts`
- Test: `apps/web/src/lib/progression/__tests__/migration.test.ts`

**Interfaces:**
- Consumes: `MilestoneStore`, `EMPTY_STORE` (Task 1); `MilestoneInput`, `deriveEarnedMilestones` (Task 3).
- Produces: `seedExistingPlayer(store, input, welcomeClaimed, welcomeUnlocked, now): MilestoneStore`.

**Why this task exists:** the rule is that **no retroactive celebration fires**. Seeding stamps `celebratedAt` on every milestone an existing player already passed, so the overlay is suppressed while the state is preserved.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { seedExistingPlayer } from "@/lib/progression/migration";
import { EMPTY_STORE } from "@/lib/progression/types";
import type { MilestoneInput } from "@/lib/progression/milestones";

const NOW = "2026-07-11T10:00:00.000Z";

function input(overrides: Partial<MilestoneInput> = {}): MilestoneInput {
  return {
    piece: "rook",
    lifetimeStars: 0,
    completedExercises: 0,
    pieceStars: 0,
    pieceCompletedExercises: 0,
    rookStars: 0,
    dailyStars: 0,
    sessionQuotaExhausted: false,
    badgeClaimed: false,
    allLabyrinthsComplete: false,
    hadGreatSessionBefore: false,
    ...overrides,
  };
}

describe("seedExistingPlayer", () => {
  it("leaves a brand new player untouched", () => {
    const seeded = seedExistingPlayer(EMPTY_STORE, input(), false, NOW);
    expect(seeded.events).toEqual({});
  });

  it("suppresses the overlay for a player already past 12 rook stars", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ rookStars: 12, lifetimeStars: 12, completedExercises: 5 }),
      true,
      NOW,
    );
    expect(seeded.events["special-training"].celebratedAt).toBe(NOW);
  });

  it("marks a claimed gift as opened so no NEW dot reappears", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ lifetimeStars: 6, completedExercises: 3 }),
      true,
      NOW,
    );
    expect(seeded.events["first-reward"].celebratedAt).toBe(NOW);
    expect(seeded.events["first-reward"].openedAt).toBe(NOW);
  });

  it("keeps the NEW dot for a gift earned but never claimed", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ lifetimeStars: 6, completedExercises: 3 }),
      false,
      NOW,
    );
    expect(seeded.events["first-reward"].celebratedAt).toBe(NOW);
    expect(seeded.events["first-reward"].openedAt).toBeUndefined();
  });

  it("never seeds a daily milestone — today's session is still up for grabs", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ dailyStars: 8 }),
      false,
      NOW,
    );
    expect(seeded.events["great-focus-session"]).toBeUndefined();
    expect(seeded.events["first-great-session"]).toBeUndefined();
  });

  it("is a no-op on a store that was already seeded", () => {
    const first = seedExistingPlayer(EMPTY_STORE, input({ rookStars: 12 }), true, NOW);
    const second = seedExistingPlayer(
      first,
      input({ rookStars: 12 }),
      true,
      "2026-07-12T10:00:00.000Z",
    );
    expect(second).toBe(first);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/migration.test.ts`
Expected: FAIL — cannot resolve `@/lib/progression/migration`.

- [ ] **Step 3: Write the minimal implementation**

```ts
import { deriveEarnedMilestones, type MilestoneInput } from "./milestones";
import {
  milestoneKey,
  NAVIGABLE_MILESTONES,
  type MilestoneEvent,
  type MilestoneId,
  type MilestoneStore,
} from "./types";

/** Daily milestones are never seeded: today's session is still live and the
 *  player deserves the chance to earn it. */
const NEVER_SEEDED: readonly MilestoneId[] = [
  "great-focus-session",
  "first-great-session",
];

/** Stamps every milestone an existing player already passed as celebrated,
 *  so upgrading the app never fires a retroactive parade. State preserved,
 *  overlay suppressed. Idempotent: returns the same reference once seeded. */
export function seedExistingPlayer(
  store: MilestoneStore,
  input: MilestoneInput,
  welcomeClaimed: boolean,
  now: string,
): MilestoneStore {
  const earned = deriveEarnedMilestones(input).filter(
    (event) => !NEVER_SEEDED.includes(event.id),
  );
  const fresh = earned.filter(
    (event) => !store.events[milestoneKey(event.id, event.piece)],
  );
  if (fresh.length === 0) return store;

  const events = { ...store.events };
  for (const event of fresh) {
    const record: MilestoneEvent = {
      id: event.id,
      earnedAt: now,
      celebratedAt: now,
    };
    if (event.piece) record.piece = event.piece;

    if (NAVIGABLE_MILESTONES.includes(event.id)) {
      // The gift is the ONE navigable milestone with a pre-existing claim
      // state, so it is the only one that can still owe the player a NEW dot.
      // An unclaimed gift keeps its dot; a claimed gift and every other
      // milestone the player has already lived through count as opened.
      const opened = event.id === "first-reward" ? welcomeClaimed : true;
      if (opened) record.openedAt = now;
    }

    events[milestoneKey(event.id, event.piece)] = record;
  }
  return { ...store, events };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/migration.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/migration.ts apps/web/src/lib/progression/__tests__/migration.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): seed milestones an existing player already passed

Upgrading the app must not fire a retroactive parade. Seeding preserves the
state and suppresses the overlay. Today's session is never seeded — it is
still up for grabs.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 7: Gather the milestone input from live progress

**Files:**
- Create: `apps/web/src/lib/progression/gather-input.ts`
- Test: `apps/web/src/lib/progression/__tests__/gather-input.test.ts`

**Interfaces:**
- Consumes: `MilestoneInput` (Task 3); `PieceProgress` from `@/lib/game/types`; `DailySessionState` + `isSessionOver` from `@/lib/daily/session-quota`.
- Produces: `gatherMilestoneInput(args): MilestoneInput`.

**Why a separate module:** the derivation core must stay free of IO. This is the adapter that reads the already-persisted stores and shapes them into `MilestoneInput`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { gatherMilestoneInput } from "@/lib/progression/gather-input";
import type { PieceProgress } from "@/lib/game/types";

const rook: PieceProgress = {
  piece: "rook",
  currentId: null,
  stars: { "rook-1": 3, "rook-2": 2, "rook-3": 0 },
};

const bishop: PieceProgress = {
  piece: "bishop",
  currentId: null,
  stars: { "bishop-1": 1 },
};

describe("gatherMilestoneInput", () => {
  it("sums lifetime stars across every piece", () => {
    const input = gatherMilestoneInput({
      piece: "rook",
      progressByPiece: { rook, bishop },
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false,
    });
    expect(input.lifetimeStars).toBe(6);
  });

  it("counts only exercises solved at least once — a 0-star entry is not completed", () => {
    const input = gatherMilestoneInput({
      piece: "rook",
      progressByPiece: { rook, bishop },
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false,
    });
    expect(input.completedExercises).toBe(3);
    expect(input.pieceCompletedExercises).toBe(2);
  });

  it("scopes piece stars to the piece under play and exposes rook stars separately", () => {
    const input = gatherMilestoneInput({
      piece: "bishop",
      progressByPiece: { rook, bishop },
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false,
    });
    expect(input.pieceStars).toBe(1);
    expect(input.rookStars).toBe(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/gather-input.test.ts`
Expected: FAIL — cannot resolve `@/lib/progression/gather-input`.

- [ ] **Step 3: Write the minimal implementation**

```ts
import type { PieceId, PieceProgress } from "@/lib/game/types";
import type { MilestoneInput } from "./milestones";

export type GatherArgs = {
  piece: PieceId;
  /** Every piece's persisted progress. Missing pieces read as zero. */
  progressByPiece: Partial<Record<PieceId, PieceProgress>>;
  dailyStars: number;
  sessionQuotaExhausted: boolean;
  badgeClaimed: boolean;
  allLabyrinthsComplete: boolean;
  hadGreatSessionBefore: boolean;
};

function sumStars(progress: PieceProgress | undefined): number {
  if (!progress) return 0;
  return Object.values(progress.stars).reduce((sum, value) => sum + value, 0);
}

/** An exercise counts as completed once it has been solved at least once.
 *  A sparse 0 means "played and scored nothing", which is not a completion. */
function countCompleted(progress: PieceProgress | undefined): number {
  if (!progress) return 0;
  return Object.values(progress.stars).filter((value) => value > 0).length;
}

/** Adapter: reads already-persisted progress and shapes it for the pure core.
 *  Introduces NO new source of truth for stars. */
export function gatherMilestoneInput(args: GatherArgs): MilestoneInput {
  const pieces = Object.values(args.progressByPiece) as PieceProgress[];
  const current = args.progressByPiece[args.piece];

  return {
    piece: args.piece,
    lifetimeStars: pieces.reduce((sum, progress) => sum + sumStars(progress), 0),
    completedExercises: pieces.reduce(
      (sum, progress) => sum + countCompleted(progress),
      0,
    ),
    pieceStars: sumStars(current),
    pieceCompletedExercises: countCompleted(current),
    rookStars: sumStars(args.progressByPiece.rook),
    dailyStars: args.dailyStars,
    sessionQuotaExhausted: args.sessionQuotaExhausted,
    badgeClaimed: args.badgeClaimed,
    allLabyrinthsComplete: args.allLabyrinthsComplete,
    hadGreatSessionBefore: args.hadGreatSessionBefore,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/gather-input.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/gather-input.ts apps/web/src/lib/progression/__tests__/gather-input.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): adapt persisted progress into milestone input

The derivation core stays free of IO. Stars keep exactly one source of truth.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 8: The celebration queue hook

**Files:**
- Create: `apps/web/src/lib/progression/use-celebration-queue.ts`
- Test: `apps/web/src/lib/progression/__tests__/use-celebration-queue.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3-7.
- Produces: `useCelebrationQueue(): { current: CelebrationStep | null; resolve(args): void; dismissCurrent(): void; openContent(id, piece?): void; }`

**Contract:** `resolve()` derives, **persists**, then exposes the queue. `dismissCurrent()` stamps `celebratedAt` and advances. The session limit is never consulted here — the caller evaluates it only after `current` is null.

- [ ] **Step 1: Write the failing test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCelebrationQueue } from "@/lib/progression/use-celebration-queue";
import { getMilestoneStore } from "@/lib/progression/milestone-storage";
import type { GatherArgs } from "@/lib/progression/gather-input";

const solveArgs: GatherArgs = {
  piece: "rook",
  progressByPiece: {
    rook: { piece: "rook", currentId: null, stars: { "rook-1": 2, "rook-2": 2 } },
  },
  dailyStars: 4,
  sessionQuotaExhausted: false,
  badgeClaimed: false,
  allLabyrinthsComplete: false,
  hadGreatSessionBefore: false,
};

describe("useCelebrationQueue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists the event BEFORE it exposes the overlay", () => {
    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(solveArgs);
    });

    // On disk already — an app killed right now loses nothing.
    expect(getMilestoneStore().events["first-reward"]).toBeDefined();
    expect(result.current.current?.id).toBe("first-reward");
  });

  it("stamps celebratedAt on dismiss and does not replay the overlay", () => {
    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(solveArgs);
    });
    act(() => {
      result.current.dismissCurrent();
    });

    expect(result.current.current).toBeNull();
    expect(getMilestoneStore().events["first-reward"].celebratedAt).toBeDefined();

    act(() => {
      result.current.resolve(solveArgs);
    });
    expect(result.current.current).toBeNull();
  });

  it("clears the NEW dot when the content is opened", () => {
    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(solveArgs);
    });
    act(() => {
      result.current.openContent("first-reward");
    });

    expect(getMilestoneStore().events["first-reward"].openedAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/use-celebration-queue.test.tsx`
Expected: FAIL — cannot resolve `@/lib/progression/use-celebration-queue`.

- [ ] **Step 3: Write the minimal implementation**

```ts
"use client";

import { useCallback, useState } from "react";
import type { PieceId } from "@/lib/game/types";
import { buildCelebrationQueue, type CelebrationStep } from "./celebration-queue";
import { gatherMilestoneInput, type GatherArgs } from "./gather-input";
import { deriveEarnedMilestones } from "./milestones";
import {
  getMilestoneStore,
  markCelebrated,
  markOpened,
  recordEarned,
  selectPending,
} from "./milestone-storage";
import type { MilestoneId } from "./types";

export function useCelebrationQueue() {
  const [queue, setQueue] = useState<CelebrationStep[]>([]);

  /** Evaluate → PERSIST → build → expose. Persistence precedes rendering:
   *  an overlay is a consequence of having recorded the event, never the
   *  cause of it. */
  const resolve = useCallback((args: GatherArgs) => {
    const input = gatherMilestoneInput(args);
    const earned = deriveEarnedMilestones(input);
    const store = recordEarned(earned);
    setQueue(buildCelebrationQueue(selectPending(store)));
  }, []);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => {
      const [current, ...rest] = prev;
      if (!current) return prev;
      markCelebrated(current.id, current.piece);
      // An absorbed event is recognized with its closer — it must not be
      // left pending and resurface as a stray overlay later.
      for (const id of current.absorbed) {
        markCelebrated(id, current.piece);
      }
      return rest;
    });
  }, []);

  /** Releases a recognition that was absorbed by a claim flow the player
   *  cancelled. Recognition never depends on signing a transaction. */
  const releaseAbsorbed = useCallback((step: CelebrationStep) => {
    const store = getMilestoneStore();
    const pending = selectPending(store).filter((event) =>
      step.absorbed.includes(event.id),
    );
    setQueue(buildCelebrationQueue(pending));
  }, []);

  const openContent = useCallback((id: MilestoneId, piece?: PieceId) => {
    markOpened(id, piece);
  }, []);

  return {
    current: queue[0] ?? null,
    resolve,
    dismissCurrent,
    releaseAbsorbed,
    openContent,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/use-celebration-queue.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/progression/use-celebration-queue.ts apps/web/src/lib/progression/__tests__/use-celebration-queue.test.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): drain the celebration queue

Evaluate, persist, then render. A cancelled claim releases whatever
recognition it absorbed, so praise never rides on a signature.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 9: The shared unlock overlay

**Files:**
- Create: `apps/web/src/components/progression/unlock-overlay.tsx`
- Modify: `apps/web/src/lib/content/editorial.ts` (add `PROGRESSION_COPY`)
- Modify: `apps/web/src/lib/content/messages/es.ts` (mirror the keys by hand)
- Test: `apps/web/src/components/progression/__tests__/unlock-overlay.test.tsx`

**Interfaces:**
- Consumes: `CelebrationStep` (Task 4).
- Produces: `<UnlockOverlay step onPrimary onDismiss />`.

**Copy rules:** titles ≤ 5 words, no web3 jargon, no em-dashes. Add to `editorial.ts` and mirror in `messages/es.ts` in the same commit. **Never hand-edit `messages/en.ts`.**

- [ ] **Step 1: Add the copy to `editorial.ts`**

```ts
export const PROGRESSION_COPY = {
  "first-reward": {
    title: "First Reward Earned",
    body: "Practice pays. Open your gift.",
    primary: "Open Gift",
    dismiss: "Later",
  },
  "first-labyrinth": {
    title: "First Maze Unlocked",
    body: "Guide the rook through it.",
    primary: "Enter Maze",
    dismiss: "Later",
  },
  "special-training": {
    title: "Special Training Unlocked",
    body: "Coordinate the rook and the king.",
    primary: "Start Training",
    dismiss: "Later",
  },
  "piece-badge-eligible": {
    title: "Badge Ready to Claim",
    body: "Ten stars. The badge is yours.",
    primary: "Claim Badge",
    dismiss: "Later",
  },
  mastery: {
    title: "Piece Mastered",
    body: "Every exercise, every maze.",
    primary: "Continue",
    dismiss: "Close",
  },
  "great-focus-session": {
    title: "Great Focus Session",
    body: "A deep session, done.",
    primary: "Continue",
    dismiss: "Close",
  },
  absorbed: {
    "great-focus-session": "Great Focus Session recognized.",
    "first-great-session": "Badge unlocked: First Great Session",
    "piece-badge-eligible": "Your badge is ready to claim.",
  },
} as const;
```

Mirror the same keys in `apps/web/src/lib/content/messages/es.ts` under `PROGRESSION_COPY`.

- [ ] **Step 2: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnlockOverlay } from "@/components/progression/unlock-overlay";

describe("UnlockOverlay", () => {
  it("names what was unlocked and offers a way in", () => {
    render(
      <UnlockOverlay
        step={{ id: "special-training", absorbed: [] }}
        onPrimary={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Special Training Unlocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Training" })).toBeInTheDocument();
  });

  it("renders an absorbed recognition as a line, never as a second modal", () => {
    render(
      <UnlockOverlay
        step={{
          id: "mastery",
          piece: "rook",
          absorbed: ["great-focus-session", "first-great-session"],
        }}
        onPrimary={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Piece Mastered")).toBeInTheDocument();
    expect(screen.getByText("Great Focus Session recognized.")).toBeInTheDocument();
    expect(
      screen.getByText("Badge unlocked: First Great Session"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/progression/__tests__/unlock-overlay.test.tsx`
Expected: FAIL — cannot resolve `@/components/progression/unlock-overlay`.

- [ ] **Step 4: Write the minimal implementation**

The overlay reuses the existing correct-exercise celebration shell. The earned artifact replaces the wolf as the central icon.

```tsx
"use client";

import Image from "next/image";
import { PROGRESSION_COPY } from "@/lib/content/editorial";
import type { CelebrationStep } from "@/lib/progression/celebration-queue";
import type { MilestoneId } from "@/lib/progression/types";

const ICONS: Partial<Record<MilestoneId, string>> = {
  "first-reward": "/art/welcome-package/focus-stamp-day1",
  "first-labyrinth": "/art/new-icons-chesscito/labyrinth-icon-v1",
  "special-training": "/art/new-icons-chesscito/training-icon-v1",
  "piece-badge-eligible": "/art/achievements/1day-focus",
  mastery: "/art/new-icons-chesscito/training-icon-v1",
  "great-focus-session": "/art/achievements/1day-focus",
};

type Props = {
  step: CelebrationStep;
  onPrimary: () => void;
  onDismiss: () => void;
};

export function UnlockOverlay({ step, onPrimary, onDismiss }: Props) {
  const copy = PROGRESSION_COPY[step.id as keyof typeof PROGRESSION_COPY];
  if (!copy || !("title" in copy)) return null;
  const icon = ICONS[step.id];

  return (
    <div role="dialog" aria-modal="true" className="progression-overlay">
      {icon ? (
        <picture className="progression-overlay-icon">
          <source srcSet={`${icon}.avif`} type="image/avif" />
          <source srcSet={`${icon}.webp`} type="image/webp" />
          <Image src={`${icon}.png`} alt="" width={128} height={128} />
        </picture>
      ) : null}

      <h2 className="progression-overlay-title">{copy.title}</h2>
      <p className="progression-overlay-body">{copy.body}</p>

      {step.absorbed.map((id) => {
        const line =
          PROGRESSION_COPY.absorbed[
            id as keyof typeof PROGRESSION_COPY.absorbed
          ];
        return line ? (
          <p key={id} className="progression-overlay-absorbed">
            {line}
          </p>
        ) : null;
      })}

      <button type="button" className="cta-primary" onClick={onPrimary}>
        {copy.primary}
      </button>
      <button type="button" className="cta-ghost" onClick={onDismiss}>
        {copy.dismiss}
      </button>
    </div>
  );
}
```

Add the `.progression-overlay*` classes to `apps/web/src/styles/exercises.css` (the overlay is only consumed by the exercises surface). Reuse the existing CTA token families — do not mint a new one.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/progression/__tests__/unlock-overlay.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/progression apps/web/src/lib/content/editorial.ts apps/web/src/lib/content/messages/es.ts apps/web/src/styles/exercises.css
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): shared unlock overlay

The earned artifact replaces the wolf as the central icon, and an absorbed
recognition renders as a line inside the closer rather than a second modal.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 10: Unbundle the gift from the First Focus Day badge

**Files:**
- Modify: `apps/web/src/components/daily/daily-tactic-slot.tsx:111-116`
- Modify: `apps/web/src/components/hub/hub-daily-tile.tsx:150-160`
- Modify: `apps/web/src/lib/welcome-package/use-welcome-package.ts:33-54`
- Test: `apps/web/src/components/daily/__tests__/daily-tactic-slot-unbundle.test.tsx`

**This is the defect the whole spec exists for.** One `if` currently grants a continuity badge and a reward:

```ts
if (CHESSCITO_LITE_MODE && prev.totalCompleted === 0) {
  firstFocusDayJustEarned.current = true;
  welcomePackage.unlock();   // ← must go
}
```

`first-focus-day` stays exactly as it is. Only `welcomePackage.unlock()` moves out — the gift now belongs to `first-reward` in the milestone machine.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { getWelcomePackageState } from "@/lib/welcome-package/storage";
import { getDailyProgress } from "@/lib/daily/progress";

describe("the gift is no longer bundled with the first Daily Focus", () => {
  it("does not unlock the gift when the first daily tactic is solved", async () => {
    localStorage.clear();
    // Solve the first Daily Focus. Render the slot and complete it — see the
    // existing daily-tactic-slot tests for the harness this file reuses.
    await solveFirstDailyFocus();

    expect(getDailyProgress().totalCompleted).toBe(1);
    expect(getWelcomePackageState().unlocked).toBe(false);
  });
});
```

Reuse the render harness already present in the existing `daily-tactic-slot` test file rather than inventing a new one; `solveFirstDailyFocus()` is a local helper that renders the slot and drives it to `handleSolve`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/daily/__tests__/daily-tactic-slot-unbundle.test.tsx`
Expected: FAIL — `unlocked` is `true`.

- [ ] **Step 3: Remove the bundling**

In `daily-tactic-slot.tsx`, the block becomes:

```ts
if (CHESSCITO_LITE_MODE && prev.totalCompleted === 0) {
  firstFocusDayJustEarned.current = true;
}
```

Apply the identical removal in `hub-daily-tile.tsx:155`. Drop the now-unused `useWelcomePackage` import from both files if nothing else consumes it.

In `use-welcome-package.ts`, delete the retroactive init that reads `totalCompleted >= 1` (lines 42-51). The gift's condition now lives in `deriveEarnedMilestones`, and the seeding in Task 6 owns the migration.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/daily`
Expected: PASS. The existing `first-focus-day` assertions must still pass untouched.

- [ ] **Step 5: Run the full suite**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run`
Expected: PASS. Report the count in the commit message.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/daily apps/web/src/components/hub/hub-daily-tile.tsx apps/web/src/lib/welcome-package/use-welcome-package.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "fix(progression): unbundle the gift from the first focus day

One if granted a continuity badge and a reward together, so the gift landed
before any investment existed to reward. first-focus-day is untouched and
still fires on the first Daily Focus; the gift now belongs to first-reward.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 11: The labyrinth exercise floor

**Files:**
- Modify: `apps/web/src/lib/training/path.ts:66-121`
- Test: `apps/web/src/lib/training/__tests__/path.test.ts` (extend the existing file)

**Interfaces:**
- Produces: `LABYRINTH_MIN_EXERCISES = 3`; `TrainingPathInput` gains `completedExercises?: number`.

**Why:** without the floor, a perfect player hits 6 stars on exercise 2 and takes the gift and the labyrinth on the same solve. Neither feels earned.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildTrainingPath } from "@/lib/training/path";

describe("the first labyrinth needs an exercise floor, not just stars", () => {
  it("stays locked at 6 stars across only 2 exercises", () => {
    const path = buildTrainingPath({
      piece: "rook",
      progress: { piece: "rook", currentId: null, stars: { "rook-1": 3, "rook-2": 3 } },
      labyrinthBests: {},
      badgeClaimed: false,
    });
    const firstLab = path.find((node) => node.kind === "labyrinth");
    expect(firstLab?.status).toBe("locked");
  });

  it("unlocks at 6 stars across 3 exercises", () => {
    const path = buildTrainingPath({
      piece: "rook",
      progress: {
        piece: "rook",
        currentId: null,
        stars: { "rook-1": 3, "rook-2": 2, "rook-3": 1 },
      },
      labyrinthBests: {},
      badgeClaimed: false,
    });
    const firstLab = path.find((node) => node.kind === "labyrinth");
    expect(firstLab?.status).toBe("available");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/training/__tests__/path.test.ts`
Expected: FAIL — the first labyrinth is `available` at 2 exercises.

- [ ] **Step 3: Add the floor**

In `path.ts`, beside `LABYRINTH_UNLOCK_THRESHOLD`:

```ts
/** Companion floor to LABYRINTH_UNLOCK_THRESHOLD. Stars alone let a perfect
 *  player unlock the maze on exercise 2, colliding with the first reward.
 *  The floor keeps the two milestones a solve apart. */
export const LABYRINTH_MIN_EXERCISES = 3;
```

Inside `buildTrainingPath`, derive the count from the same sparse map that already feeds `totalStars` and require both:

```ts
const completedExercises = Object.values(progress.stars).filter(
  (value) => value > 0,
).length;

const meetsFirstLabGate =
  totalStars >= LABYRINTH_UNLOCK_THRESHOLD &&
  completedExercises >= LABYRINTH_MIN_EXERCISES;
```

Then replace the `index === 0` unlock check:

```ts
const unlocked = index === 0 ? meetsFirstLabGate : previousComplete;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/training`
Expected: PASS. Existing path tests that assumed a star-only gate may need their fixtures widened to 3 exercises — update them, they are asserting the old rule.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/training
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): floor the first labyrinth at 3 exercises

Stars alone let a perfect player take the gift and the maze on the same solve.
The floor keeps the two milestones a solve apart.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 12: An honest NEW dot on Special Training

**Files:**
- Modify: `apps/web/src/components/hub/hub-arena-tile.tsx:51-54`
- Test: `apps/web/src/components/hub/__tests__/hub-arena-tile.test.tsx`

**The defect:** the tile carries a permanently-lit `HubTileStatusChip kind="ready"`. The dot means "this button exists", not "something new is here".

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { HubArenaTile } from "@/components/hub/hub-arena-tile";
import { markOpened, recordEarned } from "@/lib/progression/milestone-storage";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";

const setup = MINI_ARENA_SETUPS[0];

describe("HubArenaTile NEW dot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows NEW while the unlocked content has never been opened", () => {
    recordEarned([{ id: "special-training" }]);
    render(<HubArenaTile setup={setup} unlocked />);
    expect(screen.getByTestId("hub-tile-new")).toBeInTheDocument();
  });

  it("drops the dot once the player has opened it", () => {
    recordEarned([{ id: "special-training" }]);
    markOpened("special-training");
    render(<HubArenaTile setup={setup} unlocked />);
    expect(screen.queryByTestId("hub-tile-new")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/hub/__tests__/hub-arena-tile.test.tsx`
Expected: FAIL — no `hub-tile-new` testid exists.

- [ ] **Step 3: Drive the chip from `openedAt`**

In `hub-arena-tile.tsx`, replace the static chip:

```tsx
import { getMilestoneStore, markOpened } from "@/lib/progression/milestone-storage";

// ...inside the component, after `if (!unlocked) return null;`
const [isNew, setIsNew] = useState(
  () => getMilestoneStore().events["special-training"]?.openedAt === undefined,
);
```

and in `onClick`:

```tsx
onClick={() => {
  markOpened("special-training");
  setIsNew(false);
  setEverOpened(true);
  setOpen(true);
}}
badge={isNew ? <HubTileStatusChip kind="new" data-testid="hub-tile-new" /> : null}
```

Add the `new` kind to `HubTileStatusChip` if it does not exist, reusing the existing chip token family. Do not mint a sixth CTA family.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/hub`
Expected: PASS.

- [ ] **Step 5: Refresh the visual baselines**

The hub rail changed. Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web test:e2e:visual`
If the Special Training tile diff is expected, update the baselines **in this same commit**. A stale baseline never crosses a PR boundary.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/hub apps/web/tests
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): an honest NEW dot on special training

The chip was permanently lit, so it meant 'this button exists' rather than
'something new is here'. It now clears the first time the player opens it.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 13: Wire the queue into the exercises screen

**Files:**
- Modify: `apps/web/src/components/exercises/exercises-screen.tsx`
- Modify: `apps/web/src/components/exercises/exercises-save-flow-logic.ts`
- Test: `apps/web/src/components/exercises/__tests__/celebration-order.test.tsx`

**Contract (spec, evaluation order):**

```text
1. Record the activity (stars, bests, consumed slot)
2. Evaluate every milestone condition
3. PERSIST every fired event
4. Build and drain the celebration queue
5. Render
6. Return the player to the experience
7. Only THEN, on the next attempt to start an activity, evaluate the session limit
```

The session limit must never be consulted while `current` is non-null.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";

describe("celebration order on the exercises screen", () => {
  it("never shows the session limit while a recognition is pending", async () => {
    // Drive a solve that exhausts the quota at 7 daily stars: the Great Focus
    // Session must be recognized, and the limit card must not be on screen.
    await solveExerciseExhaustingQuota({ dailyStarsBefore: 7 });

    expect(screen.getByText("Great Focus Session")).toBeInTheDocument();
    expect(screen.queryByText("Great focus today.")).not.toBeInTheDocument();
  });

  it("shows the gift overlay before the maze overlay, never stacked", async () => {
    await solveExerciseUnlockingGiftAndMaze();

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("First Reward Earned")).toBeInTheDocument();
  });
});
```

Reuse the render harness in the existing `exercises-screen` test files.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/exercises/__tests__/celebration-order.test.tsx`
Expected: FAIL — the limit card renders and no unlock overlay exists.

- [ ] **Step 3: Wire it**

In the save flow, after the activity is recorded and the daily star ledger is updated with `netStars`, call `resolve()` with the gathered args, then render `<UnlockOverlay>` while `current` is non-null. Gate the existing daily-limit guard on `current === null`.

```tsx
const celebration = useCelebrationQueue();

// after recording the solve and adding netStars to the daily ledger:
celebration.resolve({
  piece,
  progressByPiece,
  dailyStars: getDailyStars(),
  sessionQuotaExhausted: isSessionOver(getDailySession()),
  badgeClaimed,
  allLabyrinthsComplete,
  hadGreatSessionBefore: hasEverEarned("first-great-session"),
});

// render:
{celebration.current ? (
  <UnlockOverlay
    step={celebration.current}
    onPrimary={() => {
      celebration.openContent(celebration.current!.id, celebration.current!.piece);
      celebration.dismissCurrent();
      navigateToContent(celebration.current!.id);
    }}
    onDismiss={celebration.dismissCurrent}
  />
) : null}

// the limit guard only when nothing is pending:
{celebration.current === null && isSessionOver(session) ? <DailyLimitGuard /> : null}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/components/exercises`
Expected: PASS.

- [ ] **Step 5: Run the full suite and the visual baselines**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run`
Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web test:e2e:visual`
Expected: PASS. Refresh any baseline the new overlay changed, in this commit.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/exercises apps/web/tests
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): the wall never arrives before the praise

The session limit is now evaluated only after every pending recognition has
drained, so the player who burns the quota while struggling gets the
celebration rather than the paywall.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 14: The First Great Session achievement

**Files:**
- Modify: `apps/web/src/lib/achievements/lite.ts`
- Modify: `apps/web/src/components/trophies/achievements-grid.tsx:21,28`
- Modify: `apps/web/src/lib/content/editorial.ts` + `messages/es.ts`
- Test: `apps/web/src/lib/achievements/__tests__/lite.test.ts`

**Interfaces:**
- Consumes: `getMilestoneStore` (Task 5).
- Produces: a fourth Lite achievement, `first-great-session`.

`first-focus-day` keeps its id, its condition and its art. Renaming it would force a re-derivation from a counter existing players do not have, silently revoking a badge they already earned.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { deriveLiteAchievements } from "@/lib/achievements/lite";

const progress = { streak: 1, lastCompletedDate: "2026-07-11", totalCompleted: 1 };

describe("first-great-session", () => {
  it("is unearned before any deep session", () => {
    const achievements = deriveLiteAchievements(progress, false);
    const great = achievements.find((a) => a.id === "first-great-session");
    expect(great?.earned).toBe(false);
  });

  it("is earned once a great focus session has happened", () => {
    const achievements = deriveLiteAchievements(progress, true);
    const great = achievements.find((a) => a.id === "first-great-session");
    expect(great?.earned).toBe(true);
  });

  it("leaves first-focus-day exactly as it was", () => {
    const achievements = deriveLiteAchievements(progress, false);
    const day = achievements.find((a) => a.id === "first-focus-day");
    expect(day?.earned).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/achievements/__tests__/lite.test.ts`
Expected: FAIL — `deriveLiteAchievements` takes one argument.

- [ ] **Step 3: Add the fourth achievement**

```ts
export function deriveLiteAchievements(
  progress: DailyProgress,
  hadGreatSession: boolean,
): Achievement[] {
  const { streak, totalCompleted } = progress;
  const firstDone = totalCompleted >= 1;
  const rhythmDone = streak >= 3;
  const weekDone = streak >= 7;
  return [
    {
      id: "first-focus-day",
      earned: firstDone,
      progress: firstDone ? undefined : { current: Math.min(totalCompleted, 1), goal: 1 },
    },
    {
      id: "first-great-session",
      earned: hadGreatSession,
      progress: hadGreatSession ? undefined : { current: 0, goal: 1 },
    },
    {
      id: "three-day-rhythm",
      earned: rhythmDone,
      progress: rhythmDone ? undefined : { current: Math.min(streak, 3), goal: 3 },
    },
    {
      id: "seven-day-focus",
      earned: weekDone,
      progress: weekDone ? undefined : { current: Math.min(streak, 7), goal: 7 },
    },
  ];
}
```

Callers pass `getMilestoneStore().events["first-great-session"] !== undefined`.

Add the grid entries in `achievements-grid.tsx`:

```ts
"first-great-session": "star",
// and
"first-great-session": "/art/achievements/1day-focus",
```

Reuse an existing achievement asset — do not upscale a low-res sprite, and do not commission new art in this cluster. Add the title and description to `editorial.ts` and mirror them in `messages/es.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/achievements src/components/trophies`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run`
Expected: PASS. Report the count.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/achievements apps/web/src/components/trophies apps/web/src/lib/content
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): add first-great-session as a fourth achievement

Continuity and depth are two behaviors, so they get two badges.
first-focus-day keeps its id, condition and art — renaming it would revoke a
badge players already earned.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 15: Run the migration once, on hub mount

**Files:**
- Modify: `apps/web/src/components/hub/legacy-hub-client.tsx`
- Test: `apps/web/src/lib/progression/__tests__/migration-integration.test.tsx`

**Why here:** `legacy-hub-client` is the one component guaranteed to mount for every returning player. Seeding must run before any surface can derive a milestone, or an existing player gets a parade of retroactive overlays on first launch.

**Careful:** `useShieldSync` mounts here too and only here (`legacy-hub-client.tsx:186`). That single-mount fragility is the exact class of bug that produced the shield credited-cache defect. Seeding is idempotent, so a single mount is safe — but it must not be the *only* writer of anything.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { getMilestoneStore } from "@/lib/progression/milestone-storage";

describe("migration on hub mount", () => {
  it("seeds a returning player without firing any overlay", async () => {
    localStorage.clear();
    seedLegacyProgress({ rookStars: 14, exercisesSolved: 6, giftClaimed: true });

    renderHub();

    const store = getMilestoneStore();
    expect(store.events["first-reward"].celebratedAt).toBeDefined();
    expect(store.events["special-training"].celebratedAt).toBeDefined();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression/__tests__/migration-integration.test.tsx`
Expected: FAIL — the store is empty.

- [ ] **Step 3: Run the seed on mount**

```tsx
useEffect(() => {
  const store = getMilestoneStore();
  const input = gatherMilestoneInput({
    piece: "rook",
    progressByPiece,
    dailyStars: 0,
    sessionQuotaExhausted: false,
    badgeClaimed,
    allLabyrinthsComplete,
    hadGreatSessionBefore: false,
  });
  const welcome = getWelcomePackageState();
  const seeded = seedExistingPlayer(
    store,
    input,
    welcome.claimed,
    new Date().toISOString(),
  );
  if (seeded !== store) persistMilestoneStore(seeded);
}, []);
```

Export `persistMilestoneStore` from `milestone-storage.ts` for this one caller.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/progression`
Expected: PASS.

- [ ] **Step 5: Run the full suite and the visual baselines**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run`
Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web test:e2e:visual`
Expected: PASS, 51/51 visual.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/hub/legacy-hub-client.tsx apps/web/src/lib/progression
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(progression): seed returning players on hub mount

A player who already passed a milestone must not be greeted by a parade of
retroactive overlays. Seeding is idempotent and stamps them as celebrated.

Wolfcito 🐾 @akawolfcito"
```

---

## Manual verification

Before opening the PR, drive the real screens — a green suite can verify a dead
shape, and two green suites in isolation do not prove their composition.

1. `pnpm -C apps/web dev`. Check `env | grep NEXT_PUBLIC` first: an exported flag beats `.env.local`.
2. Reset via `/dev/reset`. Solve exercise 1 with 3 stars. **No gift.**
3. Solve exercise 2. **Gift overlay.** Dismiss it. The NEW dot is on the gift.
4. Solve exercise 3. **Maze overlay**, not stacked with the gift.
5. Open the gift. The NEW dot clears and does not come back on reload.
6. Reach 8 daily stars. **Great Focus Session**, with `First Great Session` as a line inside it, not a second modal.
7. Kill the app mid-overlay. Reopen. The celebration does not replay and the reward is still there.
8. Reach 10 rook stars, open the claim, **cancel it**. Eligibility survives and any absorbed session is still recognized.
9. Burn the quota while failing. The **celebration** appears, never the paywall first.
10. Load a pre-existing profile (12+ rook stars). **No retroactive overlays.**

## Definition of done

- Full suite green. Report the count against the 4875 baseline.
- `pnpm exec tsc --noEmit` clean.
- Visual baselines refreshed in the same PR that changed the UI.
- Every row of the spec's test matrix has a passing test.
- No new copy in `messages/en.ts` written by hand.

---

Wolfcito 🐾 @akawolfcito
