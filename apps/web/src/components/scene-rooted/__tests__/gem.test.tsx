import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { GemBadge, GemButton } from "../gem";

function getRootByComponent(
  container: HTMLElement,
  component: string,
): HTMLElement {
  const root = container.querySelector(`[data-component="${component}"]`);
  if (!root) throw new Error(`${component} root not found`);
  return root as HTMLElement;
}

describe("GemBadge — markup contract (presentational sibling)", () => {
  it("renders <span data-component='gem-badge'> with icon + value slots", () => {
    const { container } = render(
      <GemBadge
        icon={<span data-testid="i">💎</span>}
        value={<span data-testid="v">12</span>}
      />,
    );
    const root = getRootByComponent(container, "gem-badge");
    expect(root.tagName).toBe("SPAN");
    expect(
      root.querySelector(".gem-badge-icon [data-testid='i']")?.textContent,
    ).toBe("💎");
    expect(
      root.querySelector(".gem-badge-value [data-testid='v']")?.textContent,
    ).toBe("12");
  });

  it("is not pressable — no <button> wrapper, no onClick handler attribute, no role='button'", () => {
    const { container } = render(<GemBadge icon="x" value="1" />);
    const root = getRootByComponent(container, "gem-badge");
    expect(root.querySelector("button")).toBeNull();
    expect(root.getAttribute("role")).not.toBe("button");
  });

  it("placeholder fallback applies when CSS var resolves to empty/none", () => {
    const { container } = render(<GemBadge icon="x" value="1" />);
    expect(
      getRootByComponent(container, "gem-badge").classList.contains(
        "is-placeholder",
      ),
    ).toBe(true);
  });
});

describe("GemButton — markup contract (pressable sibling)", () => {
  it("renders <button data-component='gem-button'> with icon + value slots", () => {
    const { container } = render(
      <GemButton
        icon={<span data-testid="i">💎</span>}
        value={<span data-testid="v">+</span>}
        onClick={() => {}}
        aria-label="Buy gems"
      />,
    );
    const root = getRootByComponent(container, "gem-button");
    expect(root.tagName).toBe("BUTTON");
    expect(
      root.querySelector(".gem-button-icon [data-testid='i']")?.textContent,
    ).toBe("💎");
    expect(
      root.querySelector(".gem-button-value [data-testid='v']")?.textContent,
    ).toBe("+");
  });

  it("aria-label propagates", () => {
    const { container } = render(
      <GemButton icon="x" value="1" onClick={() => {}} aria-label="Wallet" />,
    );
    expect(
      getRootByComponent(container, "gem-button").getAttribute("aria-label"),
    ).toBe("Wallet");
  });

  it("onClick fires when pressed in default state", () => {
    const onClick = vi.fn();
    const { container } = render(
      <GemButton icon="x" value="1" onClick={onClick} aria-label="x" />,
    );
    fireEvent.click(getRootByComponent(container, "gem-button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled → <button disabled>, stays a <button>, click suppressed, data-state='disabled'", () => {
    const onClick = vi.fn();
    const { container } = render(
      <GemButton
        icon="x"
        value="1"
        disabled
        onClick={onClick}
        aria-label="x"
      />,
    );
    const root = getRootByComponent(container, "gem-button") as HTMLButtonElement;
    expect(root.tagName).toBe("BUTTON");
    expect(root.disabled).toBe(true);
    expect(root.getAttribute("data-state")).toBe("disabled");
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("placeholder fallback applies when CSS var resolves to empty/none", () => {
    const { container } = render(
      <GemButton icon="x" value="1" onClick={() => {}} aria-label="x" />,
    );
    expect(
      getRootByComponent(container, "gem-button").classList.contains(
        "is-placeholder",
      ),
    ).toBe(true);
  });
});

describe("Gem (Badge + Button) — globals.css contract", () => {
  it("globals.css declares --gem-pill-bg var", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/--gem-pill-bg\s*:\s*url\(/);
  });

  it("globals.css defines press feedback rule for .gem-button:active", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\.gem-button:active(?::not\(:disabled\))?/);
  });

  it("globals.css defines a prefers-reduced-motion fallback for .gem-button", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,2000}\.gem-button/,
    );
  });
});
