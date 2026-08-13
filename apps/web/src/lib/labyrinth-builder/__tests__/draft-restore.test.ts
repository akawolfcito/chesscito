/**
 * Carrying the draft across the reload a save causes.
 *
 * ⚠️ Founder, while authoring: change a board → Save draft → the board comes
 * back BLANK, and re-editing the same record means hunting for it again from the
 * piece picker. Save writes into the tree Next dev watches, Fast Refresh
 * remounts, and every useState resets.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { emptyState, type BuilderState } from "../state";
import {
  clearStoredDraft,
  readStoredDraft,
  storeDraft,
  type StoredDraft,
} from "../draft-restore";

function draft(over: Partial<StoredDraft> = {}): StoredDraft {
  const state: BuilderState = {
    ...emptyState("bishop", "exercise"),
    id: "bishop-3",
    start: "a1",
    goal: "h8",
    walls: ["c3"],
    order: 4,
  };
  return { bucket: "exercise", state, extras: {}, savedOk: true, ...over };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storeDraft / readStoredDraft", () => {
  it("round-trips the draft that was on screen", () => {
    const d = draft();
    storeDraft(d);
    expect(readStoredDraft()).toEqual(d);
  });

  it("is READ-ONCE — a restore must not repeat on the next mount", () => {
    storeDraft(draft());
    expect(readStoredDraft()).not.toBeNull();
    expect(readStoredDraft()).toBeNull();
  });

  it("returns null when nothing was stored", () => {
    expect(readStoredDraft()).toBeNull();
  });

  it("carries the record identity, so the same board reopens", () => {
    // The whole point: you land back ON the record you just saved.
    storeDraft(draft());
    expect(readStoredDraft()?.state.id).toBe("bishop-3");
    expect(readStoredDraft.length).toBe(0);
  });

  it("carries the extras the UI cannot draw", () => {
    storeDraft(draft({ extras: { title: "Old", starFloor: 1 } }));
    expect(readStoredDraft()?.extras).toEqual({ title: "Old", starFloor: 1 });
  });

  describe("savedOk — which side of the guard the restored draft lands on", () => {
    it("survives a true", () => {
      storeDraft(draft({ savedOk: true }));
      expect(readStoredDraft()?.savedOk).toBe(true);
    });

    it("survives a false", () => {
      storeDraft(draft({ savedOk: false }));
      expect(readStoredDraft()?.savedOk).toBe(false);
    });

    it("defaults to FALSE when the flag is missing", () => {
      // ⛔ Must land on "there might be unsaved work here", never on "disk
      // already has this" — the second would tell the unsaved-changes guard
      // there is nothing to lose and let the next click destroy it silently.
      window.sessionStorage.setItem(
        "chesscito:builder-draft",
        JSON.stringify({ ...draft(), savedOk: undefined }),
      );
      expect(readStoredDraft()?.savedOk).toBe(false);
    });
  });

  describe("junk must never take down the only tool that can author content", () => {
    const junk: [string, string][] = [
      ["unparseable", "{not json"],
      ["null", "null"],
      ["a bare array", "[]"],
      ["an unknown bucket", JSON.stringify({ ...draft(), bucket: "nope" })],
      ["no state", JSON.stringify({ bucket: "exercise", extras: {} })],
      [
        "a state with no piece",
        JSON.stringify({
          ...draft(),
          state: { ...draft().state, piece: undefined },
        }),
      ],
      [
        "a state with no walls array",
        JSON.stringify({
          ...draft(),
          state: { ...draft().state, walls: undefined },
        }),
      ],
    ];

    for (const [what, raw] of junk) {
      it(`returns null for ${what}`, () => {
        window.sessionStorage.setItem("chesscito:builder-draft", raw);
        expect(readStoredDraft()).toBeNull();
      });
    }
  });

  it("does not throw when storage itself throws (private-mode Safari)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => storeDraft(draft())).not.toThrow();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readStoredDraft()).toBeNull();

    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearStoredDraft()).not.toThrow();
  });
});

describe("clearStoredDraft", () => {
  it("drops a pending restore", () => {
    storeDraft(draft());
    clearStoredDraft();
    expect(readStoredDraft()).toBeNull();
  });
});
