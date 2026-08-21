import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";

import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import {
  MiniGamesSection,
  type MiniGamesCard,
} from "@/components/hub/minigames-section";

const CARDS: MiniGamesCard[] = [
  {
    challengeId: "rook-rail-two-roads",
    engineId: "rook-rail",
    piece: "rook",
    title: "Two Roads",
    state: "FEATURED_AVAILABLE",
    isNew: true,
  },
  {
    challengeId: "bishop-run-2",
    engineId: "pivot-run",
    piece: "bishop",
    title: "Turn to the Star",
    state: "FEATURED_IN_PROGRESS",
    isNew: false,
  },
  {
    challengeId: "queens-1",
    engineId: "n-queens",
    piece: "queen",
    title: "The Quiet Room",
    state: "FEATURED_COMPLETED",
    isNew: true,
  },
];

function renderSection(props: Partial<Parameters<typeof MiniGamesSection>[0]> = {}) {
  return render(
    <MiniGamesSection
      cards={CARDS}
      comingSoon={["knight-tour", "promotion-run"]}
      exhausted={false}
      completedCount={4}
      poolSize={13}
      onPlay={vi.fn()}
      onViewAll={vi.fn()}
      {...props}
    />,
  );
}

describe("MiniGamesSection — structure", () => {
  it("renders one card per featured challenge", () => {
    renderSection();
    for (const card of CARDS) {
      expect(
        screen.getByTestId(`minigame-card-${card.challengeId}`),
      ).toBeInTheDocument();
    }
  });

  it("carries the exhausted flag on the section so a screenshot can be attributed", () => {
    renderSection();
    expect(screen.getByTestId("minigames-section")).toHaveAttribute(
      "data-exhausted",
      "false",
    );
  });

  it("renders nothing at all when the rotation resolves to no cards", () => {
    renderSection({ cards: [], comingSoon: [] });
    expect(screen.queryByTestId("minigames-section")).not.toBeInTheDocument();
  });

  it("exposes each card's state as a DOM attribute, not as a pixel", () => {
    renderSection();
    expect(
      screen.getByTestId("minigame-card-rook-rail-two-roads"),
    ).toHaveAttribute("data-state", "FEATURED_AVAILABLE");
    expect(screen.getByTestId("minigame-card-bishop-run-2")).toHaveAttribute(
      "data-state",
      "FEATURED_IN_PROGRESS",
    );
    expect(screen.getByTestId("minigame-card-queens-1")).toHaveAttribute(
      "data-state",
      "FEATURED_COMPLETED",
    );
  });
});

/* ── AC-5: the whole point of this slice ─────────────────────────────────────
 * Early Access is FREE. These assertions exist so a future Peones experiment
 * cannot be wired in by accident: any price, lock or purchase affordance on
 * this surface fails the suite before it reaches a player. */
describe("MiniGamesSection — AC-5: FREE, no payment affordance anywhere", () => {
  it("renders no price, no Peones and no unlock/purchase copy", () => {
    const { container } = renderSection();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/pe[oó]n/i);
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/unlock/i);
    expect(text).not.toMatch(/desbloque/i);
    expect(text).not.toMatch(/buy|purchase|top\s?up|comprar|recarga/i);
  });

  it("renders no locked card — every featured card is playable", () => {
    renderSection();
    for (const card of CARDS) {
      const node = screen.getByTestId(`minigame-card-${card.challengeId}`);
      expect(node).toBeEnabled();
      expect(node.getAttribute("data-state")).toMatch(/^FEATURED_/);
      expect(node).not.toHaveAttribute("data-locked", "true");
    }
  });

  /** No card may state a progression prerequisite either: featured content is
   *  fully open during Early Access, so "Complete 3 Rook exercises" would be a
   *  lie about a gate that is not there. */
  it("states no progression prerequisite on a featured card", () => {
    const { container } = renderSection();
    expect(container.textContent ?? "").not.toMatch(/complete \d+ /i);
  });
});

