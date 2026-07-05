import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistentDock } from "../persistent-dock";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import {
  registerDockSheetCloser,
  registerDockSheetOpener,
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
  // Clear any opener/closer registered during the test. The store
  // uses module-level singletons; register-and-immediately-unregister
  // with a noop drops whatever the previous test installed.
  registerDockSheetOpener(() => {})();
  registerDockSheetCloser(() => {})();
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

describe("PersistentDock — cross-route URL fallback", () => {
  // Same-route dock taps on /exercises and /arena now go through the
  // dock-sheet-store (see "store-based open action" below). The URL
  // fallback only fires on routes that don't host the auxiliary
  // sheets (e.g. root Hub) — the target page must mount via real navigation.
  it("from /, sheet items route to their fallback destinations", async () => {
    pathnameMock.mockReturnValue("/");
    pushMock.mockReset();
    const user = userEvent.setup();

    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /badges/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/?sheet=badges");

    await user.click(screen.getByRole("button", { name: /shop/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/?sheet=shop");

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

describe("PersistentDock — store-based open action (no URL)", () => {
  it("on /exercises with a registered opener, side tap dispatches via the store and does NOT push the URL", async () => {
    pathnameMock.mockReturnValue("/exercises");
    pushMock.mockReset();
    const opener = vi.fn();
    const user = userEvent.setup();

    registerDockSheetOpener(opener);

    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /badges/i }));
    expect(opener).toHaveBeenCalledWith("badge");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("on /arena with a registered opener, side tap dispatches via the store and does NOT push the URL", async () => {
    pathnameMock.mockReturnValue("/arena");
    pushMock.mockReset();
    const opener = vi.fn();
    const user = userEvent.setup();

    registerDockSheetOpener(opener);

    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /shop/i }));
    expect(opener).toHaveBeenCalledWith("shop");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("on / (cross-route, no opener registered), side tap falls back to URL push", async () => {
    pathnameMock.mockReturnValue("/");
    pushMock.mockReset();
    const user = userEvent.setup();

    render(<PersistentDock />);

    await user.click(screen.getByRole("button", { name: /badges/i }));
    expect(pushMock).toHaveBeenLastCalledWith("/?sheet=badges");
  });
});

describe("PersistentDock — Learn mode (Shop added, points at Season Pass)", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/feature-flags");
    vi.resetModules();
  });

  it("shows Shop alongside Badges on the left side", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: true,
      isPlayMode: () => false,
    }));
    pathnameMock.mockReturnValue("/exercises");
    const { PersistentDock: LearnDock } = await import("../persistent-dock");

    render(<LearnDock />);

    expect(screen.getByRole("button", { name: /badges/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shop/i })).toBeInTheDocument();
  });
});

describe("PersistentDock — Play mode (Arena pinned, no Pieces, no /exercises)", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/feature-flags");
    vi.resetModules();
  });

  it("center is Arena on /arena and never swaps to Pieces", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/arena");
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);

    expect(screen.getByRole("button", { name: /^arena$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pieces/i })).not.toBeInTheDocument();
  });

  it("center is still Arena from the root route (never swaps to Pieces)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/");
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);

    expect(screen.getByRole("button", { name: /^arena$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pieces/i })).not.toBeInTheDocument();
  });

  it("tapping the pinned Arena center while already on /arena does not navigate", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/arena");
    pushMock.mockReset();
    const user = userEvent.setup();
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);
    await user.click(screen.getByRole("button", { name: /^arena$/i }));

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("leaderboard fallback never points at /exercises", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/hub");
    pushMock.mockReset();
    const user = userEvent.setup();
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);
    await user.click(screen.getByRole("button", { name: /leaders/i }));

    expect(pushMock).toHaveBeenLastCalledWith("/arena?sheet=leaderboard");
  });
});
