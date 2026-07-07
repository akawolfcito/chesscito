import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { KingdomCard } from "../kingdom-card";

describe("KingdomCard", () => {
  it("renders the panel title, body and the 3 benefit labels in both states", () => {
    render(<KingdomCard pro={{ active: false }} onProDiscover={() => {}} />);

    expect(screen.getByText("Play Kingdom")).toBeInTheDocument();
    expect(
      screen.getByText("Play matches, sharpen tactics, and improve with Coach."),
    ).toBeInTheDocument();
    expect(screen.getByText("Quick Match")).toBeInTheDocument();
    expect(screen.getByText("Coach Review")).toBeInTheDocument();
    expect(screen.getByText("Rewards")).toBeInTheDocument();
  });

  it("non-PRO: chip is a tappable discovery pill that fires onProDiscover", async () => {
    const onProDiscover = vi.fn();
    render(<KingdomCard pro={{ active: false }} onProDiscover={onProDiscover} />);

    const chip = screen.getByRole("button", { name: "Discover PRO benefits" });
    expect(chip).toHaveTextContent("PRO");
    await userEvent.click(chip);
    expect(onProDiscover).toHaveBeenCalledTimes(1);
  });

  it("PRO active: chip is a non-interactive 'PRO active' badge", () => {
    render(
      <KingdomCard pro={{ active: true, daysRemaining: 206 }} onProDiscover={() => {}} />,
    );

    expect(screen.getByTestId("kingdom-pro-chip").tagName).not.toBe("BUTTON");
    expect(screen.getByText("PRO active")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Discover PRO benefits" }),
    ).not.toBeInTheDocument();
  });
});
