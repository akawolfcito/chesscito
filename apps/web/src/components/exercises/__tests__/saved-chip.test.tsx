import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { SavedChip } from "../saved-chip";

describe("SavedChip", () => {
  it("renders the documented copy with stars + total", () => {
    const { container } = render(<SavedChip stars={12} total={15} />);
    const root = container.querySelector('[data-component="saved-chip"]');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain("Saved · 12/15★ on chain");
  });

  it("exposes the full aria-label for screen readers", () => {
    const { container } = render(<SavedChip stars={5} total={15} />);
    const root = container.querySelector('[data-component="saved-chip"]');
    expect(root?.getAttribute("aria-label")).toBe(
      "Saved 5 of 15 stars on chain",
    );
  });

  it("declares role='status' so the chip is announced as a passive update", () => {
    const { container } = render(<SavedChip stars={15} total={15} />);
    const root = container.querySelector('[data-component="saved-chip"]');
    expect(root?.getAttribute("role")).toBe("status");
  });
});
