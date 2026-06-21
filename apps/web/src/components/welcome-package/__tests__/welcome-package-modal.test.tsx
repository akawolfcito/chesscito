import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
import { WelcomePackageModal } from "../welcome-package-modal";

describe("<WelcomePackageModal>", () => {
  it("renders title, subtitle, body text", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("You did it.")).toBeInTheDocument();
    expect(screen.getByText("Your first Focus Day is complete.")).toBeInTheDocument();
    expect(screen.getByText("Here's something to mark the moment.")).toBeInTheDocument();
  });

  it("renders claim CTA button", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /keep it/i })).toBeInTheDocument();
  });

  it("renders dismiss button", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /later/i })).toBeInTheDocument();
  });

  it("calls onClaim when claim button is tapped", () => {
    const onClaim = vi.fn();
    render(<WelcomePackageModal onClaim={onClaim} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /keep it/i }));
    expect(onClaim).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when dismiss button is tapped", () => {
    const onDismiss = vi.fn();
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /later/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows stamp fallback text 'Focus Stamp: Day 1' when no asset", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Focus Stamp: Day 1")).toBeInTheDocument();
  });

  it("copy contains no prohibited terms", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    const text = document.body.textContent ?? "";
    const prohibited = ["mint", "nft", "on-chain", "proof", "verified", "blockchain", "brain health", "cure", "improves memory", "improves focus"];
    for (const term of prohibited) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });
});

describe("<WelcomePackageModal> claimed state", () => {
  it("shows claimed confirmation message when claimed=true", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} claimed />);
    expect(screen.getByText(/focus stamp.*day 1.*saved/i)).toBeInTheDocument();
  });

  it("does not show claim/dismiss buttons when claimed=true", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} claimed />);
    expect(screen.queryByRole("button", { name: /keep it/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /later/i })).toBeNull();
  });
});

describe("<WelcomePackageModal> ES locale", () => {
  it("renders ES title and CTA", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />, { locale: "es" });
    expect(screen.getByText("Lo lograste.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /es tuyo/i })).toBeInTheDocument();
  });
});
