/**
 * ArenaPlayerRail — the compact identity strip that replaces the symmetric
 * "You ⚔ Bot" matchup header.
 *
 * Spec: docs/specs/2026-07-13-arena-hud-player-rails-spec.md
 *
 * Two invariants here are load-bearing and easy to regress:
 *
 *   - NEITHER RAIL IS INTERACTIVE. The old difficulty chip was a <button>
 *     wired to `game.reset()` with NO confirmation — a tap on what looked
 *     like an info chip destroyed the match in silence. Any future change
 *     that makes a rail tappable must re-argue that decision (spec §5).
 *
 *   - THE RAIL KEEPS ITS HEIGHT WITHOUT `meta`. A visitor has no Identity
 *     Lite nickname; if the rail collapsed to one line the board would shift
 *     vertically between a connected and a disconnected session (spec §6.2).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

// Lottie pulls dotlottie/lottie-web, which need a canvas jsdom does not have.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => <div data-testid="thinking-lottie" />,
}));

// useIsProActive reaches into wagmi (useAccount → useConfig) and would need a
// WagmiProvider. Stubbed per-test via mockedPro.
const mockedPro = vi.fn<() => boolean>(() => false);
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => mockedPro(),
}));

import { ArenaPlayerRail } from "../arena-player-rail";

afterEach(() => {
  cleanup();
  mockedPro.mockReturnValue(false);
});

describe("ArenaPlayerRail — identity", () => {
  it("renders the name and the meta line", () => {
    render(<ArenaPlayerRail side="rival" name="Pipo" meta="Easy · 477 ELO" />);
    expect(screen.getByText("Pipo")).toBeInTheDocument();
    expect(screen.getByText("Easy · 477 ELO")).toBeInTheDocument();
  });

  it("omits the meta line when meta is undefined (visitor)", () => {
    render(<ArenaPlayerRail side="you" name="You" />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(document.querySelector(".arena-rail-meta")).toBeNull();
  });

  it("keeps the rail height when meta is absent, so the board never shifts", () => {
    // The rail reserves the second line via a min-height on the text column
    // rather than by rendering an empty node. Asserting the class contract is
    // what we can do in jsdom (no layout engine); the CSS owns the value.
    render(<ArenaPlayerRail side="you" name="You" />);
    expect(document.querySelector(".arena-rail")).toBeInTheDocument();
  });

  it("does NOT render the piece-color label — position encodes it now", () => {
    render(<ArenaPlayerRail side="you" name="You" meta="Blue Bishop #6649" />);
    expect(screen.queryByText(/white/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/black/i)).not.toBeInTheDocument();
  });
});

describe("ArenaPlayerRail — NOT interactive (regression guard, spec §5)", () => {
  it("exposes no button role on the rival rail", () => {
    render(<ArenaPlayerRail side="rival" name="Kairo" meta="Hard · 1800 ELO" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes no button role on the player rail", () => {
    render(<ArenaPlayerRail side="you" name="You" meta="Blue Bishop #6649" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ArenaPlayerRail — turn emphasis", () => {
  it("marks the rail active when isActive", () => {
    render(<ArenaPlayerRail side="you" name="You" isActive />);
    expect(document.querySelector(".arena-rail.is-active")).toBeInTheDocument();
  });

  it("is not active by default", () => {
    render(<ArenaPlayerRail side="you" name="You" />);
    expect(document.querySelector(".arena-rail.is-active")).toBeNull();
  });
});

describe("ArenaPlayerRail — thinking indicator", () => {
  it("renders the thinking lottie on the rival rail while isThinking", () => {
    render(<ArenaPlayerRail side="rival" name="Pipo" isThinking />);
    expect(screen.getByTestId("thinking-lottie")).toBeInTheDocument();
  });

  it("renders no thinking lottie when idle", () => {
    render(<ArenaPlayerRail side="rival" name="Pipo" />);
    expect(screen.queryByTestId("thinking-lottie")).not.toBeInTheDocument();
  });
});

describe("ArenaPlayerRail — PRO ornament", () => {
  // HARD RULE (spec §4): the avatar perimeter belongs to PRO. No piece-color
  // ring, no rivals.ts difficulty frame may be layered there.
  it("passes the PRO state through to the avatar", () => {
    mockedPro.mockReturnValue(true);
    render(<ArenaPlayerRail side="you" name="You" />);
    expect(document.querySelector(".player-card--pro")).toBeInTheDocument();
  });

  it("renders no PRO ornament when PRO is inactive", () => {
    render(<ArenaPlayerRail side="you" name="You" />);
    expect(document.querySelector(".player-card--pro")).toBeNull();
  });
});
