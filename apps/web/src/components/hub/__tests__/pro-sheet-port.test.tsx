import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Phase 3 commit 1 — ProSheet port into <HubScaffoldV2Client>.
 *  Verifies the design-lock §9.1 contract (3 asserts):
 *    1. PRO chip tap mounts <ProSheet> in-place (no router push)
 *    2. Sheet close does NOT change the URL
 *    3. Purchase success fires `hub_atmosphere_shift` with trigger:"purchase"
 *
 *  We mock <ProSheet> to a stub, and `useProSheetState` to a tiny stateful
 *  mock that captures the `onPurchaseSuccess` option V2 passes in. That
 *  isolates the unit under test (V2's wiring + telemetry) from the wagmi /
 *  RainbowKit dep graph the real hook owns. The hook's own success path is
 *  covered by `use-pro-sheet-state.test.tsx`. */

const pushMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const captureOpts = vi.hoisted(() => ({
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

// V2 reads `useAccount` for the cross-wallet receipt guard (design-lock
// §6.4 race 3). Default to "no wallet" — the guard only kicks in when an
// address is present, and our success-path test injects a buyer that
// matches the active address (or is irrelevant when address is undefined).
vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: undefined as `0x${string}` | undefined,
    isConnected: false,
  }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

// BadgeSheet path is out-of-scope for this test file — V2 imports
// `useBadgeSheetState` + the sheet, both stubbed here so the import
// graph stays cheap. The badge port has its own dedicated test
// (`badge-sheet-port.test.tsx`).
vi.mock("@/components/exercises/badge-sheet", () => ({
  BadgeSheet: () => null,
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

// Stub ProSheet — we only care that V2 mounts it when open is true and
// that closing it routes through onOpenChange(false). The real sheet's
// internals (purchase flow, status branches) are tested separately.
vi.mock("@/components/pro/pro-sheet", () => ({
  ProSheet: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) =>
    open ? (
      <div data-testid="pro-sheet-root">
        <button
          type="button"
          data-testid="pro-sheet-close"
          onClick={() => onOpenChange(false)}
        >
          Close
        </button>
      </div>
    ) : null,
}));

// Tiny stateful mock for the hook — enough surface to drive open/close,
// expose sheetProps, and capture the onPurchaseSuccess callback V2 wires.
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
      captureOpts.current = opts ?? null;
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
  captureOpts.current = null;
});

afterEach(() => {
  cleanup();
});

describe("HubScaffoldV2Client — ProSheet port", () => {
  it("mounts <ProSheet> in-place on PRO chip tap (no router push)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldV2Client />);

    expect(screen.queryByTestId("pro-sheet-root")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("hub-v2-pro-chip"));

    expect(screen.getByTestId("pro-sheet-root")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("closes the sheet without changing the URL", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldV2Client />);

    await user.click(screen.getByTestId("hub-v2-pro-chip"));
    expect(screen.getByTestId("pro-sheet-root")).toBeInTheDocument();

    await user.click(screen.getByTestId("pro-sheet-close"));

    expect(screen.queryByTestId("pro-sheet-root")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("fires hub_atmosphere_shift with trigger:purchase when onPurchaseSuccess invokes", () => {
    render(<HubScaffoldV2Client />);

    expect(captureOpts.current?.onPurchaseSuccess).toBeTypeOf("function");

    act(() => {
      captureOpts.current?.onPurchaseSuccess?.({
        txHash:
          "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        daysGranted: 30,
        buyer: "0x000000000000000000000000000000000000abcd",
      });
    });

    const shiftCall = trackMock.mock.calls.find(
      (call) => call[0] === "hub_atmosphere_shift",
    );
    expect(shiftCall).toBeDefined();
    expect(shiftCall?.[1]).toMatchObject({
      from: "cool-stone",
      to: "warm-wood",
      trigger: "purchase",
    });
  });
});
