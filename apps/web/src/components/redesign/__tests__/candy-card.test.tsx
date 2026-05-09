import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { CandyCard } from "../candy-card";

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-component="candy-card"]');
  if (!root) throw new Error("CandyCard root not found");
  return root as HTMLElement;
}

describe("CandyCard — markup contract (T1–T20, AC1–AC9, AC11–AC12)", () => {
  it("T1: smoke — title + body renders <section data-component='candy-card'> + h3 title + body", () => {
    const { container } = render(<CandyCard title="Hello">body content</CandyCard>);
    const root = getRoot(container);
    expect(root.tagName).toBe("SECTION");
    expect(root.querySelector("h3.candy-card-title")?.textContent).toBe("Hello");
    expect(root.querySelector(".candy-card-body")?.textContent).toBe("body content");
  });

  it("T2: default size attr is 'regular' when prop omitted", () => {
    const { container } = render(<CandyCard title="x">body</CandyCard>);
    expect(getRoot(container).getAttribute("data-size")).toBe("regular");
  });

  it("T3: size='compact' → data-size='compact' + .candy-card-compact class", () => {
    const { container } = render(
      <CandyCard size="compact" title="x">body</CandyCard>,
    );
    const root = getRoot(container);
    expect(root.getAttribute("data-size")).toBe("compact");
    expect(root.classList.contains("candy-card-compact")).toBe(true);
  });

  it("T4: size='feature' → data-size='feature' + .candy-card-feature class", () => {
    const { container } = render(
      <CandyCard size="feature" title="x">body</CandyCard>,
    );
    const root = getRoot(container);
    expect(root.getAttribute("data-size")).toBe("feature");
    expect(root.classList.contains("candy-card-feature")).toBe(true);
  });

  it("T5: default atmosphere attr is 'hub' when prop omitted", () => {
    const { container } = render(<CandyCard title="x">body</CandyCard>);
    expect(getRoot(container).getAttribute("data-atmosphere")).toBe("hub");
  });

  it("T6: eyebrow renders inside .candy-card-eyebrow", () => {
    const { container } = render(
      <CandyCard eyebrow="Category" title="x">body</CandyCard>,
    );
    expect(
      getRoot(container).querySelector(".candy-card-eyebrow")?.textContent,
    ).toBe("Category");
  });

  it("T7: media renders inside .candy-card-media", () => {
    const { container } = render(
      <CandyCard media={<span data-testid="m">M</span>} title="x">body</CandyCard>,
    );
    const mediaSlot = getRoot(container).querySelector(".candy-card-media");
    expect(mediaSlot?.querySelector("[data-testid='m']")?.textContent).toBe("M");
  });

  it("T8: footer renders inside .candy-card-footer", () => {
    const { container } = render(
      <CandyCard title="x" footer={<button>Action</button>}>body</CandyCard>,
    );
    expect(
      getRoot(container).querySelector(".candy-card-footer button")?.textContent,
    ).toBe("Action");
  });

  it("T9: corner renders inside .candy-card-corner", () => {
    const { container } = render(
      <CandyCard title="x" corner={<span data-testid="pip">!</span>}>body</CandyCard>,
    );
    expect(
      getRoot(container)
        .querySelector(".candy-card-corner [data-testid='pip']")
        ?.textContent,
    ).toBe("!");
  });

  it("T10: omitted slots produce no empty wrappers (media/footer/corner absent)", () => {
    const { container } = render(<CandyCard title="x">body</CandyCard>);
    const root = getRoot(container);
    expect(root.querySelector(".candy-card-media")).toBeNull();
    expect(root.querySelector(".candy-card-footer")).toBeNull();
    expect(root.querySelector(".candy-card-corner")).toBeNull();
  });

  it("T11: header omitted entirely when both eyebrow + title nullish", () => {
    const { container } = render(<CandyCard>body</CandyCard>);
    expect(getRoot(container).querySelector(".candy-card-header")).toBeNull();
  });

  it("T12: className appends to outer without dropping canonical classes", () => {
    const { container } = render(
      <CandyCard title="x" className="my-extra">body</CandyCard>,
    );
    const root = getRoot(container);
    expect(root.classList.contains("candy-card")).toBe(true);
    expect(root.classList.contains("candy-card-regular")).toBe(true);
    expect(root.classList.contains("sheet-bg-hub")).toBe(true);
    expect(root.classList.contains("my-extra")).toBe(true);
  });

  it("T13: title provided → section.aria-labelledby points at TitleTag.id", () => {
    const { container } = render(<CandyCard title="Hello">body</CandyCard>);
    const root = getRoot(container);
    const titleEl = root.querySelector("h3.candy-card-title") as HTMLElement;
    expect(titleEl).not.toBeNull();
    expect(titleEl.id).toBeTruthy();
    expect(root.getAttribute("aria-labelledby")).toBe(titleEl.id);
    expect(root.getAttribute("aria-label")).toBeNull();
  });

  it("T14: no title + aria-label='Custom' → section.aria-label='Custom', no aria-labelledby", () => {
    const { container } = render(
      <CandyCard aria-label="Custom card">body</CandyCard>,
    );
    const root = getRoot(container);
    expect(root.getAttribute("aria-label")).toBe("Custom card");
    expect(root.getAttribute("aria-labelledby")).toBeNull();
  });

  it("T15: title + aria-label override → aria-labelledby wins, aria-label not set", () => {
    const { container } = render(
      <CandyCard title="Real Title" aria-label="Override">body</CandyCard>,
    );
    const root = getRoot(container);
    expect(root.getAttribute("aria-labelledby")).toBeTruthy();
    expect(root.getAttribute("aria-label")).toBeNull();
  });

  it("T16: titleAs='h2' renders title as <h2>", () => {
    const { container } = render(
      <CandyCard titleAs="h2" title="X">body</CandyCard>,
    );
    expect(getRoot(container).querySelector("h2.candy-card-title")).not.toBeNull();
    expect(getRoot(container).querySelector("h3.candy-card-title")).toBeNull();
  });

  it("T17: titleAs='h4' renders title as <h4>", () => {
    const { container } = render(
      <CandyCard titleAs="h4" title="X">body</CandyCard>,
    );
    expect(getRoot(container).querySelector("h4.candy-card-title")).not.toBeNull();
  });

  it("T18: titleAs omitted defaults to <h3>", () => {
    const { container } = render(<CandyCard title="X">body</CandyCard>);
    expect(getRoot(container).querySelector("h3.candy-card-title")).not.toBeNull();
  });

  it("T19: press-neutralizer CSS rule exists in globals.css (specification check, AC10)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\.candy-card\.candy-frame:active:not\(:disabled\)/);
  });

  it("T20: re-render with title toggling undefined → 'X' → undefined does not throw", () => {
    const { rerender } = render(<CandyCard>body</CandyCard>);
    rerender(<CandyCard title="X">body</CandyCard>);
    rerender(<CandyCard>body</CandyCard>);
    rerender(<CandyCard title="Y">body</CandyCard>);
  });
});

