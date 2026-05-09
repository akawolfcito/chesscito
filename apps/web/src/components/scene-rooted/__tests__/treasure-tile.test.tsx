import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { TreasureTile } from "../treasure-tile";

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-component="treasure-tile"]');
  if (!root) throw new Error("TreasureTile root not found");
  return root as HTMLElement;
}

describe("TreasureTile — markup contract", () => {
  it("renders <button data-component='treasure-tile'> with size + iconStack slot", () => {
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack={<span data-testid="stack">5🪙</span>}
        onClick={() => {}}
        aria-label="5-pack"
      />,
    );
    const root = getRoot(container);
    expect(root.tagName).toBe("BUTTON");
    expect(root.getAttribute("data-size")).toBe("small");
    expect(
      root.querySelector(".treasure-tile-icon-stack [data-testid='stack']")
        ?.textContent,
    ).toBe("5🪙");
  });

  it.each(["small", "large"] as const)(
    "size='%s' → data-size + .treasure-tile-%s class",
    (size) => {
      const { container } = render(
        <TreasureTile
          size={size}
          iconStack="x"
          onClick={() => {}}
          aria-label="x"
        />,
      );
      const root = getRoot(container);
      expect(root.getAttribute("data-size")).toBe(size);
      expect(root.classList.contains(`treasure-tile-${size}`)).toBe(true);
    },
  );

  it("valueChip renders inside .treasure-tile-value-chip when provided", () => {
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack="x"
        valueChip={<span data-testid="vc">$0.05</span>}
        onClick={() => {}}
        aria-label="x"
      />,
    );
    const slot = getRoot(container).querySelector(".treasure-tile-value-chip");
    expect(slot?.querySelector("[data-testid='vc']")?.textContent).toBe(
      "$0.05",
    );
  });

  it("valueChip omitted → no .treasure-tile-value-chip wrapper", () => {
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack="x"
        onClick={() => {}}
        aria-label="x"
      />,
    );
    expect(
      getRoot(container).querySelector(".treasure-tile-value-chip"),
    ).toBeNull();
  });

  it.each(["BEST", "NEW", "SALE", "EARNED"] as const)(
    "ribbon='%s' renders .treasure-tile-ribbon[data-ribbon='%s'] with text",
    (ribbon) => {
      const { container } = render(
        <TreasureTile
          size="large"
          iconStack="x"
          ribbon={ribbon}
          onClick={() => {}}
          aria-label="x"
        />,
      );
      const sticker = getRoot(container).querySelector(
        ".treasure-tile-ribbon",
      ) as HTMLElement | null;
      expect(sticker).not.toBeNull();
      expect(sticker?.getAttribute("data-ribbon")).toBe(ribbon);
      expect(sticker?.textContent).toBe(ribbon);
    },
  );

  it("ribbon omitted → no .treasure-tile-ribbon element", () => {
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack="x"
        onClick={() => {}}
        aria-label="x"
      />,
    );
    expect(
      getRoot(container).querySelector(".treasure-tile-ribbon"),
    ).toBeNull();
  });

  it("aria-label propagates to <button>", () => {
    const { container } = render(
      <TreasureTile
        size="large"
        iconStack="x"
        onClick={() => {}}
        aria-label="20-pack treasure"
      />,
    );
    expect(getRoot(container).getAttribute("aria-label")).toBe(
      "20-pack treasure",
    );
  });
});

describe("TreasureTile — interaction (loading / disabled)", () => {
  it("onClick fires when pressed in default state", () => {
    const onClick = vi.fn();
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack="x"
        onClick={onClick}
        aria-label="x"
      />,
    );
    fireEvent.click(getRoot(container));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled → <button disabled>, click suppressed, stays a <button>", () => {
    const onClick = vi.fn();
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack="x"
        disabled
        onClick={onClick}
        aria-label="x"
      />,
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
      <TreasureTile
        size="small"
        iconStack="x"
        loading
        onClick={onClick}
        aria-label="x"
      />,
    );
    const root = getRoot(container);
    expect(root.querySelector(".treasure-tile-spinner")).not.toBeNull();
    expect(root.getAttribute("data-state")).toBe("loading");
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading=true AND disabled=true → loading visual wins (spinner shown, data-state='loading')", () => {
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack="x"
        loading
        disabled
        onClick={() => {}}
        aria-label="x"
      />,
    );
    const root = getRoot(container);
    expect(root.querySelector(".treasure-tile-spinner")).not.toBeNull();
    expect(root.getAttribute("data-state")).toBe("loading");
    expect((root as HTMLButtonElement).disabled).toBe(true);
  });

  it("loading=true with no iconStack-content reactnode still renders without error", () => {
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack={null}
        loading
        onClick={() => {}}
        aria-label="x"
      />,
    );
    expect(getRoot(container)).not.toBeNull();
  });
});

describe("TreasureTile — placeholder fallback (Behavior #9)", () => {
  it("when computed background-image resolves to empty/none, root carries .is-placeholder", () => {
    const { container } = render(
      <TreasureTile
        size="small"
        iconStack="x"
        onClick={() => {}}
        aria-label="x"
      />,
    );
    expect(getRoot(container).classList.contains("is-placeholder")).toBe(true);
  });
});

describe("TreasureTile — globals.css contract", () => {
  it("globals.css declares --treasure-chest-bg-small + --treasure-chest-bg-large vars", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/--treasure-chest-bg-small\s*:\s*url\(/);
    expect(css).toMatch(/--treasure-chest-bg-large\s*:\s*url\(/);
  });

  it("globals.css defines press feedback rule for .treasure-tile:active", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\.treasure-tile:active(?::not\(:disabled\))?/);
  });

  it("globals.css defines a prefers-reduced-motion fallback for .treasure-tile", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,800}\.treasure-tile/,
    );
  });

  it("globals.css defines the EARNED ribbon variant (sprint 3 / G3)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve(__dirname, "../../../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(
      /\.treasure-tile-ribbon\[data-ribbon="EARNED"\][\s\S]{0,200}background:/,
    );
  });
});
