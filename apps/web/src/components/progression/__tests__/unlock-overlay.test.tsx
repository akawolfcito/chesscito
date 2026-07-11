import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnlockOverlay } from "@/components/progression/unlock-overlay";

describe("UnlockOverlay", () => {
  it("names what was unlocked and offers a way in", () => {
    render(
      <UnlockOverlay
        step={{ id: "special-training", absorbed: [] }}
        onPrimary={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Special Training Unlocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Training" })).toBeInTheDocument();
  });

  it("renders an absorbed recognition as a line, never as a second modal", () => {
    render(
      <UnlockOverlay
        step={{
          id: "mastery",
          piece: "rook",
          absorbed: ["great-focus-session", "first-great-session"],
        }}
        onPrimary={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Piece Mastered")).toBeInTheDocument();
    expect(screen.getByText("Great Focus Session recognized.")).toBeInTheDocument();
    expect(
      screen.getByText("Badge unlocked: First Great Session"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
