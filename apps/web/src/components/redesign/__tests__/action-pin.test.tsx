import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActionPin, type ActionPinAction } from "../action-pin";

const hapticTap = vi.fn();

vi.mock("@/lib/haptics", () => ({
  hapticTap: () => hapticTap(),
}));

beforeEach(() => {
  hapticTap.mockClear();
});

const ACTIONS: readonly ActionPinAction[] = [
  "submitScore",
  "useShield",
  "claimBadge",
  "retry",
  "connectWallet",
  "switchNetwork",
] as const;

const ACTION_ICON_FILE: Record<ActionPinAction, string> = {
  submitScore: "save-score-icon-v1",
  useShield: "shield",
  claimBadge: "claim-icon-v1",
  retry: "refresh",
  connectWallet: "wallet",
  switchNetwork: "refresh",
};

const ACTION_ROW_ICON_FILE: Record<ActionPinAction, string> = {
  submitScore: "save-score-icon-v1",
  useShield: "shield-king",
  claimBadge: "claim-icon-v1",
  retry: "refresh",
  connectWallet: "wallet",
  switchNetwork: "refresh",
};

/** Actions that render a custom reward sprite from /art/new-icons-chesscito
 *  (pedestal pin, no candy-frame) instead of the action-row/CandyIcon set. */
const CUSTOM_ICON_ACTIONS = new Set<ActionPinAction>(["submitScore", "claimBadge"]);

function getRoot(): HTMLElement {
  const root = document.querySelector('[data-component="action-pin"]');
  if (!root) throw new Error("ActionPin root not found");
  return root as HTMLElement;
}

describe("ActionPin — render matrix (6 actions × 2 sizes)", () => {
  for (const action of ACTIONS) {
    for (const size of ["pin", "full"] as const) {
      it(`renders ${action} as size="${size}" with the correct icon and data attributes`, () => {
        const { container } = render(
          <ActionPin
            action={action}
            size={size}
            label="Label"
            ariaLabel={`${action} ${size}`}
            onPress={() => {}}
          />,
        );

        const root = getRoot();
        expect(root.getAttribute("data-component")).toBe("action-pin");
        expect(root.getAttribute("data-action")).toBe(action);
        expect(root.getAttribute("data-size")).toBe(size);

        const button = screen.getByRole("button", { name: `${action} ${size}` });
        expect(button.tagName.toLowerCase()).toBe("button");
        expect(button).toHaveAttribute("type", "button");

        if (size === "pin") {
          const icon = button.querySelector("img");
          const expectedBase = CUSTOM_ICON_ACTIONS.has(action)
            ? "/art/new-icons-chesscito"
            : "/art/action-row";
          expect(icon).toHaveAttribute(
            "src",
            `${expectedBase}/${ACTION_ROW_ICON_FILE[action]}.png`,
          );
          // External label rendered BELOW the button by the primitive
          // (slot does not own the label).
          const externalLabel = root.querySelector(".action-pin-label");
          expect(externalLabel).not.toBeNull();
          expect(externalLabel?.textContent).toBe("Label");
          // The external label must NOT be inside the <button>.
          expect(button.contains(externalLabel as Node)).toBe(false);
        } else {
          const expectedIcon = ACTION_ICON_FILE[action];
          if (CUSTOM_ICON_ACTIONS.has(action)) {
            const icon = button.querySelector("img");
            expect(icon).toHaveAttribute(
              "src",
              `/art/new-icons-chesscito/${expectedIcon}.png`,
            );
          } else {
            const srcsets = Array.from(container.querySelectorAll("source")).map(
              (s) => s.getAttribute("srcset"),
            );
            expect(srcsets).toContain(`/art/redesign/icons/${expectedIcon}.avif`);
          }
          // size="full" — label is INLINE inside the button.
          expect(button.textContent).toContain("Label");
        }
      });
    }
  }
});

