import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PieceId } from "@/lib/game/types";

/** Phase 3 commit 2 — BadgeSheet port into <HubScaffoldV2Client>.
 *  Verifies the design-lock §9.1 contract (3 asserts):
 *    1. Mastery tile tap (rook) mounts <BadgeSheet> in-place — no router push
 *    2. Sheet close preserves the mastery tile in the DOM (proxy for the
 *       scroll-position contract; jsdom has no real layout, so the e2e
 *       visual suite covers actual scroll preservation in Phase 7)
 *    3. Tile re-renders with updated state when `badgesClaimed` changes
 *       (post-claim refetch path)
 *
 *  We mock <BadgeSheet> to a stub and `useBadgeSheetState` to a stateful
 *  mock that exposes a settable `badgesClaimed` map, so the third assert
 *  can simulate the post-receipt refetch by re-rendering the same tree
 *  with a new claimed value. The hook's own claim flow is covered by
 *  `use-badge-sheet-state.test.tsx`. */

const pushMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const claimedMockState = vi.hoisted(() => ({
  current: { rook: false } as Partial<Record<PieceId, boolean>>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/hub",
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: undefined as `0x${string}` | undefined,
    isConnected: false,
  }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

// ProSheet + ShopSheet paths are out-of-scope for this test file —
// V2 mounts all three sheets but only BadgeSheet's open/close cycle
// drives this file's assertions. Each sibling has its own dedicated
// test.
vi.mock("@/components/pro/pro-sheet", () => ({
  ProSheet: () => null,
}));
vi.mock("@/components/exercises/shop-sheet", () => ({
  ShopSheet: () => null,
}));
vi.mock("@/components/exercises/purchase-confirm-sheet", () => ({
  PurchaseConfirmSheet: () => null,
}));

vi.mock("@/lib/pro/use-pro-sheet-state", () => ({
  useProSheetState: () => ({
    open: false,
    openSheet: () => {},
    closeSheet: () => {},
    sheetProps: { open: false, onOpenChange: () => {} },
    proStatus: null,
  }),
}));

vi.mock("@/lib/shop/use-shop-sheet-state", () => ({
  useShopSheetState: () => ({
    open: false,
    openSheet: () => {},
    closeSheet: () => {},
    sheetProps: { open: false, onOpenChange: () => {} },
    confirmProps: { open: false, onOpenChange: () => {} },
    isCorrectChain: true,
    isConnected: false,
    onConnectWallet: () => {},
    onSwitchNetwork: () => {},
  }),
}));

// Stub BadgeSheet — we only verify V2's mount/close wiring; the sheet's
// claim UI is owned by its own test file.
vi.mock("@/components/exercises/badge-sheet", () => ({
  BadgeSheet: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) =>
    open ? (
      <div data-testid="badge-sheet-root">
        <button
          type="button"
          data-testid="badge-sheet-close"
          onClick={() => onOpenChange(false)}
        >
          Close
        </button>
      </div>
    ) : null,
}));

// Stateful hook mock — `claimedMockState.current` is the source of truth
// for the third assert (re-render with mutated map → tile re-renders).
vi.mock("@/lib/badges/use-badge-sheet-state", async () => {
  const { useState } = await import("react");
  return {
    useBadgeSheetState: () => {
      const [open, setOpen] = useState(false);
      return {
        open,
        openSheet: () => setOpen(true),
        closeSheet: () => setOpen(false),
        badgesClaimed: claimedMockState.current,
        sheetProps: {
          open,
          onOpenChange: (next: boolean) => setOpen(next),
          badgesClaimed: claimedMockState.current,
          onClaim: () => {},
          isClaimBusy: false,
          claimingPiece: null,
          lastClaimedPiece: null,
          showNotification: false,
          onNavigateToTrophies: () => {},
          showTrigger: false,
        },
      };
    },
  };
});

import { HubScaffoldV2Client } from "../hub-scaffold-v2-client";

beforeEach(() => {
  pushMock.mockReset();
  trackMock.mockReset();
  claimedMockState.current = { rook: false };
});

afterEach(() => {
  cleanup();
});

describe("HubScaffoldV2Client — BadgeSheet port", () => {
  it("mounts <BadgeSheet> in-place on rook mastery tile tap (no router push)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldV2Client />);

    expect(screen.queryByTestId("badge-sheet-root")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("hub-v2-mastery-tile-rook"));

    expect(screen.getByTestId("badge-sheet-root")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("closes the sheet without unmounting the mastery tile (no URL change)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldV2Client />);

    const tile = screen.getByTestId("hub-v2-mastery-tile-rook");
    await user.click(tile);
    expect(screen.getByTestId("badge-sheet-root")).toBeInTheDocument();

    await user.click(screen.getByTestId("badge-sheet-close"));

    expect(screen.queryByTestId("badge-sheet-root")).not.toBeInTheDocument();
    // Same DOM node — V2 didn't unmount/remount the tile across the
    // sheet close cycle, so any scroll position is preserved by default.
    expect(screen.getByTestId("hub-v2-mastery-tile-rook")).toBe(tile);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("re-renders the rook tile when badgesClaimed flips after a receipt", () => {
    const { rerender } = render(<HubScaffoldV2Client />);

    expect(
      screen.getByTestId("hub-v2-mastery-tile-rook").getAttribute("data-claimed"),
    ).toBe("false");

    // Simulate the post-claim refetch: the hook's `badgesClaimed` flips
    // for rook. V2 reads it directly off the hook return, so a re-render
    // should propagate the new state to the tile.
    claimedMockState.current = { rook: true };
    rerender(<HubScaffoldV2Client />);

    expect(
      screen.getByTestId("hub-v2-mastery-tile-rook").getAttribute("data-claimed"),
    ).toBe("true");
  });
});
