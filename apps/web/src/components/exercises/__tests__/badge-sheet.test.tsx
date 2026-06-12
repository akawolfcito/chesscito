import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadgeSheet } from "../badge-sheet";
import type { PieceId } from "@/lib/game/types";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const pieces: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
}));

function setStars(piece: PieceId, stars: number[]) {
  localStorage.setItem(
    `chesscito:progress:${piece}`,
    JSON.stringify({ piece, exerciseIndex: 0, stars }),
  );
}

function renderBadgeSheet({
  badgesClaimed = {
    rook: false,
    bishop: true,
    knight: false,
    pawn: false,
    queen: false,
    king: false,
  },
  ...extra
}: {
  badgesClaimed?: Record<PieceId, boolean | undefined>;
} & Partial<React.ComponentProps<typeof BadgeSheet>> = {}) {
  return render(
    <BadgeSheet
      open
      onOpenChange={() => {}}
      badgesClaimed={badgesClaimed}
      onClaim={() => {}}
      isClaimBusy={false}
      claimingPiece={null}
      showNotification={false}
      showTrigger={false}
      {...extra}
    />,
  );
}


describe("BadgeSheet — claim action presentation", () => {
  beforeEach(() => {
    localStorage.clear();
    pieces.forEach((piece) => setStars(piece, [0, 0, 0, 0, 0]));
    setStars("rook", [3, 3, 3, 3, 0]);
    setStars("bishop", [3, 3, 3, 3, 3]);
  });

  it("renders claimable badges with the compact claim button treatment", () => {
    renderBadgeSheet();

    const claim = screen.getByRole("button", { name: "Claim Badge" });
    expect(claim).toHaveTextContent("Claim");
    // Shop buy-pill treatment (founder 2026-06-11).
    expect(claim).toHaveClass("shop-item-tile-buy-pill--green");
    expect(screen.getByText("Claimable")).toBeInTheDocument();
  });

  it("keeps owned and locked states visible", () => {
    renderBadgeSheet();

    expect(screen.getAllByText("Owned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Locked").length).toBeGreaterThan(0);
  });
});

describe("BadgeSheet — unified Piece Sheet, cards ARE the switch (QA F4)", () => {
  beforeEach(() => {
    localStorage.clear();
    pieces.forEach((piece) => setStars(piece, [0, 0, 0, 0, 0]));
  });

  const NO_CLAIMS = {
    rook: false,
    bishop: false,
    knight: false,
    pawn: false,
    queen: false,
    king: false,
  };

  it("never renders the journey tray nor a separate switch grid", () => {
    renderBadgeSheet({ selectedPiece: "rook", onSelectPiece: vi.fn() });

    expect(screen.queryByText("Your journey")).not.toBeInTheDocument();
    expect(screen.queryByText("Switch piece")).not.toBeInTheDocument();
  });

  it("cards stay inert until the first badge is claimed (pedagogy gate)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const onSelectPiece = vi.fn();
    const user = userEvent.setup();
    renderBadgeSheet({
      selectedPiece: "rook",
      onSelectPiece,
      badgesClaimed: NO_CLAIMS,
    });

    expect(
      screen.queryByRole("button", { name: "Knight Ascendant" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByText("Knight Ascendant"));
    expect(onSelectPiece).not.toHaveBeenCalled();
  });

  it("after a claimed badge, tapping a card selects that piece and closes", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const onSelectPiece = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderBadgeSheet({ selectedPiece: "rook", onSelectPiece, onOpenChange });

    await user.click(
      screen.getByRole("button", { name: "Knight Ascendant" }),
    );
    expect(onSelectPiece).toHaveBeenCalledWith("knight");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("the claim CTA inside a card never triggers a piece switch", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const onSelectPiece = vi.fn();
    const user = userEvent.setup();
    // rook is claimable (12★ fixture below) and bishop claimed (gate open).
    setStars("rook", [3, 3, 3, 3, 0]);
    renderBadgeSheet({ selectedPiece: "rook", onSelectPiece });

    await user.click(screen.getByRole("button", { name: "Claim Badge" }));
    expect(onSelectPiece).not.toHaveBeenCalled();
  });

  it("stays a pure vitrine without onSelectPiece (hub mode, legacy contract)", () => {
    renderBadgeSheet();

    expect(screen.queryByText("Your journey")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Knight Ascendant" }),
    ).not.toBeInTheDocument();
  });
});

describe("BadgeSheet — ContextualHeader canary", () => {
  beforeEach(() => {
    localStorage.clear();
    pieces.forEach((piece) => setStars(piece, [0, 0, 0, 0, 0]));
  });

  it("mounts the close-control ContextualHeader (not the legacy ad-hoc header)", () => {
    renderBadgeSheet();
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-component", "contextual-header");
    expect(header).toHaveAttribute("data-variant", "close-control");
  });

  it("renders exactly one close affordance (inline, not the floating absolute X)", () => {
    renderBadgeSheet();
    const closeButtons = screen.getAllByRole("button", { name: /close badges/i });
    expect(closeButtons).toHaveLength(1);
    expect(closeButtons[0].getAttribute("data-slot")).toBe("close-control");
  });

  it("renders the HERO BAND stats line (pieces + stars) below the header", () => {
    setStars("rook", [3, 3, 3, 3, 3]);
    renderBadgeSheet();
    // 15 of 90 stars (rook full = 15 stars). Bishop is claimed in the
    // default fixture → piecesClaimed = 1. HERO BAND format renders
    // "1/6 PIECES" and "15/90 ★" as sibling spans.
    expect(screen.getByText(/1\/6 PIECES/i)).toBeInTheDocument();
    expect(screen.getByText(/15\/90 ★/)).toBeInTheDocument();
  });
});