describe("ActionPin — tone", () => {
  it('claimBadge pin renders the bare badge sprite on a pedestal (no candy-frame tile)', () => {
    // Icon-mapping fix 2026-06-10: CLAIM shows its badge-save-icon sprite
    // bare (like SAVE), NOT inside the gold candy-frame trophy tile.
    render(
      <ActionPin
        action="claimBadge"
        size="pin"
        tone="claim"
        label="Claim badge"
        ariaLabel="Claim badge"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Claim badge" });
    expect(button.className).toMatch(/\baction-pin-submit-pedestal\b/);
    expect(button.className).not.toMatch(/\bcandy-frame-gold\b/);
    expect(button.querySelector("img")).toHaveAttribute(
      "src",
      "/art/new-icons-chesscito/claim-icon-v1.png",
    );
  });

  it('applies the per-action gradient class when tone="default" (parameterized: connectWallet — utility action stays candy-frame)', () => {
    // connectWallet is a utility action (NOT in CEREMONIAL_FULL_ACTIONS),
    // so size="full" stays on the candy-frame path with per-action
    // gradient classes. Ceremonial full actions (submitScore, useShield,
    // claimBadge) compose <PrincipalButton> instead — covered by the
    // ceremonial composition describe block below.
    render(
      <ActionPin
        action="connectWallet"
        size="full"
        tone="default"
        label="Connect"
        ariaLabel="Connect"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Connect" });
    expect(button.className).toMatch(/bg-gradient-to-b/);
    expect(button.className).toMatch(/var\(--cta-brand-from\)/);
    expect(button.className).not.toMatch(/\bcandy-frame-gold\b/);
  });
});

describe("ActionPin — tone='claim' + size='full' composition (M3.5)", () => {
  it("renders <PrincipalButton size='large'> inside the action-pin wrapper", () => {
    render(
      <ActionPin
        action="claimBadge"
        size="full"
        tone="claim"
        label="Claim badge"
        ariaLabel="Claim badge"
        onPress={() => {}}
      />,
    );
    const root = getRoot();
    const principal = root.querySelector(
      '[data-component="principal-button"]',
    ) as HTMLElement | null;
    expect(principal).not.toBeNull();
    expect(principal!.getAttribute("data-size")).toBe("large");
  });

  it("PrincipalButton receives the action label as children", () => {
    render(
      <ActionPin
        action="claimBadge"
        size="full"
        tone="claim"
        label="Claim badge"
        ariaLabel="Claim badge"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Claim badge" });
    expect(button.textContent).toContain("Claim badge");
    // No candy-frame-gold on the new principal-button surface.
    expect(button.className).not.toMatch(/\bcandy-frame-gold\b/);
  });

  it("isBusy → PrincipalButton sets aria-busy AND disables click", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionPin
        action="claimBadge"
        size="full"
        tone="claim"
        label="Claim badge"
        ariaLabel="Claim badge"
        isBusy
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "Claim badge" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(hapticTap).not.toHaveBeenCalled();
  });

  it("disabled → PrincipalButton is disabled, click suppressed", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionPin
        action="claimBadge"
        size="full"
        tone="claim"
        label="Claim badge"
        ariaLabel="Claim badge"
        disabled
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "Claim badge" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("default state — onPress + haptics fire on click", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionPin
        action="claimBadge"
        size="full"
        tone="claim"
        label="Claim badge"
        ariaLabel="Claim badge"
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "Claim badge" });
    await user.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(hapticTap).toHaveBeenCalledTimes(1);
  });
});

