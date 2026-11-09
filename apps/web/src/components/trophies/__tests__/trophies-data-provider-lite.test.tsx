import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";

vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
vi.mock("@/lib/game/victory-events", () => ({ getVictoryAddress: () => "0xconfigured" }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xplayer", isConnected: true }),
}));

import { TrophiesDataProvider } from "../trophies-data-provider";

describe("TrophiesDataProvider — Lite", () => {
  it("does not request legacy victory data when an address is configured", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <TrophiesDataProvider>
        <div />
      </TrophiesDataProvider>,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
