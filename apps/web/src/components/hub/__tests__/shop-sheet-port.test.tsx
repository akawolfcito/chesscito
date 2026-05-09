import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Phase 3 commit 3 — ShopSheet port into <HubScaffoldV2Client>.
 *  Verifies the design-lock §9.1 contract (2 asserts):
 *    1. Shield ribbon tap mounts <ShopSheet> in-place — no router push
 *    2. Shields count chip refreshes from 0 to 3 after a successful
 *       shield-item receipt (post-purchase increment)
 *
 *  Mocks <ShopSheet>, <PurchaseConfirmSheet>, and `useShopSheetState`.
 *  The hook mock captures the `onPurchaseSuccess` option V2 wires so the
 *  test can synchronously simulate a confirmed receipt without traversing
 *  the wagmi / approve / buyItem path. The hook's own success path lives
 *  in `use-shop-sheet-state.test.tsx`. */

const pushMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const captureShopOpts = vi.hoisted(() => ({
  current: null as
    | null
    | {
        onPurchaseSuccess?: (receipt: {
          txHash: `0x${string}`;
          itemId: bigint;
          quantity: number;
          buyer: `0x${string}`;
        }) => void;
      },
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

// Out-of-scope sheet stubs — V2 mounts all three but only ShopSheet's
// open/close cycle drives this test file's assertions.
vi.mock("@/components/pro/pro-sheet", () => ({ ProSheet: () => null }));
vi.mock("@/components/exercises/badge-sheet", () => ({
  BadgeSheet: () => null,
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

vi.mock("@/lib/badges/use-badge-sheet-state", () => ({
  useBadgeSheetState: () => ({
    open: false,
    openSheet: () => {},
    closeSheet: () => {},
    badgesClaimed: {} as Record<string, boolean | undefined>,
    sheetProps: {
      open: false,
      onOpenChange: () => {},
      badgesClaimed: {},
      onClaim: () => {},
      isClaimBusy: false,
      claimingPiece: null,
      lastClaimedPiece: null,
      showNotification: false,
      onNavigateToTrophies: () => {},
      showTrigger: false,
    },
  }),
}));

// Stub ShopSheet — verifies V2's mount/close wiring only. The catalog +
// purchase confirmation surface is owned by its own tests.
vi.mock("@/components/exercises/shop-sheet", () => ({
  ShopSheet: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) =>
    open ? (
      <div data-testid="shop-sheet-root">
        <button
          type="button"
          data-testid="shop-sheet-close"
          onClick={() => onOpenChange(false)}
        >
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/exercises/purchase-confirm-sheet", () => ({
  PurchaseConfirmSheet: () => null,
}));

vi.mock("@/lib/shop/use-shop-sheet-state", async () => {
  const { useState } = await import("react");
  return {
    useShopSheetState: (opts?: {
      onPurchaseSuccess?: (receipt: {
        txHash: `0x${string}`;
        itemId: bigint;
        quantity: number;
        buyer: `0x${string}`;
      }) => void;
    }) => {
      captureShopOpts.current = opts ?? null;
      const [open, setOpen] = useState(false);
      return {
        open,
        openSheet: () => setOpen(true),
        closeSheet: () => setOpen(false),
        sheetProps: {
          open,
          onOpenChange: (next: boolean) => setOpen(next),
        },
        confirmProps: { open: false, onOpenChange: () => {} },
        isCorrectChain: true,
        isConnected: false,
        onConnectWallet: () => {},
        onSwitchNetwork: () => {},
      };
    },
  };
});

import { HubScaffoldV2Client } from "../hub-scaffold-v2-client";

const SHIELD_ITEM_ID = 2n;

beforeEach(() => {
  pushMock.mockReset();
  trackMock.mockReset();
  captureShopOpts.current = null;
});

afterEach(() => {
  cleanup();
});

describe("HubScaffoldV2Client — ShopSheet port", () => {
  it("mounts <ShopSheet> in-place on shield ribbon tap (no router push)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldV2Client />);

    expect(screen.queryByTestId("shop-sheet-root")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("hub-v2-shield-ribbon"));

    expect(screen.getByTestId("shop-sheet-root")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("refreshes the shields count from 0 to 3 after onPurchaseSuccess fires", () => {
    render(<HubScaffoldV2Client />);

    const ribbon = screen.getByTestId("hub-v2-shield-ribbon");
    expect(ribbon.getAttribute("data-shields")).toBe("0");

    expect(captureShopOpts.current?.onPurchaseSuccess).toBeTypeOf("function");

    act(() => {
      captureShopOpts.current?.onPurchaseSuccess?.({
        txHash:
          "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        itemId: SHIELD_ITEM_ID,
        quantity: 1,
        buyer: "0x000000000000000000000000000000000000abcd",
      });
    });

    expect(
      screen.getByTestId("hub-v2-shield-ribbon").getAttribute("data-shields"),
    ).toBe("3");
  });
});
