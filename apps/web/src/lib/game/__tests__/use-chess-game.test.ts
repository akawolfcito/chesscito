import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChessGame } from "../use-chess-game";

describe("useChessGame — lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("boots into 'selecting' status with easy difficulty and an empty move log", () => {
    const { result } = renderHook(() => useChessGame());

    expect(result.current.status).toEqual("selecting");
    expect(result.current.difficulty).toEqual("easy");
    expect(result.current.moveCount).toEqual(0);
    expect(result.current.moveHistory).toEqual([]);
    expect(result.current.selectedSquare).toBeNull();
    expect(result.current.legalMoves).toEqual([]);
    expect(result.current.lastMove).toBeNull();
    expect(result.current.checkSquare).toBeNull();
    expect(result.current.pendingPromotion).toBeNull();
  });

  it("renders the 32 starting pieces on initial board", () => {
    const { result } = renderHook(() => useChessGame());
    expect(result.current.pieces).toHaveLength(32);
    expect(result.current.pieces.filter((p) => p.color === "w")).toHaveLength(16);
    expect(result.current.pieces.filter((p) => p.color === "b")).toHaveLength(16);
  });

  it("setDifficulty updates the selection before the game starts", () => {
    const { result } = renderHook(() => useChessGame());
    act(() => result.current.setDifficulty("hard"));
    expect(result.current.difficulty).toEqual("hard");
    expect(result.current.status).toEqual("selecting");
  });

  it("startGame transitions 'selecting' → 'playing'", () => {
    const { result } = renderHook(() => useChessGame());
    act(() => result.current.startGame());
    expect(result.current.status).toEqual("playing");
  });

  it("selectSquare on a white piece surfaces its legal moves", () => {
    const { result } = renderHook(() => useChessGame());
    act(() => result.current.startGame());
    // b1 = white knight (Nb1). Legal opening moves: a3, c3.
    act(() => result.current.selectSquare("b1"));
    expect(result.current.selectedSquare).toEqual("b1");
    expect(result.current.legalMoves.sort()).toEqual(["a3", "c3"]);
  });

  it("reset during a game clears state back to 'selecting'", () => {
    const { result } = renderHook(() => useChessGame());
    act(() => result.current.startGame());
    act(() => result.current.selectSquare("b1"));
    act(() => result.current.reset());
    expect(result.current.status).toEqual("selecting");
    expect(result.current.selectedSquare).toBeNull();
    expect(result.current.legalMoves).toEqual([]);
    expect(result.current.moveCount).toEqual(0);
  });

  it("resign from 'playing' puts the game in 'resigned' terminal state", () => {
    const { result } = renderHook(() => useChessGame());
    act(() => result.current.startGame());
    act(() => result.current.resign());
    expect(result.current.status).toEqual("resigned");
  });
});
