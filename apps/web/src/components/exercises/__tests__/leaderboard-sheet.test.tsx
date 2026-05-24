import { describe, expect, it, vi, beforeEach } from "vitest";
import { LeaderboardSheet } from "../leaderboard-sheet";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;
});

describe("LeaderboardSheet — showTrigger gate", () => {
  it("renders the dock trigger by default", () => {
    render(<LeaderboardSheet open={false} onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: /leaders/i })).toBeInTheDocument();
  });

  it("omits the orphan trigger when showTrigger is false", () => {
    render(
      <LeaderboardSheet open={false} onOpenChange={() => {}} showTrigger={false} />,
    );
    expect(screen.queryByRole("button", { name: /leaders/i })).not.toBeInTheDocument();
  });
});

describe("LeaderboardSheet — ContextualHeader canary", () => {
  it("mounts the close-control ContextualHeader (not the legacy ad-hoc header)", () => {
    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-component", "contextual-header");
    expect(header).toHaveAttribute("data-variant", "close-control");
  });

  it("renders exactly one close affordance (inline, not the floating absolute X)", () => {
    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);
    const closeButtons = screen.getAllByRole("button", { name: /close leaders/i });
    expect(closeButtons).toHaveLength(1);
    expect(closeButtons[0].getAttribute("data-slot")).toBe("close-control");
  });
});
