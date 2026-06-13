import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { StonePedestal } from "../stone-pedestal";

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-component="stone-pedestal"]');
  if (!root) throw new Error("StonePedestal root not found");
  return root as HTMLElement;
}

describe("StonePedestal — markup contract (AC1–AC5)", () => {
  it("renders <button data-component='stone-pedestal'> with provided icon child", () => {
    const { container } = render(
      <StonePedestal
        icon={<span data-testid="i">i</span>}
        onClick={() => {}}
        aria-label="Test"
      />,
    );
    const root = getRoot(container);
    expect(root.tagName).toBe("BUTTON");
    expect(root.querySelector("[data-testid='i']")?.textContent).toBe("i");
  });

  it("default stone is 2 → data-stone='2'", () => {
    const { container } = render(
      <StonePedestal icon="i" onClick={() => {}} aria-label="x" />,
    );
    expect(getRoot(container).getAttribute("data-stone")).toBe("2");
  });

  it("stone prop drives data-stone + .stone-pedestal-stone-N class", () => {
    const { container } = render(
      <StonePedestal icon="i" stone={7} onClick={() => {}} aria-label="x" />,
    );
    const root = getRoot(container);
    expect(root.getAttribute("data-stone")).toBe("7");
    expect(root.classList.contains("stone-pedestal-stone-7")).toBe(true);
  });

  it("default size is 'medium' → data-size='medium' + .stone-pedestal-medium class", () => {
    const { container } = render(
      <StonePedestal icon="i" onClick={() => {}} aria-label="x" />,
    );
    const root = getRoot(container);
    expect(root.getAttribute("data-size")).toBe("medium");
    expect(root.classList.contains("stone-pedestal-medium")).toBe(true);
  });

  it.each(["small", "medium", "large"] as const)(
    "size='%s' → data-size + size class",
    (size) => {
      const { container } = render(
        <StonePedestal icon="i" size={size} onClick={() => {}} aria-label="x" />,
      );
      const root = getRoot(container);
      expect(root.getAttribute("data-size")).toBe(size);
      expect(root.classList.contains(`stone-pedestal-${size}`)).toBe(true);
    },
  );

  it("aria-label propagates to <button>", () => {
    const { container } = render(
      <StonePedestal icon="i" onClick={() => {}} aria-label="Daily tactic" />,
    );
    expect(getRoot(container).getAttribute("aria-label")).toBe("Daily tactic");
  });

  it("icon slot renders inside .stone-pedestal-icon", () => {
    const { container } = render(
      <StonePedestal
        icon={<span data-testid="ic">ic</span>}
        onClick={() => {}}
        aria-label="x"
      />,
    );
    const slot = getRoot(container).querySelector(".stone-pedestal-icon");
    expect(slot?.querySelector("[data-testid='ic']")?.textContent).toBe("ic");
  });

  it("badge slot renders inside .stone-pedestal-badge when provided", () => {
    const { container } = render(
      <StonePedestal
        icon="i"
        badge={<span data-testid="b">3</span>}
        onClick={() => {}}
        aria-label="x"
      />,
    );
    const slot = getRoot(container).querySelector(".stone-pedestal-badge");
    expect(slot).not.toBeNull();
    expect(slot?.querySelector("[data-testid='b']")?.textContent).toBe("3");
  });

  it("badge slot omitted produces no .stone-pedestal-badge wrapper", () => {
    const { container } = render(
      <StonePedestal icon="i" onClick={() => {}} aria-label="x" />,
    );
    expect(getRoot(container).querySelector(".stone-pedestal-badge")).toBeNull();
  });
});

describe("StonePedestal — interaction (AC press / disabled / loading)", () => {
  it("onClick fires when pressed in default state", () => {
    const onClick = vi.fn();
    const { container } = render(
      <StonePedestal icon="i" onClick={onClick} aria-label="x" />,
    );
    fireEvent.click(getRoot(container));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled → <button disabled> AND onClick suppressed", () => {
    const onClick = vi.fn();
    const { container } = render(
      <StonePedestal icon="i" disabled onClick={onClick} aria-label="x" />,
    );
    const root = getRoot(container) as HTMLButtonElement;
    expect(root.disabled).toBe(true);
    expect(root.tagName).toBe("BUTTON");
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled state stays a <button>, NEVER polymorphic to div (a11y)", () => {
    const { container } = render(
      <StonePedestal icon="i" disabled onClick={() => {}} aria-label="x" />,
    );
    const root = getRoot(container);
    expect(root.tagName).toBe("BUTTON");
    expect(root.getAttribute("data-state")).toBe("disabled");
  });

  it("loading=true renders spinner element + suppresses onClick", () => {
    const onClick = vi.fn();
    const { container } = render(
      <StonePedestal icon="i" loading onClick={onClick} aria-label="x" />,
    );
    const root = getRoot(container);
    expect(root.querySelector(".stone-pedestal-spinner")).not.toBeNull();
    expect(root.getAttribute("data-state")).toBe("loading");
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading=true AND disabled=true → loading visual takes precedence (spinner shown, data-state='loading')", () => {
    const { container } = render(
      <StonePedestal icon="i" loading disabled onClick={() => {}} aria-label="x" />,
    );
    const root = getRoot(container);
    expect(root.querySelector(".stone-pedestal-spinner")).not.toBeNull();
    expect(root.getAttribute("data-state")).toBe("loading");
    expect((root as HTMLButtonElement).disabled).toBe(true);
  });

  it("loading=false → no spinner element rendered", () => {
    const { container } = render(
      <StonePedestal icon="i" onClick={() => {}} aria-label="x" />,
    );
    expect(
      getRoot(container).querySelector(".stone-pedestal-spinner"),
    ).toBeNull();
  });
});

describe("StonePedestal — placeholder fallback (spec Behavior #9)", () => {
  it("when computed background-image resolves to empty/none, root carries .is-placeholder", () => {
    // JSDOM does not load globals.css, so the CSS var resolves to nothing
    // and the component must self-report the placeholder state.
    const { container } = render(
      <StonePedestal icon="i" onClick={() => {}} aria-label="x" />,
    );
    expect(getRoot(container).classList.contains("is-placeholder")).toBe(true);
  });
});

describe("StonePedestal — globals.css contract (spec check)", () => {
  it("globals.css declares --stone-pedestal-bg-1..10 vars", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(
      __dirname,
      "../../../app/globals.css",
    );
    const css = fs.readFileSync(cssPath, "utf8");
    for (let n = 1; n <= 10; n += 1) {
      expect(css).toMatch(
        new RegExp(`--stone-pedestal-bg-${n}\\s*:\\s*url\\(`),
      );
    }
  });

  // Pedestal rules moved to the exercises surface stylesheet
  // (P4 CSS split, 2026-06-12).
  it("app CSS defines a press-feedback rule for .stone-pedestal:active", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(
      __dirname,
      "../../../styles/exercises.css",
    );
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\.stone-pedestal:active(?::not\(:disabled\))?/);
  });

  it("app CSS defines a prefers-reduced-motion fallback for .stone-pedestal", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(
      __dirname,
      "../../../styles/exercises.css",
    );
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,400}\.stone-pedestal/,
    );
  });
});
