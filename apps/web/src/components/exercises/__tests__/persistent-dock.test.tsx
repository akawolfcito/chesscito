import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistentDock } from "../persistent-dock";
import {
  registerDockSheetCloser,
  setDockSheet,
} from "@/lib/ui/dock-sheet-store";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/exercises"));
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

afterEach(() => {
  setDockSheet(null);
});

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

describe("PersistentDock — overlay-aware center action", () => {
  it("from /exercises with an open sheet, center shows the BASE mode (Pieces) and closes the overlay", async () => {
    pathnameMock.mockReturnValue("/exercises");
    pushMock.mockReset();
    const close = vi.fn();
    const user = userEvent.setup();

    registerDockSheetCloser(close);
    setDockSheet("shop");

    render(<PersistentDock />);

    // With overlay open, the center mirrors the visible base route —
    // /exercises → "Pieces" artwork — instead of the swap destination.
    expect(screen.queryByRole("button", { name: /^arena$/i })).not.toBeInTheDocument();
    const center = screen.getByRole("button", { name: /pieces/i });
    expect(center.querySelector("img")?.getAttribute("src")).toContain("train-pieces");

    await user.click(center);
    expect(close).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("from /arena with an open sheet, center shows the BASE mode (Arena) and closes the overlay", async () => {
    pathnameMock.mockReturnValue("/arena");
    pushMock.mockReset();
    const close = vi.fn();
    const user = userEvent.setup();

    registerDockSheetCloser(close);
    setDockSheet("trophies");

    render(<PersistentDock />);

    expect(screen.queryByRole("button", { name: /^pieces$/i })).not.toBeInTheDocument();
    const center = screen.getByRole("button", { name: /^arena$/i });
    expect(center.querySelector("img")?.getAttribute("src")).toContain("enter-arena");

    await user.click(center);
    expect(close).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("when the store reports no open sheet, center reverts to the route-swap behavior", async () => {
    pathnameMock.mockReturnValue("/exercises");
    pushMock.mockReset();
    const user = userEvent.setup();

    setDockSheet(null);
    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /arena/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/arena?fresh=1");
  });

  it("side item lights up while its sheet is open so the user keeps the visual anchor", () => {
    pathnameMock.mockReturnValue("/exercises");
    setDockSheet("badge");

    const { container } = render(<PersistentDock />);

    const badge = container.querySelector('[data-dock-id="badge"]');
    const shop = container.querySelector('[data-dock-id="shop"]');
    expect(badge?.className).toContain("is-active");
    expect(shop?.className).not.toContain("is-active");
  });
});
