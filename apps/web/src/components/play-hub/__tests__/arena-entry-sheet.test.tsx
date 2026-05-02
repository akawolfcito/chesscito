import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArenaEntrySheet } from "../arena-entry-sheet";

// next/navigation is App-Router only; the component uses useRouter for
// navigation on Enter Arena. The default-difficulty test path never
// triggers handleStart, so a no-op stub is enough.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const LAST_DIFFICULTY_KEY = "chesscito:arena-last-difficulty";

describe("ArenaEntrySheet — default difficulty", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("preselects Easy when localStorage has no prior choice", () => {
    render(
      <ArenaEntrySheet
        open
        onOpenChange={vi.fn()}
        trigger={<button>open</button>}
      />,
    );
    // Three difficulty buttons render with aria-pressed; only the
    // selected one is true. Filter by name to scope past the color
    // toggle which also uses aria-pressed.
    const easyBtn = screen.getByRole("button", { name: /^Easy/ });
    expect(easyBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Medium/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /^Hard/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("respects a previously stored difficulty over the easy fallback", () => {
    localStorage.setItem(LAST_DIFFICULTY_KEY, "medium");
    render(
      <ArenaEntrySheet
        open
        onOpenChange={vi.fn()}
        trigger={<button>open</button>}
      />,
    );
    expect(screen.getByRole("button", { name: /^Medium/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Easy/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
