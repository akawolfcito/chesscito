import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Stub Lottie wrapper — its dotlottie/lottie-web deps require canvas
// (jsdom does not provide one). The hint pill assertions don't need
// the real animation; this keeps the test file self-contained.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

import { ArenaHud } from "../arena-hud";
import { ARENA_COPY } from "@/lib/content/editorial";

afterEach(() => {
  cleanup();
});

function renderHud(overrides: Partial<Parameters<typeof ArenaHud>[0]> = {}) {
  const onBack = vi.fn();
  render(
    <ArenaHud
      isThinking={false}
      onBack={onBack}
      isEndState={false}
      elapsedMs={0}
      {...overrides}
    />,
  );
  return { onBack };
}

describe("ArenaHud — coach hint signpost", () => {
  it("renders the in-match coach hint when showCoachHint is true and game is live", () => {
    renderHud({ showCoachHint: true });
    const hint = screen.getByTestId("arena-coach-hint");
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent(ARENA_COPY.coachHudHint);
  });

  it("does NOT render the coach hint when showCoachHint is false (flag disabled)", () => {
    renderHud({ showCoachHint: false });
    expect(screen.queryByTestId("arena-coach-hint")).not.toBeInTheDocument();
  });

  it("does NOT render the coach hint on end-state even when showCoachHint is true", () => {
    renderHud({ showCoachHint: true, isEndState: true });
    expect(screen.queryByTestId("arena-coach-hint")).not.toBeInTheDocument();
  });

  it("defaults to hidden when showCoachHint prop is omitted", () => {
    renderHud();
    expect(screen.queryByTestId("arena-coach-hint")).not.toBeInTheDocument();
  });
});
