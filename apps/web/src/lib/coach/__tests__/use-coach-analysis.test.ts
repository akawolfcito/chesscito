import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCoachAnalysis } from "../use-coach-analysis";

describe("useCoachAnalysis (skeleton)", () => {
  const baseInput = {
    surface: "coach_viewer" as const,
  };

  it("starts in idle phase, no response", () => {
    const { result } = renderHook(() => useCoachAnalysis(baseInput));
    expect(result.current.phase).toBe("idle");
    expect(result.current.response).toBeNull();
    expect(result.current.credits).toBe(0);
  });

  it("returned callbacks are referentially stable across re-renders", () => {
    const { result, rerender } = renderHook((p) => useCoachAnalysis(p), { initialProps: baseInput });
    const askCoach = result.current.askCoach;
    const reanalyze = result.current.reanalyze;
    const abort = result.current.abort;
    const setPhase = result.current.setPhase;
    rerender(baseInput);
    expect(result.current.askCoach).toBe(askCoach);
    expect(result.current.reanalyze).toBe(reanalyze);
    expect(result.current.abort).toBe(abort);
    expect(result.current.setPhase).toBe(setPhase);
  });
});
