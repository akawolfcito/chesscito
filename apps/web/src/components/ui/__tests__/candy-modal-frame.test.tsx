/**
 * Sprint 6 commit B — CandyModalFrame primitive tests.
 *
 * Contract:
 *   - renders each slot when provided, omits when not
 *   - tone prop drives data-tone + palette classes
 *   - className passthrough composes with built-in classes
 *   - no rendering when no props
 *   - no business logic (pure presentational primitive)
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CandyModalFrame } from "@/components/ui/candy-modal-frame";

describe("CandyModalFrame", () => {
  it("renders title + subtitle when provided", () => {
    render(<CandyModalFrame title="Hello" subtitle="World" />);
    expect(screen.getByTestId("candy-modal-frame-title").textContent).toBe(
      "Hello",
    );
    expect(screen.getByTestId("candy-modal-frame-subtitle").textContent).toBe(
      "World",
    );
  });

  it("omits title slot when title not provided", () => {
    render(<CandyModalFrame subtitle="only sub" />);
    expect(screen.queryByTestId("candy-modal-frame-title")).toBeNull();
    expect(screen.getByTestId("candy-modal-frame-subtitle")).toBeInTheDocument();
  });

  it("renders iconSlot, children, footerSlot when provided", () => {
    render(
      <CandyModalFrame
        iconSlot={<span data-testid="icon-content">★</span>}
        footerSlot={<span data-testid="footer-content">CTA</span>}
      >
        <span data-testid="body-content">body</span>
      </CandyModalFrame>,
    );
    expect(screen.getByTestId("candy-modal-frame-icon")).toBeInTheDocument();
    expect(screen.getByTestId("icon-content")).toBeInTheDocument();
    expect(screen.getByTestId("candy-modal-frame-body")).toBeInTheDocument();
    expect(screen.getByTestId("body-content")).toBeInTheDocument();
    expect(screen.getByTestId("candy-modal-frame-footer")).toBeInTheDocument();
    expect(screen.getByTestId("footer-content")).toBeInTheDocument();
  });

  it("omits body wrapper when no children supplied", () => {
    render(<CandyModalFrame title="t" />);
    expect(screen.queryByTestId("candy-modal-frame-body")).toBeNull();
  });

  it.each(["amber", "sky", "neutral", "warning"] as const)(
    "tone=%s sets data-tone attribute",
    (tone) => {
      render(<CandyModalFrame tone={tone} title="x" />);
      expect(screen.getByTestId("candy-modal-frame")).toHaveAttribute(
        "data-tone",
        tone,
      );
    },
  );

  it("defaults to neutral tone when prop omitted", () => {
    render(<CandyModalFrame title="x" />);
    expect(screen.getByTestId("candy-modal-frame")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
  });

  it("composes className passthrough with built-in classes", () => {
    render(<CandyModalFrame title="x" className="custom-anchor" />);
    const frame = screen.getByTestId("candy-modal-frame");
    expect(frame.className).toContain("custom-anchor");
    expect(frame.className).toContain("rounded-3xl");
  });

  it("renders the frame even with zero slots (pure presentational, no errors)", () => {
    render(<CandyModalFrame />);
    expect(screen.getByTestId("candy-modal-frame")).toBeInTheDocument();
  });
});
