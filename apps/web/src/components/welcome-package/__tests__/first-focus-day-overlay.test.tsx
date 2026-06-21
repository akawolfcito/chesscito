import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
import { FirstFocusDayOverlay } from "../first-focus-day-overlay";

describe("<FirstFocusDayOverlay>", () => {
  it("renders achievement eyebrow, title, description", () => {
    render(<FirstFocusDayOverlay onContinue={vi.fn()} />);
    expect(screen.getByText("Achievement Unlocked")).toBeInTheDocument();
    expect(screen.getByText("First Focus Day")).toBeInTheDocument();
    expect(screen.getByText(/completed your first daily/i)).toBeInTheDocument();
  });

  it("renders Continue button", () => {
    render(<FirstFocusDayOverlay onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("calls onContinue when button is tapped", () => {
    const onContinue = vi.fn();
    render(<FirstFocusDayOverlay onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("copy contains no prohibited terms", () => {
    render(<FirstFocusDayOverlay onContinue={vi.fn()} />);
    const text = document.body.textContent ?? "";
    const prohibited = ["mint", "nft", "on-chain", "proof", "verified", "blockchain"];
    for (const term of prohibited) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });
});

describe("<FirstFocusDayOverlay> ES locale", () => {
  it("renders ES content", () => {
    render(<FirstFocusDayOverlay onContinue={vi.fn()} />, { locale: "es" });
    expect(screen.getByText("Logro Desbloqueado")).toBeInTheDocument();
    expect(screen.getByText("Primer Focus Day")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
  });
});
