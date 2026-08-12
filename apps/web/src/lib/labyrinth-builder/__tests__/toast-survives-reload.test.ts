/**
 * The save toast must survive the reload the save itself causes.
 *
 * FOUND BY USING THE BUILDER (2026-08-12), not by a test. Saving writes
 * `content/*.json` AND `src/lib/game/generated/puzzles.generated.ts` — both
 * inside the tree Next dev watches — so Fast Refresh reloads the page and wipes
 * the `useState` the toast lives in. The founder could only read his own 37
 * linter warnings by photographing the screen before they vanished.
 *
 * An action that destroys its own result is worse than one that says nothing:
 * the advice was computed, rendered, and thrown away in the same beat.
 *
 * `sessionStorage`, not `localStorage`: this is a message about what just
 * happened in THIS tab. Surviving a browser restart would mean greeting the next
 * session with a stale verdict about a save nobody remembers making.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearStoredToast,
  readStoredToast,
  storeToast,
  type PublishToast,
} from "@/lib/labyrinth-builder/publish-toast";

const toast: PublishToast = {
  kind: "warn",
  text: "Saved to baseline, but the draft overlay save failed.",
  warnings: ["rook: the curve goes backwards at step 7", "bishop-7: 12/15 obstacles are decorative"],
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("the save toast survives the reload the save causes", () => {
  it("comes back with its warnings intact", () => {
    storeToast(toast);

    expect(readStoredToast()).toEqual(toast);
  });

  it("returns null when nothing was stored", () => {
    expect(readStoredToast()).toBeNull();
  });

  it("is read ONCE — a reload later must not resurrect it", () => {
    // Otherwise every future visit to the builder opens with a verdict about a
    // save from an hour ago, which is how a surface stops being believed.
    storeToast(toast);
    readStoredToast();

    expect(readStoredToast()).toBeNull();
  });

  it("clears on demand, for dismiss and for starting a new draft", () => {
    storeToast(toast);
    clearStoredToast();

    expect(readStoredToast()).toBeNull();
  });

  it("survives corrupted storage instead of crashing the builder", () => {
    // Hand-edited or half-written JSON must not take the page down: the builder
    // is the only way to author content.
    window.sessionStorage.setItem("chesscito:builder-toast", "{not json");

    expect(readStoredToast()).toBeNull();
  });

  it("never throws when storage itself is unavailable", () => {
    // Private-mode Safari throws on setItem. Losing the toast is acceptable;
    // losing the save is not.
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() => storeToast(toast)).not.toThrow();
    spy.mockRestore();
  });
});
