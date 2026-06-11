/**
 * LanguageChip — flag + code chip, tap → confirm card, switch via
 * next-intl router. No auto-switch, no timers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, fireEvent } from "@testing-library/react";

const replaceMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/hub",
  useRouter: () => ({ replace: replaceMock }),
}));

import { LanguageChip } from "../language-chip";

beforeEach(() => {
  replaceMock.mockReset();
});

describe("LanguageChip", () => {
  it("renders the bare flag button (no pill, no locale code)", () => {
    render(<LanguageChip />);
    const chip = screen.getByTestId("language-chip");
    expect(chip).toHaveTextContent("\u{1F1FA}\u{1F1F8}");
    expect(chip).not.toHaveTextContent("EN");
    expect(chip.className).not.toMatch(/candy-tray-pill/);
  });

  it("tap opens the confirm card and does NOT switch by itself", () => {
    render(<LanguageChip />);
    fireEvent.click(screen.getByTestId("language-chip"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("confirm switches to the other locale on the same pathname", () => {
    render(<LanguageChip />);
    fireEvent.click(screen.getByTestId("language-chip"));
    fireEvent.click(screen.getByTestId("language-chip-confirm"));
    expect(replaceMock).toHaveBeenCalledWith("/hub", { locale: "es" });
  });

  it("cancel closes the card without navigation", () => {
    render(<LanguageChip />);
    fireEvent.click(screen.getByTestId("language-chip"));
    fireEvent.click(screen.getByText("Not now"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