const SIZES = ["compact", "regular", "feature"] as const;
const ATMOSPHERES = ["hub", "amber", "gold"] as const;

describe.each(
  SIZES.flatMap((size) =>
    ATMOSPHERES.map((atmosphere) => [size, atmosphere] as const),
  ),
)("CandyCard variant — size=%s atmosphere=%s (T21–T29)", (size, atmosphere) => {
  it("renders the correct chassis (data-attrs + atmosphere classes)", () => {
    const { container } = render(
      <CandyCard size={size} atmosphere={atmosphere} title="Title">
        Body
      </CandyCard>,
    );
    const root = container.querySelector(
      '[data-component="candy-card"]',
    ) as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root!.getAttribute("data-size")).toBe(size);
    expect(root!.getAttribute("data-atmosphere")).toBe(atmosphere);
    expect(root!.classList.contains(`candy-card-${size}`)).toBe(true);
    if (atmosphere === "hub") {
      expect(root!.classList.contains("sheet-bg-hub")).toBe(true);
      expect(root!.classList.contains("candy-frame")).toBe(false);
    } else {
      expect(root!.classList.contains("candy-frame")).toBe(true);
      expect(root!.classList.contains(`candy-frame-${atmosphere}`)).toBe(true);
      expect(root!.classList.contains("sheet-bg-hub")).toBe(false);
    }
  });
});
