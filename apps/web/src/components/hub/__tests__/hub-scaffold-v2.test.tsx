import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Phase 7 commit a — V2 composition contract (design-lock §9.5).
 *
 *  Asserts the four contract pieces that land in commit a:
 *    1. Document order: splash → HUD region → mastery dashboard → dock
 *    2. `[data-hub-v2]` attribute mounts on the root
 *    3. `[data-pro-active]` toggles when atmosphere shifts to warm-wood
 *    4. Dock PLAY tap fires `hub_v2_play_dock_tap` with `masteryProgress`
 *
 *  Assert §9.5 #4 — getComputedStyle CSS-var resolution — lands in
 *  commit b alongside the `[data-hub-v2]` palette tokens. Stubbing it
 *  here would couple commit a to palette decisions that belong to b.
 *
 *  All sheet integrations + their sheet-state hooks are mocked because
 *  three port tests (pro-sheet-port, shop-sheet-port, badge-sheet-port)
 *  already cover their wiring; this file owns layout + telemetry only. */

const pushMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const captureProOpts = vi.hoisted(() => ({
  current: null as
    | null
    | {
        onPurchaseSuccess?: (receipt: {
          txHash: `0x${string}`;
          daysGranted: number;
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

vi.mock("next/dynamic", () => ({
  default: () => () => (
    <div data-testid="hub-v2-splash-stub" data-component="hub-v2-splash" />
  ),
}));

// Sheet stubs — closed by default. Each port has its own dedicated test
// file; here we only need them off the layout path.
vi.mock("@/components/exercises/badge-sheet", () => ({
  BadgeSheet: () => null,
}));
vi.mock("@/components/exercises/shop-sheet", () => ({
  ShopSheet: () => null,
}));
vi.mock("@/components/exercises/purchase-confirm-sheet", () => ({
  PurchaseConfirmSheet: () => null,
}));
vi.mock("@/components/pro/pro-sheet", () => ({
  ProSheet: () => null,
}));

// The dynamic() mock above always renders this stub so document-order
// assertions can locate it. The real splash's localStorage gating + WCAG
// dismiss flow live in `hub-splash.test.tsx`.
vi.mock("@/components/hub/hub-splash", () => ({
  HubV2Splash: () => (
    <div data-testid="hub-v2-splash-stub" data-component="hub-v2-splash" />
  ),
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

vi.mock("@/lib/pro/use-pro-sheet-state", async () => {
  const { useState } = await import("react");
  return {
    useProSheetState: (opts?: {
      onPurchaseSuccess?: (receipt: {
        txHash: `0x${string}`;
        daysGranted: number;
        buyer: `0x${string}`;
      }) => void;
    }) => {
      captureProOpts.current = opts ?? null;
      const [open, setOpen] = useState(false);
      return {
        open,
        openSheet: () => setOpen(true),
        closeSheet: () => setOpen(false),
        sheetProps: {
          open,
          onOpenChange: (next: boolean) => setOpen(next),
        },
        proStatus: null,
      };
    },
  };
});

import { HubScaffoldV2Client } from "../hub-scaffold-v2-client";

beforeEach(() => {
  pushMock.mockReset();
  trackMock.mockReset();
  captureProOpts.current = null;
});

afterEach(() => {
  cleanup();
});

describe("HubScaffoldV2Client — composition contract (Phase 7 commit a)", () => {
  it("mounts splash, mastery dashboard, and dock PLAY in document order", () => {
    render(<HubScaffoldV2Client />);

    const root = screen.getByTestId("hub-v2-root");
    const splash = root.querySelector('[data-component="hub-v2-splash"]');
    const mastery = root.querySelector('[data-component="mastery-dashboard"]');
    const dock = root.querySelector('[data-component="hub-v2-dock"]');
    const play = root.querySelector('[data-testid="hub-v2-play-cta"]');

    expect(splash).not.toBeNull();
    expect(mastery).not.toBeNull();
    expect(dock).not.toBeNull();
    expect(play).not.toBeNull();

    // Verify document order: splash precedes mastery, mastery precedes dock.
    // Node.compareDocumentPosition returns DOCUMENT_POSITION_FOLLOWING (4)
    // when the argument node follows the receiver in tree order.
    expect(
      splash!.compareDocumentPosition(mastery!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      mastery!.compareDocumentPosition(dock!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("sets `[data-hub-v2]` on the scaffold root on mount", () => {
    render(<HubScaffoldV2Client />);
    const root = screen.getByTestId("hub-v2-root");
    expect(root.hasAttribute("data-hub-v2")).toBe(true);
  });

  it("toggles `[data-pro-active]` when atmosphere shifts to warm-wood", () => {
    render(<HubScaffoldV2Client />);
    const root = screen.getByTestId("hub-v2-root");

    // Cool-stone is the mount default — no PRO atmosphere yet.
    expect(root.hasAttribute("data-pro-active")).toBe(false);

    expect(captureProOpts.current?.onPurchaseSuccess).toBeTypeOf("function");
    act(() => {
      captureProOpts.current?.onPurchaseSuccess?.({
        txHash:
          "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        daysGranted: 30,
        buyer: "0x000000000000000000000000000000000000abcd",
      });
    });

    expect(root.hasAttribute("data-pro-active")).toBe(true);
    expect(root.getAttribute("data-atmosphere")).toBe("warm-wood");
  });

  it("fires `hub_v2_play_dock_tap` with masteryProgress payload on PLAY tap", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldV2Client />);

    await user.click(screen.getByTestId("hub-v2-play-cta"));

    expect(pushMock).toHaveBeenCalledWith("/arena");
    const tapCall = trackMock.mock.calls.find(
      (call) => call[0] === "hub_v2_play_dock_tap",
    );
    expect(tapCall).toBeDefined();
    const payload = tapCall?.[1] as { masteryProgress: number };
    expect(payload).toBeDefined();
    expect(typeof payload.masteryProgress).toBe("number");
    expect(payload.masteryProgress).toBeGreaterThanOrEqual(0);
    expect(payload.masteryProgress).toBeLessThanOrEqual(1);
  });
});
