import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalStatusBar } from "../global-status-bar";
import { GLOBAL_STATUS_BAR_COPY } from "@/lib/content/editorial";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getStatusBar(): HTMLElement {
  return screen.getByRole("banner");
}

function silenceWarn() {
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

const sampleWalletShort = "0x1234…abcd";

// ─────────────────────────────────────────────────────────────────────────────
// Variant: anonymous
// ─────────────────────────────────────────────────────────────────────────────

describe("<GlobalStatusBar> variant: anonymous", () => {
  it("tags the wrapper for runtime auditing (data-component + data-variant)", () => {
    render(<GlobalStatusBar variant="anonymous" />);
    const bar = getStatusBar();
    expect(bar).toHaveAttribute("data-component", "global-status-bar");
    expect(bar).toHaveAttribute("data-variant", "anonymous");
  });

  it("renders the Guest label from editorial copy", () => {
    render(<GlobalStatusBar variant="anonymous" />);
    expect(
      screen.getByText(GLOBAL_STATUS_BAR_COPY.guestLabel),
    ).toBeInTheDocument();
  });

  it("does NOT render any PRO indicator", () => {
    render(<GlobalStatusBar variant="anonymous" />);
    expect(
      screen.queryByLabelText(GLOBAL_STATUS_BAR_COPY.proManageLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(GLOBAL_STATUS_BAR_COPY.proViewLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(GLOBAL_STATUS_BAR_COPY.proLoadingAriaLabel),
    ).not.toBeInTheDocument();
  });

  it("derives the default aria-label for anonymous", () => {
    render(<GlobalStatusBar variant="anonymous" />);
    expect(getStatusBar()).toHaveAttribute(
      "aria-label",
      GLOBAL_STATUS_BAR_COPY.ariaLabelAnonymous,
    );
  });

  it("respects an explicit ariaLabel override", () => {
    render(<GlobalStatusBar variant="anonymous" ariaLabel="Custom" />);
    expect(getStatusBar()).toHaveAttribute("aria-label", "Custom");
  });

  it("forces dir=ltr on the wrapper (RTL deferred per §17 carry-forward)", () => {
    render(<GlobalStatusBar variant="anonymous" />);
    expect(getStatusBar()).toHaveAttribute("dir", "ltr");
  });

  it("does NOT render the back chip when onBack is omitted", () => {
    render(<GlobalStatusBar variant="anonymous" />);
    expect(
      screen.queryByLabelText(GLOBAL_STATUS_BAR_COPY.backLabel),
    ).not.toBeInTheDocument();
  });

  it("renders a back chip and fires the callback when onBack is defined", () => {
    const onBack = vi.fn();
    render(<GlobalStatusBar variant="anonymous" onBack={onBack} />);
    const button = screen.getByLabelText(GLOBAL_STATUS_BAR_COPY.backLabel);
    fireEvent.click(button);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant: connected (PRO loading)
// ─────────────────────────────────────────────────────────────────────────────

describe("<GlobalStatusBar> variant: connected — PRO loading", () => {
  it("renders the wallet truncation and a skeleton PRO slot", () => {
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={null}
        isProLoading
        onProTap={() => undefined}
      />,
    );
    expect(screen.getByText(sampleWalletShort)).toBeInTheDocument();
    expect(getStatusBar()).toHaveAttribute("data-variant", "connected");
    expect(
      screen.getByLabelText(GLOBAL_STATUS_BAR_COPY.proLoadingAriaLabel),
    ).toBeInTheDocument();
  });

  it("does NOT show the gold ring while loading", () => {
    const { container } = render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={null}
        isProLoading
        onProTap={() => undefined}
      />,
    );
    // Loading uses the skeleton slot, not the ring marker.
    expect(
      container.querySelector("[data-pro-state='active']"),
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant: connected (PRO active)
// ─────────────────────────────────────────────────────────────────────────────

describe("<GlobalStatusBar> variant: connected — PRO active", () => {
  const futureExpiry = Date.now() + 28 * 24 * 60 * 60 * 1000;

  it("renders the Hub PRO resource chip with manage aria-label", () => {
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={{ active: true, expiresAt: futureExpiry }}
        isProLoading={false}
        onProTap={() => undefined}
      />,
    );
    const proButton = screen.getByLabelText(
      GLOBAL_STATUS_BAR_COPY.proManageLabel,
    );
    expect(proButton).toBeInTheDocument();
    expect(proButton.className).toMatch(/\bhud-resource-chip\b/);
    expect(proButton.className).toMatch(/\bhud-resource-chip--pro\b/);
    expect(proButton.className).toMatch(/\bhud-resource-chip--md\b/);
    expect(proButton.className).toMatch(/\bis-atmosphere-adventure\b/);
  });

  it("calls onProTap when the active PRO pill is clicked", () => {
    const onProTap = vi.fn();
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={{ active: true, expiresAt: futureExpiry }}
        isProLoading={false}
        onProTap={onProTap}
      />,
    );
    fireEvent.click(
      screen.getByLabelText(GLOBAL_STATUS_BAR_COPY.proManageLabel),
    );
    expect(onProTap).toHaveBeenCalledOnce();
  });

  it("renders the active PRO chip with the compact days-remaining suffix (PRO Nd)", () => {
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={{ active: true, expiresAt: futureExpiry }}
        isProLoading={false}
        onProTap={() => undefined}
      />,
    );
    const pill = screen.getByLabelText(GLOBAL_STATUS_BAR_COPY.proManageLabel);
    // Active chip now surfaces "PRO Nd" so the cross-app status bar
    // matches the /hub HUD chip pattern — gives the user a recognizable
    // cue that the subscription is live and how long is left. The
    // verbose "days left" copy stays forbidden (chip is tight).
    expect(pill.textContent).toMatch(/^PRO \d+d$/);
    expect(pill.textContent).not.toMatch(/days left/);
  });

  it("renders the inactive PRO chip as a bare 'PRO' CTA (no days suffix)", () => {
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={{ active: false, expiresAt: null }}
        isProLoading={false}
        onProTap={() => undefined}
      />,
    );
    const pill = screen.getByLabelText(GLOBAL_STATUS_BAR_COPY.proViewLabel);
    expect(pill.textContent?.trim()).toBe("PRO");
  });

  it("warns when proStatus is stale (active=true but expiresAt < now)", () => {
    const warn = silenceWarn();
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={{ active: true, expiresAt: Date.now() - 1000 }}
        isProLoading={false}
        onProTap={() => undefined}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("stale PRO status"),
    );
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant: connected (PRO inactive)
// ─────────────────────────────────────────────────────────────────────────────

describe("<GlobalStatusBar> variant: connected — PRO inactive", () => {
  it("renders the same Hub PRO resource chip with view aria-label", () => {
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={{ active: false, expiresAt: null }}
        isProLoading={false}
        onProTap={() => undefined}
      />,
    );
    const proButton = screen.getByLabelText(
      GLOBAL_STATUS_BAR_COPY.proViewLabel,
    );
    expect(proButton).toBeInTheDocument();
    expect(proButton.textContent).toContain("PRO");
    expect(proButton.className).toMatch(/\bhud-resource-chip\b/);
    expect(proButton.className).toMatch(/\bhud-resource-chip--pro\b/);
    expect(proButton.className).toMatch(/\bhud-resource-chip--md\b/);
    expect(proButton.className).toMatch(/\bis-atmosphere-adventure\b/);
  });

  it("calls onProTap when the inactive PRO chip is clicked", () => {
    const onProTap = vi.fn();
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: sampleWalletShort }}
        proStatus={{ active: false, expiresAt: null }}
        isProLoading={false}
        onProTap={onProTap}
      />,
    );
    fireEvent.click(
      screen.getByLabelText(GLOBAL_STATUS_BAR_COPY.proViewLabel),
    );
    expect(onProTap).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime guards (dev-mode warnings — see spec §6)
// ─────────────────────────────────────────────────────────────────────────────

describe("<GlobalStatusBar> runtime guards (dev-mode)", () => {
  it("warns on the discriminated-union spread escape (anonymous + connected keys)", () => {
    const warn = silenceWarn();
    // Simulate the spread escape from spec §5: a wider object that the
    // type system cannot reject. We bypass TS via `as never` to mirror
    // what would happen if a caller spread props without literal narrowing.
    const leaked = {
      variant: "anonymous" as const,
      proStatus: { active: false, expiresAt: null },
      isProLoading: false,
      onProTap: () => undefined,
    } as unknown as React.ComponentProps<typeof GlobalStatusBar>;
    render(<GlobalStatusBar {...leaked} />);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("anonymous variant received connected-only keys"),
    );
    warn.mockRestore();
  });

  it("warns when handle exceeds the 14-char visual cap", () => {
    const warn = silenceWarn();
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{
          handle: "this-handle-is-way-too-long",
          walletShort: sampleWalletShort,
        }}
        proStatus={{ active: false, expiresAt: null }}
        isProLoading={false}
        onProTap={() => undefined}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("handle exceeds 14 chars"),
    );
    warn.mockRestore();
  });

  it("warns when walletShort does not match the canonical shape", () => {
    const warn = silenceWarn();
    render(
      <GlobalStatusBar
        variant="connected"
        identity={{ walletShort: "0x1234567890" }}
        proStatus={{ active: false, expiresAt: null }}
        isProLoading={false}
        onProTap={() => undefined}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("walletShort should be"),
    );
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Compile-time contracts (documented as commented-out fixtures, mirroring
// the ContextualHeader pattern). Until `tsd` lands, these are reference-only.
// ─────────────────────────────────────────────────────────────────────────────

describe("compile-time contracts (documented)", () => {
  it("documents what the type system rejects (no runtime assertion)", () => {
    // The following are TYPE ERRORS — uncomment to verify in editor:
    //
    // const a = (
    //   <GlobalStatusBar
    //     variant="anonymous"
    //     // @ts-expect-error proStatus is connected-only
    //     proStatus={{ active: false, expiresAt: null }}
    //   />
    // );
    //
    // const b = (
    //   <GlobalStatusBar
    //     variant="connected"
    //     // @ts-expect-error walletShort is required
    //     identity={{}}
    //     proStatus={null}
    //     isProLoading
    //     onProTap={() => undefined}
    //   />
    // );
    //
    // const c = (
    //   <GlobalStatusBar
    //     variant="connected"
    //     identity={{ walletShort: "0x1234…abcd" }}
    //     // @ts-expect-error className escape hatch is not allowed
    //     className="custom"
    //     proStatus={null}
    //     isProLoading
    //     onProTap={() => undefined}
    //   />
    // );

    expect(true).toBe(true);
  });

  it("documents what passes the type check but is caught at runtime", () => {
    // Spread-prop escape: TS does not narrow spreads against discriminated
    // unions. The runtime guard in §6 catches it (see test
    // "warns on the discriminated-union spread escape" above).
    expect(true).toBe(true);
  });
});