describe("MiniGamesSection — Early Access framing (SLICE B.1)", () => {
  /* ⛔ "labels the surface Early Access" was DELETED, not weakened. The whole
     footnote row it asserted left the surface on 2026-08-20 at the founder's
     request, so the label is genuinely not rendered any more and a softened
     version of this test would have passed while asserting nothing.
     The copy itself (`MINIGAMES_COPY.earlyAccess`) is untouched and the rules
     below still guard it — see the no-countdown test that follows. */

  /* ⛔ The three coming-soon RENDER tests were deleted with the row: they
     asserted `<li>` inertness, that a tap never fires `onPlay`, and that the
     strip is omitted when empty. None of those can be true or false any more —
     nothing renders. `comingSoon` is still accepted, still derived by
     `deriveMiniGamesHubView` and still covered by `hub-cards.test.ts`, so the
     DATA is guarded even though the surface no longer draws it. */

  /** PART 9: no countdown, no date, no "free until X". The product has made no
   *  decision about when (or whether) monetization follows, so any deadline
   *  rendered here would be a promise nobody authorized. */
  it("promises no end date and no cadence", () => {
    const { container } = renderSection();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/free until/i);
    expect(text).not.toMatch(/\bdays? left\b/i);
    expect(text).not.toMatch(/every week|weekly|cada semana|semanal/i);
    expect(text).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });
});

describe("MiniGamesSection — content freshness (SLICE B.2 / PART 8)", () => {
  it("flags a challenge that is new to this rotation", () => {
    renderSection();
    expect(
      screen.getByTestId("minigame-card-rook-rail-two-roads"),
    ).toHaveAttribute("data-new", "true");
  });

  it("does NOT flag a challenge carried over from the previous rotation", () => {
    renderSection();
    expect(screen.getByTestId("minigame-card-bishop-run-2")).toHaveAttribute(
      "data-new",
      "false",
    );
  });

  /** AC-11 as a rendering guarantee: a completed challenge stays completed and
   *  stays playable. Nothing about a rotation change resets it. */
  it("keeps a completed challenge playable as a replay", () => {
    const onPlay = vi.fn();
    renderSection({ onPlay });
    const completed = screen.getByTestId("minigame-card-queens-1");
    expect(completed).toBeEnabled();
    fireEvent.click(completed);
    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({ challengeId: "queens-1", entry: "replay" }),
    );
  });

  it("shows the all-cleared note only when every featured challenge is done", () => {
    renderSection();
    expect(screen.queryByTestId("minigames-all-clear")).not.toBeInTheDocument();
    renderSection({ exhausted: true });
    expect(screen.getByTestId("minigames-all-clear")).toBeInTheDocument();
  });
});

/* ⛔ `describe("MiniGamesSection — Coming Soon (AC-9)")` IS GONE, block and all.
 * Its three cases went with the footnote row on 2026-08-20; an empty `describe`
 * is not a placeholder, it is a suite-level FAILURE in Vitest ("No test found
 * in suite") — which is exactly how this was caught.
 * The `comingSoon` DATA is still derived and still covered by
 * `lib/minigames/__tests__/hub-cards.test.ts`; only the rendering is gone. */

/* ── AC-12 ───────────────────────────────────────────────────────────────────
 * The entry classification is computed HERE, at the tap, from the card's own
 * state — never from a render effect and never from a second source that could
 * disagree with what the card displayed. */
/* ── ⛔ NO SOURCE COMMENTARY MAY REACH THE SCREEN ────────────────────────────
 * A `/* … *\/` block written between JSX children is NOT a comment — it is
 * literal TEXT. It type-checks, it renders, and every existing test stays green
 * because none of them assert what the surface does NOT say. It shipped exactly
 * that way on 2026-08-20: the whole "footnote row was removed" rationale
 * painted itself across the Learn home, and only opening the real app caught it.
 *
 * This guard is deliberately about SHAPE, not about one string: any prose that
 * escapes into the DOM will carry one of these markers. */
describe("MiniGamesSection — no source commentary leaks into the DOM", () => {
  it("renders only the engine names, never a comment block", () => {
    const { container } = renderSection();
    const text = container.textContent ?? "";
    for (const marker of ["/*", "*/", "⛔", "⚠️", "founder", "TODO"]) {
      expect(text, `commentary leaked: ${marker}`).not.toContain(marker);
    }
  });
});

