import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";

import { WoodBanner } from "../wood-banner";

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-component="wood-banner"]');
  if (!root) throw new Error("WoodBanner root not found");
  return root as HTMLElement;
}

describe("WoodBanner — markup contract", () => {
  it("default renders <div data-component='wood-banner'> with role='presentation'", () => {
    const { container } = render(
      <WoodBanner size="short">Daily tactic</WoodBanner>,
    );
    const root = getRoot(container);
    expect(root.tagName).toBe("DIV");
    expect(root.getAttribute("role")).toBe("presentation");
  });

  it("asTitle=true renders <h2 data-component='wood-banner'> (no role)", () => {
    const { container } = render(
      <WoodBanner size="medium" asTitle>
        Lessons
      </WoodBanner>,
    );
    const root = getRoot(container);
    expect(root.tagName).toBe("H2");
    expect(root.getAttribute("role")).toBeNull();
  });

  it.each(["short", "medium", "large"] as const)(
    "size='%s' → data-size + .wood-banner-%s class",
    (size) => {
      const { container } = render(
        <WoodBanner size={size}>x</WoodBanner>,
      );
      const root = getRoot(container);
      expect(root.getAttribute("data-size")).toBe(size);
      expect(root.classList.contains(`wood-banner-${size}`)).toBe(true);
    },
  );

  it("children renders inside .wood-banner-label", () => {
    const { container } = render(<WoodBanner size="short">Hello</WoodBanner>);
    expect(
      getRoot(container).querySelector(".wood-banner-label")?.textContent,
    ).toBe("Hello");
  });

  it("accessory renders inside .wood-banner-accessory when provided", () => {
    const { container } = render(
      <WoodBanner
        size="short"
        accessory={<span data-testid="acc">★</span>}
      >
        Hi
      </WoodBanner>,
    );
    const slot = getRoot(container).querySelector(".wood-banner-accessory");
    expect(slot?.querySelector("[data-testid='acc']")?.textContent).toBe("★");
  });

  it("accessory omitted → no .wood-banner-accessory wrapper", () => {
    const { container } = render(<WoodBanner size="short">Hi</WoodBanner>);
    expect(
      getRoot(container).querySelector(".wood-banner-accessory"),
    ).toBeNull();
  });
});

describe("WoodBanner — overflow warning (Behavior #4 / Acceptance)", () => {
  const widthDescriptors: Array<[string, PropertyDescriptor | undefined]> = [];

  function mockLabelWidth(scroll: number, client: number) {
    widthDescriptors.push([
      "scrollWidth",
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth"),
    ]);
    widthDescriptors.push([
      "clientWidth",
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
    ]);
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        return scroll;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return client;
      },
    });
  }

  afterEach(() => {
    while (widthDescriptors.length) {
      const [key, desc] = widthDescriptors.pop()!;
      if (desc) {
        Object.defineProperty(HTMLElement.prototype, key, desc);
      } else {
        // @ts-expect-error – best-effort restore
        delete HTMLElement.prototype[key];
      }
    }
  });

  it("scrollWidth/clientWidth ratio > 1.25 → console.warn fires", () => {
    mockLabelWidth(150, 100); // 50% over
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<WoodBanner size="short">overflowing copy</WoodBanner>);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/WoodBanner/);
    warnSpy.mockRestore();
  });

  it("ratio ≤ 1.25 → no warning", () => {
    mockLabelWidth(110, 100); // 10% over
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<WoodBanner size="short">fits fine</WoodBanner>);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("clientWidth is 0 (unmeasured) → no warning (avoid spurious noise)", () => {
    mockLabelWidth(0, 0);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<WoodBanner size="short">x</WoodBanner>);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("WoodBanner — placeholder fallback (Behavior #9)", () => {
  it("when computed background-image resolves to empty/none, root carries .is-placeholder", () => {
    const { container } = render(<WoodBanner size="short">x</WoodBanner>);
    expect(getRoot(container).classList.contains("is-placeholder")).toBe(true);
  });
});

describe("WoodBanner — globals.css contract", () => {
  it("globals.css declares --wood-banner-bg-{short,medium,large} vars", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    for (const variant of ["short", "medium", "large"]) {
      expect(css).toMatch(
        new RegExp(`--wood-banner-bg-${variant}\\s*:\\s*var\\(--theme-scene-banner-${variant}\\)`),
      );
    }
  });
});
