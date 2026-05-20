import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShopSheet } from "../shop-sheet";
import { SHOP_SHEET_COPY } from "@/lib/content/editorial";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

function renderShopSheet({
  onOpenChange = () => undefined,
  onSelectItem = () => undefined,
}: {
  onOpenChange?: (open: boolean) => void;
  onSelectItem?: (itemId: bigint) => void;
} = {}) {
  return render(
    <ShopSheet
      open
      onOpenChange={onOpenChange}
      items={[]}
      onSelectItem={onSelectItem}
      showTrigger={false}
    />,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canary contract — ShopSheet is the first sheet to adopt
// <ContextualHeader variant="close-control"> (see
// docs/reviews/2026-05-20-header-consistency-audit.md §3).
//
// These tests lock in:
//   - the header mounts with the canonical primitive (not the legacy
//     ad-hoc `border-b -mx-6 -mt-6` block);
//   - the inline close button works;
//   - the floating absolute X from sheet.tsx is suppressed via `hideClose`
//     so the user sees only ONE close affordance.
// ─────────────────────────────────────────────────────────────────────────────

describe("ShopSheet — ContextualHeader canary", () => {
  it("mounts the close-control ContextualHeader (not the legacy ad-hoc header)", () => {
    renderShopSheet();
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-component", "contextual-header");
    expect(header).toHaveAttribute("data-variant", "close-control");
  });

  it("renders the SHOP_SHEET_COPY title and description in the header", () => {
    renderShopSheet();
    expect(
      screen.getByRole("heading", { name: SHOP_SHEET_COPY.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(SHOP_SHEET_COPY.description)).toBeInTheDocument();
  });

  it("renders ONLY one close affordance (inline close, not the floating absolute X)", () => {
    renderShopSheet();
    // `hideClose` on SheetContent suppresses Radix's absolute close, so
    // the user only sees the inline button from ContextualHeader.
    const closeButtons = screen.getAllByRole("button", { name: /close shop/i });
    expect(closeButtons).toHaveLength(1);
    expect(closeButtons[0].getAttribute("data-slot")).toBe("close-control");
  });

  it("calls onOpenChange(false) when the inline close button is tapped", () => {
    const onOpenChange = vi.fn();
    renderShopSheet({ onOpenChange });
    fireEvent.click(screen.getByRole("button", { name: /close shop/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
