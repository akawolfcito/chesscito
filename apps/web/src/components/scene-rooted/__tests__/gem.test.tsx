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

describe("Gem (Badge + Button) — app CSS contract", () => {
  // Gem rules live in the arena surface stylesheet since the P4 CSS
  // split (2026-06-12); the contract is "shipped in the app CSS", so
  // scan globals + every split surface file.
  const readAppCss = async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const stylesDir = path.resolve(__dirname, "../../../styles");
    const surfaces = fs
      .readdirSync(stylesDir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => fs.readFileSync(path.join(stylesDir, f), "utf8"));
    return [
      fs.readFileSync(
        path.resolve(__dirname, "../../../app/globals.css"),
        "utf8",
      ),
      ...surfaces,
    ].join("\n");
  };

  it("app CSS declares --gem-pill-bg var", async () => {
    const css = await readAppCss();
    expect(css).toMatch(/--gem-pill-bg\s*:\s*url\(/);
  });

  it("app CSS defines press feedback rule for .gem-button:active", async () => {
    const css = await readAppCss();
    expect(css).toMatch(/\.gem-button:active(?::not\(:disabled\))?/);
  });

  it("app CSS defines a prefers-reduced-motion fallback for .gem-button", async () => {
    const css = await readAppCss();
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,2000}\.gem-button/,
    );
  });
});

describe("Gem — tone prop (sprint 2 / G2)", () => {
  it("GemBadge defaults tone to 'default' when omitted", () => {
    const { container } = render(<GemBadge icon="x" value="1" />);
    const root = getRootByComponent(container, "gem-badge");
    expect(root.getAttribute("data-tone")).toBe("default");
  });

  it.each(["default", "success", "warning", "locked"] as const)(
    "GemBadge applies data-tone='%s' when tone='%s'",
    (tone) => {
      const { container } = render(
        <GemBadge icon="x" value="1" tone={tone} />,
      );
      const root = getRootByComponent(container, "gem-badge");
      expect(root.getAttribute("data-tone")).toBe(tone);
    },
  );

  it("GemButton defaults tone to 'default' when omitted", () => {
    const { container } = render(
      <GemButton icon="x" value="1" onClick={() => {}} aria-label="x" />,
    );
    const root = getRootByComponent(container, "gem-button");
    expect(root.getAttribute("data-tone")).toBe("default");
  });

  it.each(["default", "success", "warning", "locked"] as const)(
    "GemButton applies data-tone='%s' when tone='%s'",
    (tone) => {
      const { container } = render(
        <GemButton
          icon="x"
          value="1"
          tone={tone}
          onClick={() => {}}
          aria-label="x"
        />,
      );
      const root = getRootByComponent(container, "gem-button");
      expect(root.getAttribute("data-tone")).toBe(tone);
    },
  );

  it("app CSS defines tone filter rules for success / warning / locked", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    // Tone rules moved to the arena surface stylesheet (P4 CSS split).
    const cssPath = path.resolve(__dirname, "../../../styles/arena.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\[data-tone="success"\][\s\S]{0,200}filter:/);
    expect(css).toMatch(/\[data-tone="warning"\][\s\S]{0,200}filter:/);
    expect(css).toMatch(/\[data-tone="locked"\][\s\S]{0,200}filter:/);
  });
});
