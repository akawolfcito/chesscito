/**
 * LanguageChip — flag + code chip, tap → confirm card, switch via
 * next-intl router. No auto-switch, no timers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, fireEvent } from "@testing-library/react";

const replaceMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: replaceMock }),
}));

import { LanguageChip } from "../language-chip";

beforeEach(() => {
  replaceMock.mockReset();
});

describe("LanguageChip", () => {
  it("renders the flag + locale code chip (canonical HUD pill family)", () => {
    render(<LanguageChip />);
    const chip = screen.getByTestId("language-chip");
    expect(chip).toHaveTextContent("\u{1F1FA}\u{1F1F8}");
    expect(chip).toHaveTextContent("EN");
    expect(chip.className).toMatch(/candy-tray-pill/);
    expect(chip.className).toMatch(/hub-hud-pill/);
  });

  it("tap opens the picker card and does NOT switch by itself", () => {
    render(<LanguageChip />);
    fireEvent.click(screen.getByTestId("language-chip"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("selecting the other flag + Apply switches locale on the same pathname", () => {
    render(<LanguageChip />);
    fireEvent.click(screen.getByTestId("language-chip"));
    fireEvent.click(screen.getByTestId("language-tile-es"));
    fireEvent.click(screen.getByTestId("language-chip-confirm"));
    expect(replaceMock).toHaveBeenCalledWith("/", { locale: "es" });
  });

  it("Apply with the active locale selected closes without navigation", () => {
    render(<LanguageChip />);
    fireEvent.click(screen.getByTestId("language-chip"));
    // English (active) stays selected → Apply is a no-op close.
    fireEvent.click(screen.getByTestId("language-chip-confirm"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("red X closes the card without navigation", () => {
    render(<LanguageChip />);
    fireEvent.click(screen.getByTestId("language-chip"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
