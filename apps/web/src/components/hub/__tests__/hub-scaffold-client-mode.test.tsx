import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen } from "@testing-library/react";

const useHubDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/feature-flags", () => ({
  CHESSCITO_MODE: "play",
  CHESSCITO_LITE_MODE: false,
}));
vi.mock("@/components/hub/use-hub-data", () => ({
  useHubData: () => useHubDataMock(),
}));
vi.mock("@/components/hub/play-hub-client", () => ({
  PlayHubClient: () => <div>isolated-play-hub</div>,
}));

import { HubScaffoldClient } from "../hub-scaffold-client";

describe("HubScaffoldClient mode dispatch", () => {
  it("mounts Play without executing useHubData", () => {
    render(<HubScaffoldClient />);

    expect(screen.getByText("isolated-play-hub")).toBeInTheDocument();
    expect(useHubDataMock).not.toHaveBeenCalled();
  });
});