describe("ActionPin — ceremonial full actions composition (sprint 1A)", () => {
  // Sprint 1A extends the diegetic <PrincipalButton> compose path from
  // claim-only to all ceremonial full-size actions (claim + submitScore
  // + useShield). Utility actions (retry/connectWallet/switchNetwork)
  // and ALL pin-size variants stay on the candy-frame path.

  it("submitScore + size='full' renders <PrincipalButton size='large'>", () => {
    render(
      <ActionPin
        action="submitScore"
        size="full"
        label="Submit score"
        ariaLabel="Submit score"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Submit score" });
    expect(button.getAttribute("data-component")).toBe("principal-button");
    expect(button.getAttribute("data-size")).toBe("large");
    expect(button.className).not.toMatch(/bg-gradient-to-b/);
  });

  it("useShield + size='full' renders <PrincipalButton size='large'>", () => {
    render(
      <ActionPin
        action="useShield"
        size="full"
        label="Use shield"
        ariaLabel="Use shield"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Use shield" });
    expect(button.getAttribute("data-component")).toBe("principal-button");
    expect(button.getAttribute("data-size")).toBe("large");
  });

  it("retry + size='full' STAYS candy-frame (utility action — regression guard)", () => {
    render(
      <ActionPin
        action="retry"
        size="full"
        label="Retry"
        ariaLabel="Retry"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Retry" });
    expect(button.getAttribute("data-component")).not.toBe("principal-button");
    expect(button.className).toMatch(/var\(--cta-muted-bg\)/);
  });

  it("submitScore + size='pin' STAYS candy-frame (pin geometry doesn't fit PrincipalButton)", () => {
    render(
      <ActionPin
        action="submitScore"
        size="pin"
        label="Submit"
        ariaLabel="Submit score"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Submit score" });
    expect(button.getAttribute("data-component")).not.toBe("principal-button");
  });
});

describe("ActionPin — badge slot", () => {
  it('renders badge.pin at -right-1 -top-1 when size="pin"', () => {
    render(
      <ActionPin
        action="useShield"
        size="pin"
        label="Use shield"
        ariaLabel="Use shield"
        badge={{ pin: <span data-testid="b-pin">3</span>, full: <span data-testid="b-full">3 left</span> }}
        onPress={() => {}}
      />,
    );
    const pinBadge = screen.queryByTestId("b-pin");
    expect(pinBadge).not.toBeNull();
    const wrapper = pinBadge!.parentElement as HTMLElement;
    expect(wrapper.className).toMatch(/-right-1/);
    expect(wrapper.className).toMatch(/-top-1/);
  });

  it('renders badge.full inside the PrincipalButton (ml-2 + brown chip) when size="full" + ceremonial action', () => {
    // useShield + size="full" composes <PrincipalButton> per
    // CEREMONIAL_FULL_ACTIONS; the badge.full pill is rendered inside
    // the principal button label area with the diegetic brown chip
    // styling (PRINCIPAL_BADGE_CLASSES) instead of the legacy
    // candy-frame `ml-1 bg-white/20` pill.
    render(
      <ActionPin
        action="useShield"
        size="full"
        label="Use shield"
        ariaLabel="Use shield"
        badge={{ pin: <span data-testid="b-pin">3</span>, full: <span data-testid="b-full">3 left</span> }}
        onPress={() => {}}
      />,
    );
    const fullBadge = screen.queryByTestId("b-full");
    expect(fullBadge).not.toBeNull();
    const wrapper = fullBadge!.parentElement as HTMLElement;
    expect(wrapper.className).toMatch(/\bml-2\b/);
    // Both pin and full badges should NOT coexist — only `full` for size="full"
    expect(screen.queryByTestId("b-pin")).toBeNull();
  });

  it("ignores badge.full on size='pin' and ignores badge.pin on size='full'", () => {
    const { rerender } = render(
      <ActionPin
        action="useShield"
        size="pin"
        label="Use shield"
        ariaLabel="Use shield"
        badge={{ pin: <span data-testid="b-pin">3</span>, full: <span data-testid="b-full">3 left</span> }}
        onPress={() => {}}
      />,
    );
    expect(screen.queryByTestId("b-pin")).not.toBeNull();
    expect(screen.queryByTestId("b-full")).toBeNull();

    rerender(
      <ActionPin
        action="useShield"
        size="full"
        label="Use shield"
        ariaLabel="Use shield"
        badge={{ pin: <span data-testid="b-pin">3</span>, full: <span data-testid="b-full">3 left</span> }}
        onPress={() => {}}
      />,
    );
    expect(screen.queryByTestId("b-pin")).toBeNull();
    expect(screen.queryByTestId("b-full")).not.toBeNull();
  });
});

describe("ActionPin — isBusy state", () => {
  it("ceremonial full path (submitScore): PrincipalButton sets aria-busy, shows its spinner, hides leading icon, blocks click", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ActionPin
        action="submitScore"
        size="full"
        label="Submit"
        ariaLabel="Submit"
        isBusy
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();

    // PrincipalButton owns its own spinner class; legacy `.animate-spin`
    // belonged to the candy-frame path (no longer used for ceremonial
    // full actions).
    expect(button.querySelector(".principal-button-spinner")).not.toBeNull();
    // Leading icon (CandyIcon) NOT rendered when busy
    const srcsets = Array.from(container.querySelectorAll("source")).map(
      (s) => s.getAttribute("srcset"),
    );
    expect(srcsets).not.toContain("/art/redesign/icons/star.avif");

    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(hapticTap).not.toHaveBeenCalled();
  });

  it("utility full path (connectWallet): candy-frame spinner via .animate-spin", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionPin
        action="connectWallet"
        size="full"
        label="Connect"
        ariaLabel="Connect"
        isBusy
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "Connect" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("ActionPin — disabled state", () => {
  it("sets the button disabled attr, applies is-disabled, blocks onPress, and does NOT set aria-busy", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionPin
        action="connectWallet"
        size="full"
        label="Connect"
        ariaLabel="Connect"
        disabled
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "Connect" });
    expect(button).toBeDisabled();
    expect(button.className).toMatch(/\bis-disabled\b/);
    // Critical orthogonality: disabled does NOT set aria-busy.
    expect(button.getAttribute("aria-busy")).toBeNull();

    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(hapticTap).not.toHaveBeenCalled();
  });
});

describe("ActionPin — onPress + haptics", () => {
  it("fires onPress once and triggers hapticTap on tap", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionPin
        action="retry"
        size="pin"
        label="Retry"
        ariaLabel="Retry"
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "Retry" });
    await user.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(hapticTap).toHaveBeenCalledTimes(1);
  });
});

