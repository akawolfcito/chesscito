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

  it("renders the PlayerAvatar piece sprite when a variant is provided", () => {
    const { container } = render(
      <ProfileBanner
        displayName="Golden Knight #4821"
        variant={{ piece: "knight", style: "golden", number: 4821 }}
        tierTitle="Knight"
        tierKey="knight"
        xp={247}
        truncatedWallet="0x0924…eba4"
        onEditName={() => {}}
      />,
    );
    const img = container.querySelector(
      ".profile-banner-avatar-wrap img",
    ) as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toMatch(/knight/);
  });

  it("falls back to the wizard emoji when no variant (visitor)", () => {
    render(
      <ProfileBanner
        displayName="Visitor"
        tierTitle="Visitor"
        tierKey="visitor"
        xp={0}
        truncatedWallet=""
        onEditName={() => {}}
      />,
    );
    expect(screen.getByText("🧙")).toBeInTheDocument();
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
