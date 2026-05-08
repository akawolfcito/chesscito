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
  submitScore: "star",
  useShield: "shield",
  claimBadge: "trophy",
  retry: "refresh",
  connectWallet: "wallet",
  switchNetwork: "refresh",
};

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

        const srcsets = Array.from(container.querySelectorAll("source")).map(
          (s) => s.getAttribute("srcset"),
        );
        const expectedIcon = ACTION_ICON_FILE[action];
        expect(srcsets).toContain(`/art/redesign/icons/${expectedIcon}.avif`);

        if (size === "pin") {
          // External label rendered BELOW the button by the primitive
          // (slot does not own the label).
          const externalLabel = root.querySelector(".action-pin-label");
          expect(externalLabel).not.toBeNull();
          expect(externalLabel?.textContent).toBe("Label");
          // The external label must NOT be inside the <button>.
          expect(button.contains(externalLabel as Node)).toBe(false);
        } else {
          // size="full" — label is INLINE inside the button.
          expect(button.textContent).toContain("Label");
        }
      });
    }
  }
});

describe("ActionPin — tone", () => {
  it('applies "candy-frame candy-frame-gold" classes when tone="claim"', () => {
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
    expect(button.className).toMatch(/\bcandy-frame\b/);
    expect(button.className).toMatch(/\bcandy-frame-gold\b/);
  });

  it('applies the per-action gradient class when tone="default" (parameterized: submitScore)', () => {
    render(
      <ActionPin
        action="submitScore"
        size="full"
        tone="default"
        label="Submit"
        ariaLabel="Submit"
        onPress={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Submit" });
    // `bg-gradient-to-b` + `from-[var(--cta-brand-from)]` for submitScore
    expect(button.className).toMatch(/bg-gradient-to-b/);
    expect(button.className).toMatch(/var\(--cta-brand-from\)/);
    expect(button.className).not.toMatch(/\bcandy-frame-gold\b/);
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

  it('renders badge.full inline (ml-1) when size="full"', () => {
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
    expect(wrapper.className).toMatch(/\bml-1\b/);
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
  it("shows the spinner, hides the icon, sets aria-busy='true', and blocks onPress when isBusy", async () => {
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

    // Spinner present
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    // Icon NOT rendered (no <picture> with the action icon srcset)
    const srcsets = Array.from(container.querySelectorAll("source")).map(
      (s) => s.getAttribute("srcset"),
    );
    expect(srcsets).not.toContain("/art/redesign/icons/star.avif");

    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(hapticTap).not.toHaveBeenCalled();
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
