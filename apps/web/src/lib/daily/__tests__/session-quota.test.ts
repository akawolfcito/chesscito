// apps/web/src/lib/daily/__tests__/session-quota.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FREE_EXTRA_QUOTA,
  SESSION_EXERCISE_LIMIT,
  HARD_MAX_EXTRAS,
  PACK_EXTRA_SLOTS,
  buildContentId,
  getUsedCount,
  getTotalSlots,
  getRemainingSlots,
  isAtFreeLimit,
  isAtHardMax,
  isSessionOver,
  shouldFreezeScoring,
  parseSessionLimit,
  parseDailySession,
  computeRecordExtra,
  computeApplyDevUnlock,
  type DailySessionState,
} from "@/lib/daily/session-quota";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TODAY = "2026-06-23";

function freshSession(): DailySessionState {
  return { date: TODAY, consumedContentIds: [], paidUnlocked: 0 };
}

function sessionWith(ids: string[], paidUnlocked = 0): DailySessionState {
  return { date: TODAY, consumedContentIds: ids, paidUnlocked };
}

// ─── buildContentId ───────────────────────────────────────────────────────────

describe("buildContentId", () => {
  it("formats exercise ID with piece prefix", () => {
    expect(buildContentId("exercise", "rook", "rook-1")).toBe("exercise:rook:rook-1");
  });
  it("formats labyrinth ID with piece prefix", () => {
    expect(buildContentId("labyrinth", "bishop", "bishop-lab-1")).toBe("labyrinth:bishop:bishop-lab-1");
  });
  it("different pieces produce different IDs for the same exercise id", () => {
    expect(buildContentId("exercise", "rook", "ex-1")).not.toBe(
      buildContentId("exercise", "bishop", "ex-1"),
    );
  });
  it("exercise and labyrinth with same piece+id produce different IDs", () => {
    expect(buildContentId("exercise", "rook", "rook-1")).not.toBe(
      buildContentId("labyrinth", "rook", "rook-1"),
    );
  });
});

// ─── parseDailySession ───────────────────────────────────────────────────────

describe("parseDailySession", () => {
  it("returns fresh session for null input", () => {
    const s = parseDailySession(null, TODAY);
    expect(s.date).toBe(TODAY);
    expect(s.consumedContentIds).toEqual([]);
    expect(s.paidUnlocked).toBe(0);
  });

  it("returns fresh session when stored date is yesterday", () => {
    const stale = JSON.stringify({ date: "2026-06-22", consumedContentIds: ["exercise:rook:rook-1"], paidUnlocked: 1 });
    const s = parseDailySession(stale, TODAY);
    expect(s.consumedContentIds).toEqual([]);
    expect(s.paidUnlocked).toBe(0);
  });

  it("preserves state when stored date matches today", () => {
    const stored: DailySessionState = { date: TODAY, consumedContentIds: ["exercise:rook:rook-1"], paidUnlocked: 0 };
    const s = parseDailySession(JSON.stringify(stored), TODAY);
    expect(s.consumedContentIds).toEqual(["exercise:rook:rook-1"]);
    expect(s.paidUnlocked).toBe(0);
  });

  it("returns fresh session for malformed JSON", () => {
    const s = parseDailySession("{not-json}", TODAY);
    expect(s.consumedContentIds).toEqual([]);
  });
});

// ─── getUsedCount ─────────────────────────────────────────────────────────────

describe("getUsedCount", () => {
  it("returns 0 for fresh session", () => {
    expect(getUsedCount(freshSession())).toBe(0);
  });
  it("returns length of consumed IDs", () => {
    expect(getUsedCount(sessionWith(["exercise:rook:rook-1", "exercise:rook:rook-2"]))).toBe(2);
  });
});

// ─── getTotalSlots ────────────────────────────────────────────────────────────

describe("getTotalSlots", () => {
  it("returns FREE_EXTRA_QUOTA when no packs unlocked", () => {
    expect(getTotalSlots(freshSession())).toBe(FREE_EXTRA_QUOTA);
  });
  it("returns FREE + PACK_EXTRA_SLOTS when 1 pack unlocked", () => {
    expect(getTotalSlots(sessionWith([], 1))).toBe(FREE_EXTRA_QUOTA + PACK_EXTRA_SLOTS);
  });
  it("caps at HARD_MAX_EXTRAS", () => {
    // 3 packs would be 3+15=18 but capped at 13
    expect(getTotalSlots(sessionWith([], 10))).toBe(HARD_MAX_EXTRAS);
  });
});

