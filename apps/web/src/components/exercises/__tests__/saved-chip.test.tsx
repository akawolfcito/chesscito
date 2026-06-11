import { describe, it, expect } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";

import { SavedChip } from "../saved-chip";

describe("SavedChip — pin form (founder check/dot system 2026-06-11)", () => {
  it("renders the bare icon + green check, no star pill and no long hint text", () => {
    const { container } = render(<SavedChip stars={12} total={15} />);
    const root = container.querySelector('[data-component="saved-chip"]');
    expect(root).not.toBeNull();
    // The seal art carries the "saved" meaning, the check marks done.
    expect(container.querySelector('img[src*="score-saved"]')).not.toBeNull();
    const check = container.querySelector(".action-pin-status--done");
    expect(check).not.toBeNull();
    expect(check).toHaveTextContent("✓");
    // Long-form chip elements are gone.
    expect(
      container.querySelector('[data-testid="saved-chip-stars"]'),
    ).toBeNull();
    expect(root?.textContent).not.toContain("Beat your score to save again");
  });

  it("shows the nano pin label below the icon", () => {
    const { container } = render(<SavedChip stars={12} total={15} />);
    const label = container.querySelector(".action-pin-label");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("Saved");
  });

  it("keeps the full save-again guidance in the passive status aria-label", () => {
    const { container } = render(<SavedChip stars={5} total={15} />);
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-label")).toBe(
      "Score saved: 5 of 15 stars. Beat your score to save again.",
    );
  });

  it("renders as a tappable link to the receipt when receiptUrl is provided", () => {
    const url = "https://celoscan.io/tx/0xabc";
    const { container } = render(
      <SavedChip stars={10} total={15} receiptUrl={url} />,
    );
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(url);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.getAttribute("aria-label")).toBe(
      "Score saved on chain: 10 of 15 stars. Tap to view receipt on Celoscan.",
    );
  });
});
