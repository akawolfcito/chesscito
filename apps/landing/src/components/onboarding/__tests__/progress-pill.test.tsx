import { describe, expect, it } from "vitest";
import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { ProgressPill } from "@/components/onboarding/progress-pill";

describe("ProgressPill", () => {
  it("reads the count from the copy bundle, not a hardcoded separator", () => {
    renderWithIntl(<ProgressPill current={1} total={4} />);
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  // The old component hardcoded "{current} / {total}" and ignored the
  // translated key that already existed beside it, so the counter was the one
  // string on the screen that could never speak Spanish.
  it("translates", () => {
    renderWithIntl(<ProgressPill current={3} total={4} />, { locale: "es" });
    expect(screen.getByText("3 de 4")).toBeInTheDocument();
  });

  // Founder call, 2026-07-29: the counter is a reading, not a reward. The star
  // is the currency the game pays out for exercises, and spending it here on
  // "which slide am I on" cheapens it wherever it means something.
  it("carries no star", () => {
    const { container } = renderWithIntl(<ProgressPill current={1} total={4} />);
    expect(container.querySelector("img")).toBeNull();
  });
});
