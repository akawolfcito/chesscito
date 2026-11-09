// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PlayerAvatar } from "../player-avatar";
import { STYLE_DISC_COLOR } from "../avatar-style";
import { PIECES, STYLES } from "@/lib/identity/identity-lite";

describe("PlayerAvatar", () => {
  it("renders the piece sprite and the style disc color (no wallet needed)", () => {
    const { container } = render(
      <PlayerAvatar variant={{ piece: "knight", style: "golden", number: 1 }} />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toMatch(/knight/);
    const disc = img.closest("[data-avatar-disc]") as HTMLElement;
    expect(disc).not.toBeNull();
    expect(disc.style.backgroundColor).toBeTruthy();
    expect(disc.getAttribute("data-style")).toBe("golden");
  });

  it("uses an empty alt (decorative) by default", () => {
    const { container } = render(
      <PlayerAvatar variant={{ piece: "rook", style: "blue", number: 2 }} />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("alt")).toBe("");
  });

  it("exposes the nickname as alt when provided standalone", () => {
    const { container } = render(
      <PlayerAvatar
        variant={{ piece: "queen", style: "coral", number: 3 }}
        alt="Coral Queen #3"
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("alt")).toBe("Coral Queen #3");
  });

  it("renders for every piece × style combination without throwing", () => {
    for (const piece of PIECES) {
      for (const style of STYLES) {
        const { unmount } = render(
          <PlayerAvatar variant={{ piece, style, number: 7 }} size="sm" />,
        );
        expect(STYLE_DISC_COLOR[style]).toBeTruthy();
        unmount();
      }
    }
  });
});
