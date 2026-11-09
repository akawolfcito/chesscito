import { describe, it, expect } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { SettingsSheetStub } from "@/components/hub/settings-sheet-stub";

describe("<SettingsSheetStub>", () => {
  it("renders Settings header + version chip", () => {
    render(<SettingsSheetStub buildSha="abc123f" />);
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.getByText(/abc123f/i)).toBeInTheDocument();
  });

  it("renders disabled toggles with Coming soon tooltip", () => {
    render(<SettingsSheetStub buildSha="abc123f" />);
    const themeToggle = screen.getByRole("button", { name: /theme/i });
    expect(themeToggle).toBeDisabled();
    expect(themeToggle).toHaveAttribute("title", expect.stringMatching(/coming soon/i));
  });
});
