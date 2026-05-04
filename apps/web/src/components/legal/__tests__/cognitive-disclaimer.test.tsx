import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CognitiveDisclaimer } from "../cognitive-disclaimer";
import { COGNITIVE_DISCLAIMER_COPY } from "@/lib/content/editorial";

describe("CognitiveDisclaimer", () => {
  it("renders the short copy by default", () => {
    render(<CognitiveDisclaimer />);
    expect(screen.getByText(COGNITIVE_DISCLAIMER_COPY.short)).toBeInTheDocument();
    expect(screen.queryByText(COGNITIVE_DISCLAIMER_COPY.full)).not.toBeInTheDocument();
  });

  it("renders the full copy when variant=full", () => {
    render(<CognitiveDisclaimer variant="full" />);
    expect(screen.getByText(COGNITIVE_DISCLAIMER_COPY.full)).toBeInTheDocument();
    expect(screen.queryByText(COGNITIVE_DISCLAIMER_COPY.short)).not.toBeInTheDocument();
  });

  it("renders the short copy when variant=short is explicit", () => {
    render(<CognitiveDisclaimer variant="short" />);
    expect(screen.getByText(COGNITIVE_DISCLAIMER_COPY.short)).toBeInTheDocument();
  });

  it("exposes a screen-reader friendly note role and label", () => {
    render(<CognitiveDisclaimer variant="short" />);
    const node = screen.getByRole("note", { name: /cognitive disclaimer/i });
    expect(node).toBeInTheDocument();
  });

  it("never weakens the disclaimer — the 'does not replace' framing is required in both variants", () => {
    expect(COGNITIVE_DISCLAIMER_COPY.short).toMatch(/does not replace/i);
    expect(COGNITIVE_DISCLAIMER_COPY.full).toMatch(/does not replace/i);
  });

  it("merges the optional className alongside the base classes", () => {
    render(<CognitiveDisclaimer className="footer-test-class" />);
    const node = screen.getByRole("note");
    expect(node.className).toMatch(/footer-test-class/);
    // Sanity: still has base spacing from the component itself.
    expect(node.className).toMatch(/text-center/);
  });
});