// ─── getRemainingSlots ────────────────────────────────────────────────────────

describe("getRemainingSlots", () => {
  it("returns totalSlots when nothing consumed", () => {
    expect(getRemainingSlots(freshSession())).toBe(FREE_EXTRA_QUOTA);
  });
  it("decreases as content is consumed", () => {
    const s = sessionWith(["exercise:rook:rook-1"]);
    expect(getRemainingSlots(s)).toBe(FREE_EXTRA_QUOTA - 1);
  });
  it("returns 0 when at free limit (no paid)", () => {
    const ids = Array.from({ length: FREE_EXTRA_QUOTA }, (_, i) => `exercise:rook:rook-${i + 1}`);
    expect(getRemainingSlots(sessionWith(ids))).toBe(0);
  });
});

// ─── isAtFreeLimit ────────────────────────────────────────────────────────────

describe("isAtFreeLimit", () => {
  it("false when nothing consumed", () => {
    expect(isAtFreeLimit(freshSession())).toBe(false);
  });
  it("false when only 2 consumed", () => {
    expect(isAtFreeLimit(sessionWith(["exercise:rook:rook-1", "exercise:rook:rook-2"]))).toBe(false);
  });
  it("false when only 3 consumed (free quota is now 5)", () => {
    const ids = ["exercise:rook:rook-1", "exercise:rook:rook-2", "exercise:rook:rook-3"];
    expect(isAtFreeLimit(sessionWith(ids, 0))).toBe(false);
  });
  it("true when 5 consumed and no paid packs", () => {
    const ids = Array.from({ length: 5 }, (_, i) => `exercise:rook:rook-${i + 1}`);
    expect(isAtFreeLimit(sessionWith(ids, 0))).toBe(true);
  });
  it("false when 5 consumed but has paid pack (remaining slots available)", () => {
    const ids = Array.from({ length: 5 }, (_, i) => `exercise:rook:rook-${i + 1}`);
    expect(isAtFreeLimit(sessionWith(ids, 1))).toBe(false);
  });
  it("false when at hard max (uses isAtHardMax instead)", () => {
    const ids = Array.from({ length: HARD_MAX_EXTRAS }, (_, i) => `exercise:rook:rook-${i + 1}`);
    // At hard max with 2 paid packs → not "free limit" (isAtHardMax is the right check)
    expect(isAtFreeLimit(sessionWith(ids, 2))).toBe(false);
  });
});

// ─── isAtHardMax ─────────────────────────────────────────────────────────────

describe("isAtHardMax", () => {
  it("false when nothing consumed", () => {
    expect(isAtHardMax(freshSession())).toBe(false);
  });
  it("false when 12 consumed", () => {
    const ids = Array.from({ length: HARD_MAX_EXTRAS - 1 }, (_, i) => `exercise:rook:rook-${i}`);
    expect(isAtHardMax(sessionWith(ids, 2))).toBe(false);
  });
  it("true when 15 consumed", () => {
    const ids = Array.from({ length: HARD_MAX_EXTRAS }, (_, i) => `exercise:rook:rook-${i}`);
    expect(isAtHardMax(sessionWith(ids, 2))).toBe(true);
  });
});

// ─── computeRecordExtra ──────────────────────────────────────────────────────

describe("computeRecordExtra", () => {
  it("adds new contentId", () => {
    const next = computeRecordExtra(freshSession(), "exercise:rook:rook-1");
    expect(next.consumedContentIds).toContain("exercise:rook:rook-1");
    expect(getUsedCount(next)).toBe(1);
  });

  it("is idempotent — same contentId twice does not add another slot", () => {
    const s1 = computeRecordExtra(freshSession(), "exercise:rook:rook-1");
    const s2 = computeRecordExtra(s1, "exercise:rook:rook-1");
    expect(getUsedCount(s2)).toBe(1);
    expect(s2).toBe(s1); // same reference — no mutation
  });

  it("returns same state (no-op) when at hard max", () => {
    const ids = Array.from({ length: HARD_MAX_EXTRAS }, (_, i) => `exercise:rook:rook-${i}`);
    const atMax = sessionWith(ids, 2);
    const next = computeRecordExtra(atMax, "exercise:rook:rook-99");
    expect(next).toBe(atMax);
    expect(getUsedCount(next)).toBe(HARD_MAX_EXTRAS);
  });

  it("different contentIds consume separate slots", () => {
    let s = freshSession();
    s = computeRecordExtra(s, "exercise:rook:rook-1");
    s = computeRecordExtra(s, "exercise:rook:rook-2");
    s = computeRecordExtra(s, "labyrinth:rook:rook-lab-1");
    expect(getUsedCount(s)).toBe(3);
  });

  it("exercise and labyrinth with same localId are distinct", () => {
    let s = freshSession();
    s = computeRecordExtra(s, buildContentId("exercise", "rook", "rook-1"));
    s = computeRecordExtra(s, buildContentId("labyrinth", "rook", "rook-1"));
    expect(getUsedCount(s)).toBe(2);
  });
});

