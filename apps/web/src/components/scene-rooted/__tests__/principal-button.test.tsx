import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { PrincipalButton } from "../principal-button";

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-component="principal-button"]');
  if (!root) throw new Error("PrincipalButton root not found");
  return root as HTMLElement;
}

describe("PrincipalButton — markup contract", () => {
  it("renders <button data-component='principal-button'> with children inside .principal-button-label", () => {
    const { container } = render(
      <PrincipalButton onClick={() => {}}>Play</PrincipalButton>,
    );
    const root = getRoot(container);
    expect(root.tagName).toBe("BUTTON");
    expect(
      root.querySelector(".principal-button-label")?.textContent,
    ).toBe("Play");
  });

  it("default size is 'medium' → data-size + .principal-button-medium class", () => {
    const { container } = render(
      <PrincipalButton onClick={() => {}}>Play</PrincipalButton>,
    );
    const root = getRoot(container);
    expect(root.getAttribute("data-size")).toBe("medium");
    expect(root.classList.contains("principal-button-medium")).toBe(true);
  });

  it.each(["medium", "large"] as const)(
    "size='%s' → data-size + size class",
    (size) => {
      const { container } = render(
        <PrincipalButton size={size} onClick={() => {}}>
          x
        </PrincipalButton>,
      );
      const root = getRoot(container);
      expect(root.getAttribute("data-size")).toBe(size);
      expect(root.classList.contains(`principal-button-${size}`)).toBe(true);
    },
  );

  it("leadingIcon renders inside .principal-button-leading-icon when provided", () => {
    const { container } = render(
      <PrincipalButton
        onClick={() => {}}
        leadingIcon={<span data-testid="ico">▶</span>}
      >
        Play
      </PrincipalButton>,
    );
    const slot = getRoot(container).querySelector(
      ".principal-button-leading-icon",
    );
    expect(slot?.querySelector("[data-testid='ico']")?.textContent).toBe("▶");
  });

  it("leadingIcon omitted → no .principal-button-leading-icon wrapper", () => {
    const { container } = render(
      <PrincipalButton onClick={() => {}}>Play</PrincipalButton>,
    );
    expect(
      getRoot(container).querySelector(".principal-button-leading-icon"),
    ).toBeNull();
  });

  it("aria-label not provided + textual children → button has no explicit aria-label (label derived from text node)", () => {
    const { container } = render(
      <PrincipalButton onClick={() => {}}>Play</PrincipalButton>,
    );
    const root = getRoot(container);
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.textContent).toContain("Play");
  });

  it("aria-label explicit overrides → button.aria-label set", () => {
    const { container } = render(
      <PrincipalButton onClick={() => {}} aria-label="Continue play">
        ▶
      </PrincipalButton>,
    );
    expect(getRoot(container).getAttribute("aria-label")).toBe("Continue play");
  });
});

describe("PrincipalButton — interaction (loading / disabled)", () => {
  it("onClick fires when pressed in default state", () => {
    const onClick = vi.fn();
    const { container } = render(
      <PrincipalButton onClick={onClick}>Play</PrincipalButton>,
    );
    fireEvent.click(getRoot(container));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled → <button disabled>, stays a <button>, click suppressed", () => {
    const onClick = vi.fn();
    const { container } = render(
      <PrincipalButton disabled onClick={onClick}>
        Play
      </PrincipalButton>,
    );
    const root = getRoot(container) as HTMLButtonElement;
    expect(root.tagName).toBe("BUTTON");
    expect(root.disabled).toBe(true);
    expect(root.getAttribute("data-state")).toBe("disabled");
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading=true renders spinner + suppresses onClick", () => {
    const onClick = vi.fn();
    const { container } = render(
      <PrincipalButton loading onClick={onClick}>
        Play
      </PrincipalButton>,
    );
    const root = getRoot(container);
    expect(root.querySelector(".principal-button-spinner")).not.toBeNull();
    expect(root.getAttribute("data-state")).toBe("loading");
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading=true AND disabled=true → loading visual wins", () => {
    const { container } = render(
      <PrincipalButton loading disabled onClick={() => {}}>
        Play
      </PrincipalButton>,
    );
    const root = getRoot(container);
    expect(root.querySelector(".principal-button-spinner")).not.toBeNull();
    expect(root.getAttribute("data-state")).toBe("loading");
    expect((root as HTMLButtonElement).disabled).toBe(true);
  });

  it("loading=false → no spinner element", () => {
    const { container } = render(
      <PrincipalButton onClick={() => {}}>Play</PrincipalButton>,
    );
    expect(
      getRoot(container).querySelector(".principal-button-spinner"),
    ).toBeNull();
  });
});

describe("PrincipalButton — placeholder fallback (Behavior #9)", () => {
  it("when computed background-image resolves to empty/none, root carries .is-placeholder", () => {
    const { container } = render(
      <PrincipalButton onClick={() => {}}>Play</PrincipalButton>,
    );
    expect(getRoot(container).classList.contains("is-placeholder")).toBe(true);
  });
});

describe("PrincipalButton — globals.css contract", () => {
  it("globals.css declares --principal-button-bg var", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/--principal-button-bg\s*:\s*url\(/);
  });

  it("globals.css defines press feedback rule for .principal-button:active", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\.principal-button:active(?::not\(:disabled\))?/);
  });

  it("globals.css defines a prefers-reduced-motion fallback for .principal-button", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,1200}\.principal-button/,
    );
  });
});
