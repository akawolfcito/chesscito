import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
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

describe("ArenaHud — header only, no matchup art", () => {
  // The symmetric "You ⚔ Bot" header is gone (spec
  // docs/specs/2026-07-13-arena-hud-player-rails-spec.md).
  //
  // ArenaHud owns NEITHER rail. Both belong to the board group in
  // arena/page.tsx, wrapped together with ArenaBoard in one centred flex
  // column, because a rail's whole job is to sit hard against the side of the
  // board where that player's pieces are. When the rival rail lived here — a
  // sibling of the header, OUTSIDE the board's `flex-1 justify-center`
  // wrapper — the leftover vertical space opened up BETWEEN the rail and the
  // board, and the rails read as three loose elements instead of two sides of
  // a match. Caught on the first screenshot, not by any test.

  it("renders neither rail", () => {
    renderHud();
    expect(document.querySelector(".arena-rail")).toBeNull();
  });

  it("drops the VS banner — the matchup transition already did that beat", () => {
    renderHud();
    expect(document.querySelector(".arena-hud-matchup")).toBeNull();
    expect(screen.queryByText(/^vs$/i)).not.toBeInTheDocument();
  });

  it("drops the piece-color labels — board orientation encodes them", () => {
    renderHud();
    expect(document.querySelector(".arena-matchup-label")).toBeNull();
  });
});

// The chip is named for its ACTION ("Leave match"), not a destination — as of
// 2026-07-13 leaving lands on the rival selector, not the hub. See
// ARENA_COPY.leaveMatchAria.
describe("ArenaHud — back/quit confirmation modal", () => {
  it("tapping BACK during an active match opens the quit modal (not immediate)", () => {
    const { onBack } = renderHud({ isEndState: false });
    fireEvent.click(screen.getByRole("button", { name: /leave match/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("confirming the quit modal fires onBack once", () => {
    const { onBack } = renderHud({ isEndState: false });
    fireEvent.click(screen.getByRole("button", { name: /leave match/i }));
    fireEvent.click(screen.getByTestId("arena-quit-confirm"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("end-state BACK fires onBack immediately with no modal", () => {
    const { onBack } = renderHud({ isEndState: true });
    fireEvent.click(screen.getByRole("button", { name: /leave match/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("ArenaHud — shields inline inside timer chip", () => {
  // Behavior after the 2026-05-31 combined-pill refactor: shields no
  // longer render as a separate row. They render inline INSIDE the
  // timer chip as "divider + shield icon + count", matching the
  // /exercises HUD pattern. The aria-label is compound.

  it("renders inline shield count beside the timer when shields > 0", () => {
    mockedShieldsCount.mockReturnValue(3);
    renderHud();
    // The chip's aria-label embeds shields when present.
    expect(
      screen.getByRole("status", { name: /3 shields/i }),
    ).toBeInTheDocument();
  });

  it("does NOT decorate the chip when shields == 0 (timer-only fallback)", () => {
    mockedShieldsCount.mockReturnValue(0);
    renderHud();
    expect(
      screen.queryByRole("status", { name: /shields/i }),
    ).not.toBeInTheDocument();
  });

  it("suppresses the inline shield count on end-state (clean closing UI)", () => {
    mockedShieldsCount.mockReturnValue(2);
    renderHud({ isEndState: true });
    expect(
      screen.queryByRole("status", { name: /shields/i }),
    ).not.toBeInTheDocument();
  });

  it("singular vs plural — chip aria-label switches at count==1", () => {
    mockedShieldsCount.mockReturnValue(1);
    renderHud();
    expect(
      screen.getByRole("status", { name: /1 shields/i }),
    ).toBeInTheDocument();
  });
});
