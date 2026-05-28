import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameReplay } from "../use-game-replay";

describe("useGameReplay", () => {
  const STARTPOS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("empty moves: lastValidIndex 0, fen=startpos, no error", () => {
    const { result } = renderHook(() => useGameReplay([]));
    expect(result.current.lastValidIndex).toBe(0);
    expect(result.current.totalMoves).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentFen).toBe(STARTPOS);
    expect(result.current.currentMove).toBeNull();
    expect(result.current.error).toBeUndefined();
    expect(result.current.canPrev).toBe(false);
    expect(result.current.canNext).toBe(false);
  });

  it("happy path: replays a 4-move game", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6"];
    const { result } = renderHook(() => useGameReplay(moves));
    expect(result.current.lastValidIndex).toBe(4);
    expect(result.current.currentIndex).toBe(4);
    expect(result.current.error).toBeUndefined();
    expect(result.current.canPrev).toBe(true);
    expect(result.current.canNext).toBe(false);
    expect(result.current.currentMove).toEqual({ san: "Nc6", index: 3 });
  });

  it("goPrev / goNext bounded", () => {
    const moves = ["e4", "e5"];
    const { result } = renderHook(() => useGameReplay(moves));
    expect(result.current.currentIndex).toBe(2);
    act(() => result.current.goPrev());
    expect(result.current.currentIndex).toBe(1);
    act(() => result.current.goPrev());
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.goPrev());
    expect(result.current.currentIndex).toBe(0); // clamp
    act(() => result.current.goNext());
    expect(result.current.currentIndex).toBe(1);
  });

  it("goTo clamps silently — no throw on out-of-range", () => {
    const moves = ["e4", "e5", "Nf3"];
    const { result } = renderHook(() => useGameReplay(moves));
    act(() => result.current.goTo(-5));
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.goTo(99));
    expect(result.current.currentIndex).toBe(3);
    act(() => result.current.goTo(1));
    expect(result.current.currentIndex).toBe(1);
  });

  it("goStart / goEnd", () => {
    const moves = ["e4", "e5", "Nf3"];
    const { result } = renderHook(() => useGameReplay(moves));
    act(() => result.current.goStart());
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.goEnd());
    expect(result.current.currentIndex).toBe(3);
  });

  it("partial-replay: stops at first illegal SAN, exposes error", () => {
    const moves = ["e4", "e5", "Nxd5", "Nf6"]; // 3rd move is illegal from this position
    const { result } = renderHook(() => useGameReplay(moves));
    expect(result.current.totalMoves).toBe(4);
    expect(result.current.lastValidIndex).toBe(2);
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.error).toEqual({ atIndex: 2, badSan: "Nxd5" });
    act(() => result.current.goNext());
    expect(result.current.currentIndex).toBe(2);
  });

  it("uses provided startingFen", () => {
    const customFen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2";
    const { result } = renderHook(() => useGameReplay([], customFen));
    expect(result.current.currentFen).toBe(customFen);
  });

  it("invalid startingFen: falls back to startpos + error.atIndex -1, no replay", () => {
    const { result } = renderHook(() => useGameReplay(["e4"], "this-is-not-a-fen"));
    expect(result.current.error).toEqual({ atIndex: -1, badSan: "" });
    expect(result.current.lastValidIndex).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.totalMoves).toBe(1);
    // Moves array length is reported even though replay was skipped.
    // The hook does not attempt to replay e4 after the bad startingFen.
  });

  it("currentFen updates as we navigate", () => {
    const moves = ["e4", "e5"];
    const { result } = renderHook(() => useGameReplay(moves));
    const finalFen = result.current.currentFen;
    act(() => result.current.goStart());
    expect(result.current.currentFen).toBe(STARTPOS);
    act(() => result.current.goEnd());
    expect(result.current.currentFen).toBe(finalFen);
  });

  it("returned functions are referentially stable across re-renders with same inputs", () => {
    const moves = ["e4"];
    const { result, rerender } = renderHook(({ m }) => useGameReplay(m), { initialProps: { m: moves } });
    const goPrev1 = result.current.goPrev;
    const goNext1 = result.current.goNext;
    const goTo1 = result.current.goTo;
    rerender({ m: moves });
    expect(result.current.goPrev).toBe(goPrev1);
    expect(result.current.goNext).toBe(goNext1);
    expect(result.current.goTo).toBe(goTo1);
  });
});
