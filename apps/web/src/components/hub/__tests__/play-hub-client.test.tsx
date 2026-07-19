import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.hoisted(() => vi.fn());
const openProMock = vi.hoisted(() => vi.fn());
const openShopMock = vi.hoisted(() => vi.fn());
const connectMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const playDataMock = vi.hoisted(() => vi.fn());
const proStateMock = vi.hoisted(() => vi.fn());
const entitlementMock = vi.hoisted(() => vi.fn());

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/components/hub/use-play-hub-data", () => ({
  usePlayHubData: () => playDataMock(),
}));
vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: connectMock }),
}));
// The client owns the Peones read now (the scaffold used to smuggle it in via
// the chip). Unmocked, this reaches wagmi's useAccount and throws.
vi.mock("@/lib/peones/use-peones-balance", () => ({
  usePeonesBalance: () => ({ state: { kind: "guest" }, refetch: vi.fn() }),
}));
vi.mock("@/lib/pro/use-pro-sheet-state", () => ({
  useProSheetState: () => proStateMock(),
}));
vi.mock("@/lib/pro/use-is-pro-active", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pro/use-is-pro-active")>();
  return {
    ...actual,
    useProEntitlement: () => entitlementMock(),
  };
});
vi.mock("@/lib/shop/use-shop-sheet-state", () => ({
  useShopSheetState: () => ({
    openSheet: openShopMock,
    sheetProps: {},
    confirmProps: {},
  }),
}));
vi.mock("@/lib/telemetry", () => ({ track: (...args: unknown[]) => trackMock(...args) }));
vi.mock("@/components/hub/play-hub-scaffold", () => ({
  PlayHubScaffold: (props: {
    mintedVictoryCount: number;
    pro: { active: boolean };
    onArenaPress: () => void;
    onCoachTap: () => void;
    onShopTap: () => void;
  }) => (
    <div data-testid="play-hub" data-pro={props.pro.active}>
      <span>victories:{props.mintedVictoryCount}</span>
      <button onClick={props.onArenaPress}>arena</button>
      <button onClick={props.onCoachTap}>coach</button>
      <button onClick={props.onShopTap}>shop</button>
    </div>
  ),
}));

import { PlayHubClient } from "../play-hub-client";

describe("PlayHubClient", () => {
  beforeEach(() => {
    pushMock.mockReset();
    openProMock.mockReset();
    openShopMock.mockReset();
    connectMock.mockReset();
    trackMock.mockReset();
    playDataMock.mockReturnValue({
      address: "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
      isConnected: true,
      mintedVictoryCount: 3,
    });
    proStateMock.mockReturnValue({
      proStatus: null,
      openSheet: openProMock,
      sheetProps: {},
    });
    entitlementMock.mockReturnValue({
      status: "inactive",
      active: false,
      loading: false,
      cachedPro: false,
      expiresAt: null,
    });
  });

  it("passes the minted Victory NFT count to the Play scaffold", () => {
    render(<PlayHubClient />);
    expect(screen.getByText("victories:3")).toBeInTheDocument();
  });

  it("updates the Hub CTA state when the shared entitlement hydrates", () => {
    const view = render(<PlayHubClient />);
    expect(screen.getByTestId("play-hub")).toHaveAttribute("data-pro", "false");

    entitlementMock.mockReturnValue({
      status: "active",
      active: true,
      loading: false,
      cachedPro: true,
      expiresAt: Date.now() + 7 * 86_400_000,
    });
    view.rerender(<PlayHubClient />);

    expect(screen.getByTestId("play-hub")).toHaveAttribute("data-pro", "true");
  });

  it("uses Arena as its navigation CTA and never routes to exercises", async () => {
    render(<PlayHubClient />);
    await userEvent.click(screen.getByText("arena"));
    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining("/exercises"));
  });

  // The Coach used to hand a free player the paywall. It cannot anymore: a
  // player who never buys PRO would never learn the analysis exists, and so
  // could never want it. The journal was never PRO-gated — only this hub hid
  // it. If someone ever restores the `if`, these two go red.
  it("routes a free player to the journal instead of the paywall", async () => {
    render(<PlayHubClient />);
    await userEvent.click(screen.getByText("coach"));
    expect(pushMock).toHaveBeenCalledWith("/coach/history");
    expect(openProMock).not.toHaveBeenCalled();
  });

  it("routes an active PRO player to the same journal", async () => {
    const expiresAt = Date.now() + 7 * 86_400_000;
    proStateMock.mockReturnValue({
      proStatus: { active: true, expiresAt },
      openSheet: openProMock,
      sheetProps: {},
    });
    entitlementMock.mockReturnValue({
      status: "active",
      active: true,
      loading: false,
      cachedPro: true,
      expiresAt,
    });
    render(<PlayHubClient />);
    await userEvent.click(screen.getByText("coach"));
    expect(pushMock).toHaveBeenCalledWith("/coach/history");
    expect(openProMock).not.toHaveBeenCalled();
  });

  it("opens the Play shop in place", async () => {
    render(<PlayHubClient />);
    await userEvent.click(screen.getByText("shop"));
    expect(openShopMock).toHaveBeenCalledTimes(1);
  });
});
