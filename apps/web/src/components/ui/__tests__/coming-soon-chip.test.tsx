import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ComingSoonChip } from "../coming-soon-chip";
import { PRO_COPY } from "@/lib/content/editorial";

afterEach(cleanup);

describe("ComingSoonChip", () => {
  it("renders the SOON label sourced from PRO_COPY", () => {
    render(<ComingSoonChip />);
    expect(screen.getByText(PRO_COPY.comingSoonLabel)).toBeInTheDocument();
  });

  it("renders as an inline <span> (decorative, non-interactive)", () => {
    const { container } = render(<ComingSoonChip />);
    const root = container.firstElementChild;
    expect(root?.tagName).toBe("SPAN");
  });

  it("appends caller-provided className without clobbering internals", () => {
    const { container } = render(<ComingSoonChip className="ml-2 custom-x" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("ml-2");
    expect(root.className).toContain("custom-x");
    // sanity: internal pill classes still present
    expect(root.className).toContain("rounded-full");
    expect(root.className).toContain("uppercase");
  });
});
