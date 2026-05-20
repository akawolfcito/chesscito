import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useSaveScoreState } from "../use-save-score-state";

const STORAGE_KEY = "chesscito:save:rook";

describe("useSaveScoreState — load behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to zero when the storage key is absent", () => {
    const { result } = renderHook(() => useSaveScoreState("rook"));
    expect(result.current.lastSavedScore).toBe(0);
    expect(result.current.lastSavedAt).toBe(0);
    expect(result.current.lastSavedTxHash).toBeNull();
  });

  it("loads a valid stored value on mount", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        lastSavedScore: 800,
        lastSavedAt: 1716123456789,
        lastSavedTxHash: "0xabc",
      }),
    );
    const { result } = renderHook(() => useSaveScoreState("rook"));
    expect(result.current.lastSavedScore).toBe(800);
    expect(result.current.lastSavedAt).toBe(1716123456789);
    expect(result.current.lastSavedTxHash).toBe("0xabc");
  });

  it("rejects corrupt JSON and falls back to defaults", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const { result } = renderHook(() => useSaveScoreState("rook"));
    expect(result.current.lastSavedScore).toBe(0);
    expect(result.current.lastSavedTxHash).toBeNull();
  });

  it("rejects type-invalid stored shape and falls back to defaults", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lastSavedScore: "not-a-number", lastSavedAt: 0 }),
    );
    const { result } = renderHook(() => useSaveScoreState("rook"));
    expect(result.current.lastSavedScore).toBe(0);
  });

  it("rejects negative scores", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        lastSavedScore: -500,
        lastSavedAt: 1,
        lastSavedTxHash: "0x1",
      }),
    );
    const { result } = renderHook(() => useSaveScoreState("rook"));
    expect(result.current.lastSavedScore).toBe(0);
  });
});

describe("useSaveScoreState — recordSave", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("writes to localStorage and updates state", () => {
    const { result } = renderHook(() => useSaveScoreState("rook"));

    act(() => {
      result.current.recordSave(1500, "0xdeadbeef");
    });

    expect(result.current.lastSavedScore).toBe(1500);
    expect(result.current.lastSavedTxHash).toBe("0xdeadbeef");
    expect(result.current.lastSavedAt).toBeGreaterThan(0);

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.lastSavedScore).toBe(1500);
    expect(parsed.lastSavedTxHash).toBe("0xdeadbeef");
  });

  it("uses a separate key per piece — bishop save does not affect rook", () => {
    const rook = renderHook(() => useSaveScoreState("rook"));
    const bishop = renderHook(() => useSaveScoreState("bishop"));

    act(() => {
      rook.result.current.recordSave(500, "0xrook");
    });

    expect(rook.result.current.lastSavedScore).toBe(500);
    expect(bishop.result.current.lastSavedScore).toBe(0);

    expect(window.localStorage.getItem("chesscito:save:rook")).not.toBeNull();
    expect(window.localStorage.getItem("chesscito:save:bishop")).toBeNull();
  });

  it("recordSaveFor writes to the ORIGINAL piece even after user switches (piece-switch fix)", () => {
    // Surface starts on rook
    const hook = renderHook(({ piece }) => useSaveScoreState(piece), {
      initialProps: { piece: "rook" as const },
    });

    // Capture the save submission for rook
    const pendingRook = { piece: "rook" as const, score: 800, txHash: "0xrook" };

    // User switches to bishop BEFORE the receipt arrives
    hook.rerender({ piece: "bishop" as const });

    // Receipt arrives — surface calls recordSaveFor with the captured piece
    act(() => {
      hook.result.current.recordSaveFor(
        pendingRook.piece,
        pendingRook.score,
        pendingRook.txHash,
      );
    });

    // Rook's localStorage MUST hold 800; bishop's must stay empty
    const rookRaw = window.localStorage.getItem("chesscito:save:rook");
    const bishopRaw = window.localStorage.getItem("chesscito:save:bishop");
    expect(rookRaw).not.toBeNull();
    expect(JSON.parse(rookRaw!).lastSavedScore).toBe(800);
    expect(bishopRaw).toBeNull();

    // In-memory state is for the ACTIVE piece (bishop) — no change since
    // we wrote to a non-active piece
    expect(hook.result.current.lastSavedScore).toBe(0);
  });
});
