import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnlockOverlay } from "@/components/progression/unlock-overlay";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

describe("UnlockOverlay", () => {
  it("names what was unlocked and offers a way in", () => {
    const onPrimary = vi.fn();
    render(
      <UnlockOverlay
        step={{ id: "special-training", absorbed: [] }}
        onPrimary={onPrimary}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Special Training Unlocked")).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: "Start Training" });
    expect(cta).toBeInTheDocument();

    fireEvent.click(cta);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("renders an absorbed recognition as a line, never as a second modal", () => {
    const onDismiss = vi.fn();
    render(
      <UnlockOverlay
        step={{
          id: "mastery",
          piece: "rook",
          // Global events absorbed under a piece-scoped closer: they carry NO
          // piece, and must not inherit the closer's.
          absorbed: [{ id: "great-focus-session" }, { id: "first-great-session" }],
        }}
        onPrimary={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText("Piece Mastered")).toBeInTheDocument();
    expect(screen.getByText("Great Focus Session recognized.")).toBeInTheDocument();
    expect(
      screen.getByText("Badge unlocked: First Great Session"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    onDismiss.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders in Spanish when the locale is es", () => {
    render(
      <UnlockOverlay
        step={{ id: "special-training", absorbed: [] }}
        onPrimary={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { locale: "es" },
    );
    expect(
      screen.getByText("Entrenamiento Especial Desbloqueado"),
    ).toBeInTheDocument();
  });
});
