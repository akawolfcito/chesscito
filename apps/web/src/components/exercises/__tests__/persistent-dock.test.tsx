import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersistentDock } from "../persistent-dock";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/exercises"));
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

describe("PersistentDock — restored 5-slot taxonomy (badge/shop/arena/trophies/leaderboard)", () => {
  it("renders the legacy 5-slot dock on /exercises with Arena as center", () => {
    pathnameMock.mockReturnValue("/exercises");

    render(<PersistentDock />);

    expect(screen.getByRole("button", { name: /badges/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /arena/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trophies/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leaders/i })).toBeInTheDocument();
    // Slots dropped in the restore: no Home/Pieces/Board/Settings buttons.
    expect(screen.queryByRole("button", { name: /^home$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^board$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^settings$/i })).not.toBeInTheDocument();
  });

  it("center swaps to Pieces when on /arena", () => {
    pathnameMock.mockReturnValue("/arena");

    render(<PersistentDock />);

    expect(screen.getByRole("button", { name: /pieces/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^arena$/i })).not.toBeInTheDocument();
  });

  it("marks Trophies active when pathname is /trophies", () => {
    pathnameMock.mockReturnValue("/trophies");

    render(<PersistentDock />);

    expect(screen.getByRole("button", { name: /trophies/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Leaders active when pathname is /leaderboard", () => {
    pathnameMock.mockReturnValue("/leaderboard");

    render(<PersistentDock />);

    expect(screen.getByRole("button", { name: /leaders/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
