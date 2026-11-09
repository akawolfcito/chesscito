import { describe, it, expect, vi } from "vitest";
import { renderWithIntl, screen, fireEvent } from "@/test-utils/render-with-intl";

import { ConnectPromptToast } from "../connect-prompt-toast";

describe("<ConnectPromptToast>", () => {
  it("renders the stars subline for milestone=stars", () => {
    renderWithIntl(
      <ConnectPromptToast
        milestone="stars"
        onConnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/3 stars\. Connect your wallet/i),
    ).toBeInTheDocument();
  });

  it("renders the victory subline for milestone=victory", () => {
    renderWithIntl(
      <ConnectPromptToast
        milestone="victory"
        onConnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/You won\./i)).toBeInTheDocument();
  });

  it("renders the badges subline for milestone=badges", () => {
    renderWithIntl(
      <ConnectPromptToast
        milestone="badges"
        onConnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Badges are ready to claim/i)).toBeInTheDocument();
  });

  it("fires onConnect when the primary CTA is clicked", () => {
    const onConnect = vi.fn();
    renderWithIntl(
      <ConnectPromptToast
        milestone="stars"
        onConnect={onConnect}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /connect to save/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("fires onDismiss when the dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    renderWithIntl(
      <ConnectPromptToast
        milestone="stars"
        onConnect={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /dismiss connect reminder/i }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses alertdialog role with labeled title and subline for a11y", () => {
    renderWithIntl(
      <ConnectPromptToast
        milestone="victory"
        onConnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "connect-prompt-title");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "connect-prompt-subline",
    );
    expect(dialog).toHaveAttribute("data-milestone", "victory");
  });

  it("renders the ES subline when locale=es", () => {
    renderWithIntl(
      <ConnectPromptToast
        milestone="stars"
        onConnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { locale: "es" },
    );
    expect(screen.getByText(/Ganaste 3 estrellas/i)).toBeInTheDocument();
  });
});