describe("ActionPin — atmosphere", () => {
  it("applies the adventure atmosphere class by default", () => {
    render(
      <ActionPin
        action="retry"
        size="pin"
        label="Retry"
        ariaLabel="Retry"
        onPress={() => {}}
      />,
    );
    const root = getRoot();
    expect(root.className).toMatch(/\bis-atmosphere-adventure\b/);
    expect(root.className).not.toMatch(/\bis-atmosphere-scholarly\b/);
  });

  it("swaps to the scholarly atmosphere class when atmosphere='scholarly'", () => {
    render(
      <ActionPin
        action="retry"
        size="pin"
        label="Retry"
        ariaLabel="Retry"
        atmosphere="scholarly"
        onPress={() => {}}
      />,
    );
    const root = getRoot();
    expect(root.className).toMatch(/\bis-atmosphere-scholarly\b/);
    expect(root.className).not.toMatch(/\bis-atmosphere-adventure\b/);
  });
});

describe("ActionPin — className merge", () => {
  it("merges a custom className alongside the base classes without breaking the canonical class list", () => {
    render(
      <ActionPin
        action="retry"
        size="pin"
        label="Retry"
        ariaLabel="Retry"
        className="extra-test-class"
        onPress={() => {}}
      />,
    );
    const root = getRoot();
    expect(root.className).toMatch(/\baction-pin\b/);
    expect(root.className).toMatch(/\baction-pin--pin\b/);
    expect(root.className).toMatch(/\bextra-test-class\b/);
  });
});

describe("ActionPin — accessibility (decorative icons)", () => {
  it("hides decorative icon images from assistive tech (button name owns the label)", () => {
    const { container } = render(
      <ActionPin
        action="submitScore"
        size="full"
        label="Submit"
        ariaLabel="Submit"
        onPress={() => {}}
      />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((img) => {
      expect(img).toHaveAttribute("aria-hidden", "true");
      expect(img).toHaveAttribute("alt", "");
    });
  });
});

describe("ActionPin — status marker (founder check/dot system 2026-06-11)", () => {
  it("status='done' renders the green check marker on pin size", () => {
    const { container } = render(
      <ActionPin
        action="submitScore"
        size="pin"
        label="Save"
        ariaLabel="Save"
        status="done"
        onPress={() => {}}
      />,
    );
    const marker = container.querySelector(".action-pin-status--done");
    expect(marker).not.toBeNull();
    expect(marker).toHaveTextContent("✓");
  });

  it("status='pending' renders the pulsing red notification dot", () => {
    const { container } = render(
      <ActionPin
        action="claimBadge"
        size="pin"
        label="Claim"
        ariaLabel="Claim"
        status="pending"
        onPress={() => {}}
      />,
    );
    const dot = container.querySelector(".action-pin-notif img");
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute(
      "src",
      "/art/scene-rooted/punto-alerta-notificacion.png",
    );
  });

  it("no status prop renders no marker (back-compat default)", () => {
    const { container } = render(
      <ActionPin
        action="submitScore"
        size="pin"
        label="Save"
        ariaLabel="Save"
        onPress={() => {}}
      />,
    );
    expect(container.querySelector(".action-pin-status--done")).toBeNull();
    expect(container.querySelector(".action-pin-notif")).toBeNull();
  });

  it("status markers do not render on size='full' (pin-only affordance)", () => {
    const { container } = render(
      <ActionPin
        action="submitScore"
        size="full"
        label="Save"
        ariaLabel="Save"
        status="done"
        onPress={() => {}}
      />,
    );
    expect(container.querySelector(".action-pin-status--done")).toBeNull();
  });
});
