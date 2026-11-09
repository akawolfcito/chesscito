import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { PlayBadgesSheet } from "../play-badges-sheet";

vi.mock("wagmi", () => ({ useAccount: () => ({ address: undefined, isConnected: false }) }));

describe("PlayBadgesSheet", () => {
  it("renders competitive achievement tiles, not piece badges, when open", () => {
    render(<PlayBadgesSheet open={true} onOpenChange={() => {}} />);
    // Locked-state achievements grid renders even disconnected (all locked).
    expect(screen.queryByText(/rook|bishop|knight|pawn|queen|king/i)).not.toBeInTheDocument();
  });

  it("does not mount the data provider (no fetch trigger) when closed", () => {
    const { container } = render(<PlayBadgesSheet open={false} onOpenChange={() => {}} />);
    expect(container.querySelector(".achievement-tile-grid")).not.toBeInTheDocument();
  });
});
