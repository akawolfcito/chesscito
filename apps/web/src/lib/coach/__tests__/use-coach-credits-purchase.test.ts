import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCoachCreditsPurchase } from "../use-coach-credits-purchase";

describe("useCoachCreditsPurchase (skeleton)", () => {
  const baseInput = {};

  it("starts idle: not processing, no error", () => {
    const { result } = renderHook(() => useCoachCreditsPurchase(baseInput));
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("buyCredits is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook((p) => useCoachCreditsPurchase(p), { initialProps: baseInput });
    const fn = result.current.buyCredits;
    rerender(baseInput);
    expect(result.current.buyCredits).toBe(fn);
  });
});
