import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMintVictory } from "../use-mint-victory";

describe("useMintVictory (skeleton)", () => {
  const baseInput = {};

  it("starts in ready phase, empty claimData", () => {
    const { result } = renderHook(() => useMintVictory(baseInput));
    expect(result.current.phase).toBe("ready");
    expect(result.current.data.tokenId).toBeNull();
    expect(result.current.shareStatus).toBe("locked");
    expect(result.current.error).toBeNull();
  });

  it("returned callbacks are referentially stable across re-renders", () => {
    const { result, rerender } = renderHook((p) => useMintVictory(p), { initialProps: baseInput });
    const start = result.current.start;
    const reset = result.current.reset;
    rerender(baseInput);
    expect(result.current.start).toBe(start);
    expect(result.current.reset).toBe(reset);
  });
});
