import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

import Template from "../template";

vi.mock("@/components/dev/build-version-gate", () => ({
  BuildVersionGate: () => null,
}));

describe("LocaleTemplate", () => {
  it("fades in from a non-zero opacity so first paint emits LCP candidates", () => {
    // Perf 2026-06-12: `fade-in` starts the enter animation at opacity 0
    // (fill-mode: both). Paints inside that window are not LCP-eligible,
    // and the later opacity ramp is compositor-only — no new candidates
    // get emitted. With fast-enough assets the page produced NO_LCP
    // (Lighthouse Score 0) intermittently on prod. `fade-in-5` starts at
    // opacity 0.05: visually identical, but first paint is contentful.
    const { container } = render(
      <Template>
        <p>content</p>
      </Template>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const classes = wrapper.className.split(/\s+/);
    expect(classes).toContain("animate-in");
    expect(classes).toContain("fade-in-5");
    expect(classes).not.toContain("fade-in");
  });
});
