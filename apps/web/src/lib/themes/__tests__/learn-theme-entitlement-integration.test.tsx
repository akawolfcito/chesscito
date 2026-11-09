import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { HubProBadge } from "@/components/hub/hub-pro-badge";

const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";

vi.mock("@/lib/feature-flags", () => ({
  CHESSCITO_MODE: "learn",
  CHESSCITO_LITE_MODE: true,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: WALLET }),
}));
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => false,
  useProEntitlement: () => ({
    status: "inactive",
    active: false,
    loading: false,
    expiresAt: null,
    stale: null,
    error: null,
  }),
}));

import {
  EffectiveTrainingPassProvider,
  useSeasonPassStatus,
  type SeasonPassStatusSnapshot,
} from "@/lib/season-pass/use-season-pass-status";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { ThemeVariantProvider } from "../theme-variant-provider";
import { THEMES } from "../theme-registry";

const originalAvatar = THEMES["candy-forest"].assets["hub.avatar-lite"];
let latestStatus: SeasonPassStatusSnapshot | null = null;

function CommercialState() {
  latestStatus = useSeasonPassStatus(WALLET);
  const isPro = useIsProActive();
  return (
    <>
      <output
        data-testid="commercial-state"
        data-source={latestStatus.source ?? "none"}
        data-pro={isPro}
        data-shields={latestStatus.shieldsCredited}
      />
      <HubProBadge
        active={isPro}
        visualActive={isPro}
        ariaLabel="PRO inactive"
      />
    </>
  );
}

function Subject() {
  return (
    <EffectiveTrainingPassProvider>
      <ThemeVariantProvider>
        <CommercialState />
        <ThemeAssetPicture slot="hub.avatar-lite" alt="Learn mascot" />
      </ThemeVariantProvider>
    </EffectiveTrainingPassProvider>
  );
}

beforeEach(() => {
  latestStatus = null;
  THEMES["candy-forest"].assets["hub.avatar-lite"] = {
    default: "/art/default-learn-wolf",
    pro: "/art/premium-learn-wolf",
  };
});

afterEach(() => {
  THEMES["candy-forest"].assets["hub.avatar-lite"] = originalAvatar;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LEARN effective Training Pass to theme integration", () => {
  it("updates the premium visual after direct purchase without asserting PRO", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ active: false, source: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          active: true,
          source: "season_pass",
          seasonPassExpiresAt: "2099-07-20T00:00:00.000Z",
          proExpiresAt: null,
          shieldsCredited: 3,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<Subject />);
    const image = view.getByRole("img", { name: "Learn mascot" });

    await waitFor(() => {
      expect(image).toHaveAttribute("src", "/art/default-learn-wolf.png");
      expect(view.getByTestId("commercial-state")).toHaveAttribute(
        "data-source",
        "none",
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latestStatus?.refresh();
    });

    await waitFor(() => {
      expect(image).toHaveAttribute("src", "/art/premium-learn-wolf.png");
      expect(view.getByTestId("commercial-state")).toHaveAttribute(
        "data-source",
        "season_pass",
      );
    });
    expect(view.getByTestId("commercial-state")).toHaveAttribute(
      "data-pro",
      "false",
    );
    expect(
      view.container.querySelector(".hub-pro-badge-bg img"),
    ).toHaveAttribute("src", "/art/hub/pro-chip-inactive.png");
    expect(view.getByTestId("commercial-state")).toHaveAttribute(
      "data-shields",
      "3",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await latestStatus?.refresh();
    });
    await waitFor(() => {
      expect(image).toHaveAttribute("src", "/art/premium-learn-wolf.png");
      expect(view.getByTestId("commercial-state")).toHaveAttribute(
        "data-source",
        "none",
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
