import { describe, it, expect } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";

import { SavedChip } from "../saved-chip";

describe("SavedChip", () => {
  it("renders the cofre-check seal + star count + hint (visual-first)", () => {
    const { container } = render(<SavedChip stars={12} total={15} />);
    const root = container.querySelector('[data-component="saved-chip"]');
    expect(root).not.toBeNull();
    // The saved seal art carries the "saved" meaning (no plain "Saved ·" text).
    const seal = container.querySelector('img[src*="score-saved"]');
    expect(seal).not.toBeNull();
    // Stars stay visible as a calm stat (no denominator).
    expect(
      container.querySelector('[data-testid="saved-chip-stars"]')?.textContent,
    ).toContain("12");
    // Hint clarifies how to re-save.
    expect(root?.textContent).toContain("Beat your score to save again");
  });

  it("renders a passive status span when no receipt URL is provided", () => {
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
