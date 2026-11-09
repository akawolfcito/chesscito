import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CognitiveDisclaimer } from "../cognitive-disclaimer";
import { COGNITIVE_DISCLAIMER_COPY } from "@/lib/content/editorial";

// CognitiveDisclaimer is now an async server component (Stage C i18n
// migration). Each test awaits the JSX result before rendering.
// `getTranslations` is stubbed globally in vitest.setup.ts so values
// resolve to the EN bundle, matching the editorial constants below.

describe("CognitiveDisclaimer", () => {
  it("renders the short copy by default", async () => {
    const tree = await CognitiveDisclaimer({});
    render(tree);
    expect(screen.getByText(COGNITIVE_DISCLAIMER_COPY.short)).toBeInTheDocument();
    expect(screen.queryByText(COGNITIVE_DISCLAIMER_COPY.full)).not.toBeInTheDocument();
  });

  it("renders the full copy when variant=full", async () => {
    const tree = await CognitiveDisclaimer({ variant: "full" });
    render(tree);
    expect(screen.getByText(COGNITIVE_DISCLAIMER_COPY.full)).toBeInTheDocument();
    expect(screen.queryByText(COGNITIVE_DISCLAIMER_COPY.short)).not.toBeInTheDocument();
  });

  it("renders the short copy when variant=short is explicit", async () => {
    const tree = await CognitiveDisclaimer({ variant: "short" });
    render(tree);
    expect(screen.getByText(COGNITIVE_DISCLAIMER_COPY.short)).toBeInTheDocument();
  });

  it("exposes a screen-reader friendly note role and label", async () => {
    const tree = await CognitiveDisclaimer({ variant: "short" });
    render(tree);
    const node = screen.getByRole("note", { name: /cognitive disclaimer/i });
    expect(node).toBeInTheDocument();
  });

  it("never weakens the disclaimer — the 'does not replace' framing is required in both variants", () => {
    expect(COGNITIVE_DISCLAIMER_COPY.short).toMatch(/does not replace/i);
    expect(COGNITIVE_DISCLAIMER_COPY.full).toMatch(/does not replace/i);
  });

  it("merges the optional className alongside the base classes", async () => {
    const tree = await CognitiveDisclaimer({ className: "footer-test-class" });
    render(tree);
    const node = screen.getByRole("note");
    expect(node.className).toMatch(/footer-test-class/);
    expect(node.className).toMatch(/text-center/);
  });
});
