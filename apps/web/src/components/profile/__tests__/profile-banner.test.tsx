import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, fireEvent } from "@testing-library/react";
import { ProfileBanner } from "@/components/profile/profile-banner";

describe("<ProfileBanner>", () => {
  it("renders display name, tier title, wallet, xp", () => {
    render(
      <ProfileBanner
        displayName="Akawolf"
        tierTitle="Knight"
        tierKey="knight"
        xp={247}
        truncatedWallet="0x0924…eba4"
        onEditName={() => {}}
      />,
    );
    expect(screen.getByText("Akawolf")).toBeInTheDocument();
    expect(screen.getByText("Knight")).toBeInTheDocument();
    expect(screen.getByText("0x0924…eba4")).toBeInTheDocument();
    expect(screen.getByText("247")).toBeInTheDocument();
  });

  it("fires onEditName when pen icon tapped", () => {
    const onEditName = vi.fn();
    render(
      <ProfileBanner
        displayName="Akawolf"
        tierTitle="Knight"
        tierKey="knight"
        xp={247}
        truncatedWallet="0x0924…eba4"
        onEditName={onEditName}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit display name/i }));
    expect(onEditName).toHaveBeenCalled();
  });
});