describe("MiniGamesSection — start classification (AC-12)", () => {
  it("classifies an untouched featured challenge as `featured`", () => {
    const onPlay = vi.fn();
    renderSection({ onPlay });
    fireEvent.click(screen.getByTestId("minigame-card-rook-rail-two-roads"));
    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: "rook-rail-two-roads",
        engineId: "rook-rail",
        piece: "rook",
        entry: "featured",
      }),
    );
  });

  it("classifies an in-progress engine's unplayed level as `featured`, not replay", () => {
    const onPlay = vi.fn();
    renderSection({ onPlay });
    fireEvent.click(screen.getByTestId("minigame-card-bishop-run-2"));
    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({ challengeId: "bishop-run-2", entry: "featured" }),
    );
  });

  it("fires exactly once per tap", () => {
    const onPlay = vi.fn();
    renderSection({ onPlay });
    fireEvent.click(screen.getByTestId("minigame-card-queens-1"));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});

/* ── Personal queue: naming, Library entry, progress ─────────────────────── */

describe("MiniGamesSection — the tile names the CHALLENGE, not the game family", () => {
  /** ⛔ The defect this closes: the plate read "Rook Rail" — the ENGINE — while
   *  the tile opened ONE level of it. A player who had just cleared "Two Roads"
   *  came back to a tile still labelled "Rook Rail" and could not tell whether
   *  it was the same thing. */
  it("prints the challenge title on the plate", () => {
    renderSection();
    for (const card of CARDS) {
      expect(
        screen.getByTestId(`minigame-card-${card.challengeId}`),
      ).toHaveTextContent(card.title);
    }
  });

  it("keeps the engine as the SECOND term of the accessible name", () => {
    renderSection();
    const tile = screen.getByTestId("minigame-card-rook-rail-two-roads");
    const label = tile.getAttribute("aria-label") ?? "";
    expect(label).toContain("Two Roads");
    expect(label).toContain("Rook Rail");
    // Challenge first, family second — the hierarchy is the point.
    expect(label.indexOf("Two Roads")).toBeLessThan(label.indexOf("Rook Rail"));
  });

  it("still exposes the engine to tests and CSS without printing it twice", () => {
    renderSection();
    expect(screen.getByTestId("minigame-card-queens-1")).toHaveAttribute(
      "data-engine",
      "n-queens",
    );
  });
});

describe("MiniGamesSection — Library entry", () => {
  it("offers View all, which is what keeps the other ten reachable", () => {
    const onViewAll = vi.fn();
    renderSection({ onViewAll });
    fireEvent.click(screen.getByTestId("minigames-view-all"));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it("shows ONE progress signal and no dashboard", () => {
    renderSection({ completedCount: 4, poolSize: 13 });
    expect(screen.getByTestId("minigames-progress")).toHaveTextContent("4/13");
  });

  it("names the progress for a screen reader", () => {
    renderSection({ completedCount: 4, poolSize: 13 });
    expect(screen.getByTestId("minigames-progress")).toHaveAttribute(
      "aria-label",
      "4 of 13 mini-games completed",
    );
  });
});

describe("MiniGamesSection — exhausted pool", () => {
  /** ⛔ R-7. The section returns null on zero cards, so an exhausted pool that
   *  produced an empty list would delete the whole group from the home —
   *  "you cleared everything" reading exactly like "mini-games were removed". */
  it("still renders its cards and adds the all-clear line", () => {
    renderSection({ exhausted: true });
    expect(screen.getByTestId("minigames-all-clear")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^minigame-card-/)).toHaveLength(CARDS.length);
  });

  it("says nothing about when more content arrives", () => {
    renderSection({ exhausted: true });
    const text = screen.getByTestId("minigames-all-clear").textContent ?? "";
    // ⛔ No countdown, no date, no "tomorrow": the product has not promised one.
    expect(text).not.toMatch(/tomorrow|soon|days?|hours?|\d\s*(d|h|m)\b|next week/i);
  });

  it("shows no all-clear line while anything is left", () => {
    renderSection({ exhausted: false });
    expect(screen.queryByTestId("minigames-all-clear")).toBeNull();
  });
});
