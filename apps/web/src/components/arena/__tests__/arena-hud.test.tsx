import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

// Stub Lottie wrapper — its dotlottie/lottie-web deps require canvas
// (jsdom does not provide one). The hint pill assertions don't need
// the real animation; this keeps the test file self-contained.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// `useIsProActive` reaches into wagmi (`useAccount` → `useConfig`), which
// requires a WagmiProvider that this test file doesn't set up. Stub the
// hook to a static `false` — these tests cover the coach-hint signpost,
// not the PRO ornament frame, so the gate value doesn't affect them.
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => false,
}));

// Shields chip uses `useShieldsCount`, which reads localStorage and
// subscribes to the in-tab event bus. Stub at module level so each
// describe block can override per-test via `mockedShieldsCount`.
const mockedShieldsCount = vi.fn<() => number>(() => 0);
vi.mock("@/lib/shop/use-shields-count", () => ({
  useShieldsCount: () => mockedShieldsCount(),
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

describe("ArenaHud — shields point-of-use chip", () => {
  it("renders Shield ×N chip when shields > 0 and match is in-play", () => {
    mockedShieldsCount.mockReturnValue(3);
    renderHud();
    expect(screen.getByText("Shield ×3")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /3 streak shields available/i }),
    ).toBeInTheDocument();
  });

  it("hides the chip when shields count is 0", () => {
    mockedShieldsCount.mockReturnValue(0);
    renderHud();
    expect(screen.queryByText(/Shield ×/)).not.toBeInTheDocument();
  });

  it("hides the chip on end-state even when shields > 0", () => {
    mockedShieldsCount.mockReturnValue(2);
    renderHud({ isEndState: true });
    expect(screen.queryByText(/Shield ×/)).not.toBeInTheDocument();
  });

  it("uses singular aria-label when exactly 1 shield", () => {
    mockedShieldsCount.mockReturnValue(1);
    renderHud();
    expect(
      screen.getByRole("status", { name: /1 streak shield available/i }),
    ).toBeInTheDocument();
  });
});
