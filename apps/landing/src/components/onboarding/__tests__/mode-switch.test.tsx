import { describe, expect, it } from "vitest";
import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { ModeSwitch } from "@/components/onboarding/mode-switch";

function linkFor(name: RegExp) {
  return screen.getByRole("link", { name });
}

describe("ModeSwitch", () => {
  it("offers both destinations as real links", () => {
    renderWithIntl(<ModeSwitch lastUsedMode={null} />);

    expect(linkFor(/training/i)).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
    expect(linkFor(/play/i)).toHaveAttribute("href", "/api/enter?mode=play");
  });

  // The gold half is a product recommendation ("start here"), not a reading of
  // the visitor's history. It never moves, so it cannot be confused with the
  // Last used label, which does move.
  it("recommends LEARN regardless of what the visitor last chose", () => {
    for (const mode of [null, "learn", "play"] as const) {
      const { unmount } = renderWithIntl(<ModeSwitch lastUsedMode={mode} />);
      expect(linkFor(/training/i)).toHaveAttribute("data-recommended", "true");
      expect(linkFor(/play/i)).not.toHaveAttribute("data-recommended");
      unmount();
    }
  });

  // aria-pressed belongs to role=button. Styling a link with it would put an
  // attribute in the DOM that no screen reader interprets, purely to paint.
  it("never uses aria-pressed on a link", () => {
    renderWithIntl(<ModeSwitch lastUsedMode="learn" />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-pressed");
    }
  });

  it("shows no label for a first-time visitor", () => {
    renderWithIntl(<ModeSwitch lastUsedMode={null} />);
    expect(screen.queryByText(/last used/i)).not.toBeInTheDocument();
  });

  it("hangs the label off the half the visitor last used", () => {
    renderWithIntl(<ModeSwitch lastUsedMode="play" />);

    const labels = screen.getAllByText(/last used/i);
    expect(labels).toHaveLength(1);

    // The label must reach assistive tech, not just the eye: the link it
    // describes has to point at it.
    const described = linkFor(/play/i).getAttribute("aria-describedby");
    expect(described).toBe(labels[0].id);
    expect(linkFor(/training/i)).not.toHaveAttribute("aria-describedby");
  });

  it("translates both the labels and the Last used badge", () => {
    renderWithIntl(<ModeSwitch lastUsedMode="learn" />, { locale: "es" });

    expect(linkFor(/entrenar/i)).toHaveAttribute("href", "/api/enter?mode=learn");
    expect(screen.getByText("Última vez")).toBeInTheDocument();
  });
});
