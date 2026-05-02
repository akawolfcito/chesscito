import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ContextualHeader,
  type ContextualHeaderProps,
} from "../contextual-header";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

function getHeader(): HTMLElement {
  return screen.getByRole("banner");
}

function silenceWarn() {
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant: "title"
// ─────────────────────────────────────────────────────────────────────────────

describe("<ContextualHeader> variant: title", () => {
  it("renders the title and tags the wrapper for runtime auditing", () => {
    render(<ContextualHeader variant="title" title="About" />);
    const header = getHeader();
    expect(header).toHaveAttribute("data-component", "contextual-header");
    expect(header).toHaveAttribute("data-variant", "title");
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
  });

  it("derives an aria-label from the title when not supplied", () => {
    render(<ContextualHeader variant="title" title="About" />);
    expect(getHeader()).toHaveAttribute("aria-label", "About header");
  });

  it("respects an explicit ariaLabel", () => {
    render(
      <ContextualHeader variant="title" title="About" ariaLabel="Marketing" />,
    );
    expect(getHeader()).toHaveAttribute("aria-label", "Marketing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant: "title-control"
// ─────────────────────────────────────────────────────────────────────────────

describe("<ContextualHeader> variant: title-control", () => {
  function Trigger({ onClick }: { onClick: () => void }) {
    return (
      <button type="button" onClick={onClick} aria-label="Open picker">
        ▾
      </button>
    );
  }

  it("renders title, optional subtitle, and the trailing trigger", () => {
    const onClick = vi.fn();
    render(
      <ContextualHeader
        variant="title-control"
        title="Rook"
        subtitle="Move to h1"
        trailingControl={<Trigger onClick={onClick} />}
      />,
    );

    expect(screen.getByRole("heading", { name: "Rook" })).toBeInTheDocument();
    expect(screen.getByText("Move to h1")).toBeInTheDocument();
    expect(getHeader()).toHaveAttribute("data-variant", "title-control");
    const trigger = screen.getByRole("button", { name: "Open picker" });
    fireEvent.click(trigger);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("omits subtitle when not provided", () => {
    render(
      <ContextualHeader
        variant="title-control"
        title="Trophies"
        trailingControl={<Trigger onClick={() => undefined} />}
      />,
    );
    // Subtitle paragraph should not exist; only the heading does.
    expect(screen.queryByText("Move to h1")).not.toBeInTheDocument();
  });

  it("warns when title exceeds the 22-char visual cap", () => {
    const warn = silenceWarn();
    render(
      <ContextualHeader
        variant="title-control"
        title="A very long mission title overflowing"
        trailingControl={<Trigger onClick={() => undefined} />}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("title is 37 chars (cap 22)"),
    );
    warn.mockRestore();
  });

  it("warns when subtitle exceeds the 32-char visual cap", () => {
    const warn = silenceWarn();
    render(
      <ContextualHeader
        variant="title-control"
        title="Rook"
        subtitle="An overlong objective string that surely overflows"
        trailingControl={<Trigger onClick={() => undefined} />}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("subtitle is 50 chars (cap 32)"),
    );
    warn.mockRestore();
  });

  it("warns when trailingControl is a multi-child fragment", () => {
    const warn = silenceWarn();
    render(
      <ContextualHeader
        variant="title-control"
        title="Rook"
        trailingControl={
          <>
            <span>A</span>
            <span>B</span>
          </>
        }
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "trailingControl received a fragment with 2 children",
      ),
    );
    warn.mockRestore();
  });

  it("does NOT warn for a single-element fragment", () => {
    const warn = silenceWarn();
    render(
      <ContextualHeader
        variant="title-control"
        title="Rook"
        trailingControl={
          <>
            <span>only-child</span>
          </>
        }
      />,
    );
    const fragmentWarning = warn.mock.calls.find((call) =>
      String(call[0]).includes("fragment with"),
    );
    expect(fragmentWarning).toBeUndefined();
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant: "mode-tabs"
// ─────────────────────────────────────────────────────────────────────────────

describe("<ContextualHeader> variant: mode-tabs", () => {
  it("renders 1 tab", () => {
    render(
      <ContextualHeader
        variant="mode-tabs"
        modeTabs={{
          activeKey: "all",
          options: [{ key: "all", label: "All" }],
          onChange: () => undefined,
        }}
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("renders all 4 tabs and marks the active one", () => {
    render(
      <ContextualHeader
        variant="mode-tabs"
        modeTabs={{
          activeKey: "recent",
          options: [
            { key: "recent", label: "Recent" },
            { key: "all", label: "All" },
            { key: "locked", label: "Locked" },
            { key: "soon", label: "Soon" },
          ],
          onChange: () => undefined,
        }}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    const recent = screen.getByRole("tab", { name: "Recent" });
    expect(recent).toHaveAttribute("aria-selected", "true");
    const all = screen.getByRole("tab", { name: "All" });
    expect(all).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange with the tab key when clicked", () => {
    const onChange = vi.fn();
    render(
      <ContextualHeader
        variant="mode-tabs"
        modeTabs={{
          activeKey: "recent",
          options: [
            { key: "recent", label: "Recent" },
            { key: "all", label: "All" },
          ],
          onChange,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("warns on a tab label longer than 16 chars", () => {
    const warn = silenceWarn();
    render(
      <ContextualHeader
        variant="mode-tabs"
        modeTabs={{
          activeKey: "x",
          options: [{ key: "x", label: "An overlong tab label" }],
          onChange: () => undefined,
        }}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('tab label "An overlong tab label"'),
    );
    warn.mockRestore();
  });

  it("warns on duplicate tab keys (last-wins documented)", () => {
    const warn = silenceWarn();
    render(
      <ContextualHeader
        variant="mode-tabs"
        modeTabs={{
          activeKey: "x",
          options: [
            { key: "x", label: "First" },
            { key: "x", label: "Second" },
          ],
          onChange: () => undefined,
        }}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('duplicate tab key "x"'),
    );
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant: "back-control"
// ─────────────────────────────────────────────────────────────────────────────

describe("<ContextualHeader> variant: back-control", () => {
  it("renders the back button with a 44×44 hit area and the title", () => {
    render(
      <ContextualHeader
        variant="back-control"
        title="Game Review"
        back={{ onClick: () => undefined, label: "Back" }}
      />,
    );
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toBeInTheDocument();
    expect(back.className).toMatch(/h-11/);
    expect(back.className).toMatch(/w-11/);
    expect(
      screen.getByRole("heading", { name: "Game Review" }),
    ).toBeInTheDocument();
  });

  it("calls back.onClick when the back button is tapped", () => {
    const onClick = vi.fn();
    render(
      <ContextualHeader
        variant="back-control"
        title="Game Review"
        back={{ onClick, label: "Back" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders an optional trailing control when present", () => {
    render(
      <ContextualHeader
        variant="back-control"
        title="Game Review"
        back={{ onClick: () => undefined, label: "Back" }}
        trailingControl={<button type="button">Share</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Share" }),
    ).toBeInTheDocument();
  });

  it("warns when back.label exceeds the 16-char cap", () => {
    const warn = silenceWarn();
    render(
      <ContextualHeader
        variant="back-control"
        title="Game Review"
        back={{ onClick: () => undefined, label: "Back to mission detail" }}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("back.label is 22 chars (cap 16)"),
    );
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Compile-time contracts (documented as commented-out fixtures).
// These would be type errors if uncommented. Until the project adopts `tsd` /
// `expect-type`, this serves as the canonical reference for what the
// discriminated union forbids.
// ─────────────────────────────────────────────────────────────────────────────

describe("compile-time contracts (documented)", () => {
  it("documents what the type system rejects (no runtime assertion)", () => {
    // The following are TYPE ERRORS — uncomment to verify in editor:
    //
    // const a: ContextualHeaderProps = {
    //   variant: "title",
    //   title: "X",
    //   back: { onClick: () => undefined, label: "Back" }, // ← TS2353
    // };
    //
    // const b: ContextualHeaderProps = {
    //   variant: "title-control",
    //   title: "X",
    //   trailingControl: [<span key="a" />, <span key="b" />], // ← TS2322
    // };
    //
    // const c: ContextualHeaderProps = {
    //   variant: "mode-tabs",
    //   modeTabs: {
    //     activeKey: "x",
    //     options: [
    //       { key: "1", label: "1" },
    //       { key: "2", label: "2" },
    //       { key: "3", label: "3" },
    //       { key: "4", label: "4" },
    //       { key: "5", label: "5" }, // ← TS2322 (tuple cap of 4)
    //     ],
    //     onChange: () => undefined,
    //   },
    // };
    //
    // const d: ContextualHeaderProps = {
    //   variant: "title", // ← missing `title` field is TS2741
    // };

    // Sanity assertion so the suite isn't empty.
    expect(true).toBe(true);
  });

  it("documents what passes the type check but is caught at runtime", () => {
    // Multi-child fragments compile (a fragment is a single ReactElement),
    // but trigger a dev-mode console.warn at render. See the "warns when
    // trailingControl is a multi-child fragment" test above.
    //
    // Wide trigger elements (>44px) compile, but trigger a warn after
    // layout measurement — not asserted here because jsdom does not
    // compute layout.
    expect(true).toBe(true);
  });
});