// ─── computeApplyDevUnlock ───────────────────────────────────────────────────

describe("computeApplyDevUnlock", () => {
  it("increments paidUnlocked by 1", () => {
    const next = computeApplyDevUnlock(freshSession());
    expect(next.paidUnlocked).toBe(1);
  });

  it("caps at MAX_PAID_PACKS (2)", () => {
    let s = computeApplyDevUnlock(freshSession());
    s = computeApplyDevUnlock(s);
    s = computeApplyDevUnlock(s); // 3rd call — should be no-op
    expect(s.paidUnlocked).toBe(2);
  });
});

// ─── CONSTANTS sanity check ───────────────────────────────────────────────────

describe("constants", () => {
  it("FREE_EXTRA_QUOTA is 5", () => expect(FREE_EXTRA_QUOTA).toBe(5));
  it("PACK_EXTRA_SLOTS is 5", () => expect(PACK_EXTRA_SLOTS).toBe(5));
  it("HARD_MAX_EXTRAS equals free + 2 packs = 15", () => expect(HARD_MAX_EXTRAS).toBe(15));
});

// ─── parseSessionLimit (single env-backed knob) ──────────────────────────────

describe("parseSessionLimit", () => {
  it("defaults to 5 when unset", () => {
    expect(parseSessionLimit(undefined)).toBe(5);
  });
  it("parses a positive integer string", () => {
    expect(parseSessionLimit("8")).toBe(8);
  });
  it("falls back to 5 for non-numeric values", () => {
    expect(parseSessionLimit("abc")).toBe(5);
  });
  it("falls back to 5 for zero or negative values", () => {
    expect(parseSessionLimit("0")).toBe(5);
    expect(parseSessionLimit("-3")).toBe(5);
  });
  it("SESSION_EXERCISE_LIMIT is the source of FREE_EXTRA_QUOTA", () => {
    expect(FREE_EXTRA_QUOTA).toBe(SESSION_EXERCISE_LIMIT);
  });
});

// ─── isSessionOver ───────────────────────────────────────────────────────────

describe("isSessionOver", () => {
  it("false for a fresh session", () => {
    expect(isSessionOver(freshSession())).toBe(false);
  });
  it("true at the free limit (no paid packs)", () => {
    const ids = Array.from({ length: FREE_EXTRA_QUOTA }, (_, i) => `exercise:rook:rook-${i + 1}`);
    expect(isSessionOver(sessionWith(ids, 0))).toBe(true);
  });
  it("false at the free count when a paid pack adds room", () => {
    const ids = Array.from({ length: FREE_EXTRA_QUOTA }, (_, i) => `exercise:rook:rook-${i + 1}`);
    expect(isSessionOver(sessionWith(ids, 1))).toBe(false);
  });
  it("true at hard max", () => {
    const ids = Array.from({ length: HARD_MAX_EXTRAS }, (_, i) => `exercise:rook:rook-${i}`);
    expect(isSessionOver(sessionWith(ids, 2))).toBe(true);
  });
});

// ─── shouldFreezeScoring ─────────────────────────────────────────────────────

describe("shouldFreezeScoring", () => {
  it("never freezes when not in Lite mode", () => {
    const ids = Array.from({ length: FREE_EXTRA_QUOTA }, (_, i) => `exercise:rook:rook-${i + 1}`);
    expect(shouldFreezeScoring(false, sessionWith(ids, 0))).toBe(false);
  });
  it("does not freeze in Lite before the limit", () => {
    expect(shouldFreezeScoring(true, sessionWith(["exercise:rook:rook-1"]))).toBe(false);
  });
  it("freezes in Lite once the session is over", () => {
    const ids = Array.from({ length: FREE_EXTRA_QUOTA }, (_, i) => `exercise:rook:rook-${i + 1}`);
    expect(shouldFreezeScoring(true, sessionWith(ids, 0))).toBe(true);
  });
});
