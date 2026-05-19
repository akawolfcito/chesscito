import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});

describe("PersistentDock — sheet-aware routing", () => {
  it("from /exercises, sheet items route in-place via ?sheet=…", async () => {
    pathnameMock.mockReturnValue("/exercises");
    pushMock.mockReset();
    const user = userEvent.setup();

    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /badges/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/exercises?sheet=badges");

    await user.click(screen.getByRole("button", { name: /shop/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/exercises?sheet=shop");

    await user.click(screen.getByRole("button", { name: /trophies/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/exercises?sheet=trophies");

    await user.click(screen.getByRole("button", { name: /leaders/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/exercises?sheet=leaderboard");
  });

  it("from /arena, sheet items route in-place via ?sheet=…", async () => {
    pathnameMock.mockReturnValue("/arena");
    pushMock.mockReset();
    const user = userEvent.setup();

    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /badges/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/arena?sheet=badges");

    await user.click(screen.getByRole("button", { name: /shop/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/arena?sheet=shop");

    await user.click(screen.getByRole("button", { name: /trophies/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/arena?sheet=trophies");

    await user.click(screen.getByRole("button", { name: /leaders/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/arena?sheet=leaderboard");
  });

  it("from /hub, sheet items route to their fallback destinations", async () => {
    pathnameMock.mockReturnValue("/hub");
    pushMock.mockReset();
    const user = userEvent.setup();

    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /badges/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/hub?sheet=badges");

    await user.click(screen.getByRole("button", { name: /shop/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/hub?sheet=shop");

    // Trophies has its own standalone route as fallback.
    await user.click(screen.getByRole("button", { name: /trophies/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/trophies");

    // Leaderboard has no standalone route — falls back to /exercises in-place.
    await user.click(screen.getByRole("button", { name: /leaders/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/exercises?sheet=leaderboard");
  });

  it("center routes to /arena?fresh=1 from /exercises and to /exercises from /arena", async () => {
    pushMock.mockReset();
    const user = userEvent.setup();

    pathnameMock.mockReturnValue("/exercises");
    const { unmount } = render(<PersistentDock />);
    await user.click(screen.getByRole("button", { name: /arena/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/arena?fresh=1");
    unmount();

    pathnameMock.mockReturnValue("/arena");
    render(<PersistentDock />);
    await user.click(screen.getByRole("button", { name: /pieces/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/exercises");
  });
});
