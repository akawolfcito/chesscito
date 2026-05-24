import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

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
  // The presence test was removed when the in-match Coach signpost was
  // intentionally dropped in commit b3a13c63 (2026-05-13 refactor:
  // simplify coach review UI). The remaining absence assertions stay
  // as regression guards — if a future change reintroduces the pill,
  // these will fail and force a re-evaluation of the design decision.

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
