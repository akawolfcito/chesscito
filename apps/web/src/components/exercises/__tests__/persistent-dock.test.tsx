import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersistentDock } from "../persistent-dock";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/exercises"));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

function renderDock() {
  return render(
    <PersistentDock
      activeDockTab={null}
      badgeControl={<button type="button">Badge control</button>}
      shopControl={<button type="button">Shop control</button>}
      trophiesControl={<button type="button">Trophies control</button>}
      leaderboardControl={<button type="button">Leaderboard control</button>}
    />,
  );
}

describe("PersistentDock — contextual center action", () => {
  it("shows Arena from Practice Pieces and links to /arena", () => {
    pathnameMock.mockReturnValue("/exercises");

    renderDock();

    const center = screen.getByRole("link", { name: /arena/i });
    expect(center).toHaveAttribute("href", "/arena?fresh=1");
    expect(screen.queryByRole("link", { name: /pieces/i })).not.toBeInTheDocument();
  });

  it("shows Pieces from Arena and links to Practice Pieces", () => {
    pathnameMock.mockReturnValue("/arena");

    renderDock();

    const center = screen.getByRole("link", { name: /pieces/i });
    expect(center).toHaveAttribute("href", "/exercises");
    expect(screen.queryByRole("link", { name: /arena/i })).not.toBeInTheDocument();
  });
});
