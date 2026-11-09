import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadgeSheet } from "../badge-sheet";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { seedProgress } from "@/hooks/__tests__/helpers/seed-progress";

const pieces: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

function setStars(piece: PieceId, stars: number[]) {
  localStorage.setItem(
    `chesscito:progress:${piece}`,
    seedProgress(piece, 0, stars),
  );
}

/** The shape the app actually persists since the id-keyed migration
 *  (2026-06-16). `setStars` above writes the legacy array, which is why
 *  these tests kept passing while the real sheet showed every piece as
 *  locked. */
function setStarsById(piece: PieceId, starsById: Record<string, number>) {
  localStorage.setItem(
    `chesscito:progress:${piece}`,
    JSON.stringify({ piece, currentId: `${piece}-1`, stars: starsById }),
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
    // Badge gate is COMPLETION (80% of the 10-exercise pool → 8). Eight solves
    // make rook claimable; bishop is owned via badgesClaimed, so exactly one
    // "Claim Badge" renders.
    setStars("rook", [3, 3, 3, 3, 3, 3, 3, 3]);
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

describe("BadgeSheet — id-keyed progress (regression: Claim never rendered)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("offers Claim for a piece whose id-keyed stars cross the threshold", () => {
    // 8 id-keyed completions on rook — 80% of the pool, using real catalog ids
    // (the pool is not rook-1..10: it has rook-distance-1 / rook-no-diagonal-1,
    // and no rook-3 / rook-5). Read as a positional array this scored 0★ and the
    // piece rendered locked, so the Claim CTA was unreachable past the gate.
    setStarsById("rook", {
      "rook-1": 3,
      "rook-2": 3,
      "rook-distance-1": 3,
      "rook-no-diagonal-1": 3,
      "rook-4": 3,
      "rook-6": 3,
      "rook-7": 3,
      "rook-8": 3,
    });

    renderBadgeSheet();

    expect(screen.getByRole("button", { name: "Claim Badge" })).toBeInTheDocument();
    expect(screen.getByText("Claimable")).toBeInTheDocument();
  });

  it("keeps a piece below the threshold locked", () => {
    setStarsById("rook", { "rook-1": 3, "rook-2": 3 });

    renderBadgeSheet();

    expect(screen.queryByRole("button", { name: "Claim Badge" })).not.toBeInTheDocument();
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

  it("pieces beyond the unlock frontier stay inert (QA G2)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const onSelectPiece = vi.fn();
    const user = userEvent.setup();
    // Default fixture: only bishop claimed → unlocked = rook (first),
    // bishop (claimed), knight (next after a claimed piece). Pawn,
    // queen, king sit beyond the frontier.
    renderBadgeSheet({ selectedPiece: "rook", onSelectPiece });

    expect(
      screen.getByRole("button", { name: "Knight Ascendant" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Queen Ascendant" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByText("Queen Ascendant"));
    expect(onSelectPiece).not.toHaveBeenCalled();
  });

  it("the claim CTA inside a card never triggers a piece switch", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const onSelectPiece = vi.fn();
    const user = userEvent.setup();
    // rook is claimable (8 completions below) and bishop claimed (gate open).
    setStars("rook", [3, 3, 3, 3, 3, 3, 3, 3]);
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
    // The denominator is the real catalog (every exercise × 3★), so it MOVES when
    // a board is authored: it read 177 until the bishop's tenth board landed on
    // 2026-08-11. Counting it here instead of pinning it keeps this case about the
    // stats line, not about how much content exists.
    const maxStars =
      Object.values(EXERCISES).reduce((n, pool) => n + pool.length, 0) * 3;
    // The legacy 5-slot fixture fills rook's first five exercises → 15★.
    // Bishop is claimed → piecesClaimed = 1.
    expect(screen.getByText(/1\/6 PIECES/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`15/${maxStars} ★`))).toBeInTheDocument();
  });
});
