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
      completedToday={1}
      slotCount={3}
      hoursUntilNext={18}
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

  it("carries today's count on the section so a screenshot can be attributed", () => {
    renderSection();
    expect(screen.getByTestId("minigames-section")).toHaveAttribute(
      "data-completed-today",
      "1",
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

  /* ⛔ THE ALL-CLEAR NOTE'S TEST WENT WITH THE NOTE (2026-08-21). It asserted a
     sentence that is now false twice over — there is no global rotation, and
     content does not change "from time to time" for everyone — and that the
     founder never saw in smoke. The state it described is now carried by the
     compact status row, covered by the U-2/U-3/U-4 blocks below. */
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

describe("U-5 / PART 8 — View All stays a tappable pill, alone", () => {
  it("routes to the Library", () => {
    const onViewAll = vi.fn();
    renderSection({ onViewAll });
    fireEvent.click(screen.getByTestId("minigames-view-all"));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  /** ⛔ The status must NOT live inside the button. `VIEW ALL 4/13` put a
   *  number inside a control, and a number inside a control reads as part of
   *  what the control does — which is how it got heard as "nine more are
   *  available somewhere". */
  it("carries no count inside the pill", () => {
    renderSection();
    const pill = screen.getByTestId("minigames-view-all");
    expect(pill).not.toContainElement(screen.getByTestId("minigames-status"));
    expect(pill.textContent ?? "").not.toMatch(/\d/);
  });
});

describe("U-1 — the Hub never shows the catalogue size", () => {
  it("names no total beyond today's slots", () => {
    renderSection({ completedToday: 2, slotCount: 3, hoursUntilNext: 18 });
    const row = screen.getByTestId("minigames-status").textContent ?? "";
    expect(row).toContain("2/3");
    // 13 is the healthy pool. It must not reach this surface in any form.
    expect(row).not.toMatch(/13/);
  });
});

describe("U-2 — the four daily states render correctly", () => {
  it.each([0, 1, 2, 3])("renders %i/3 today", (done) => {
    renderSection({ completedToday: done, slotCount: 3, hoursUntilNext: 18 });
    expect(screen.getByTestId("minigames-today")).toHaveTextContent(`${done}/3 today`);
  });

  it("reports the true slot count when the catalogue is running out", () => {
    renderSection({ completedToday: 1, slotCount: 2, hoursUntilNext: 18 });
    expect(screen.getByTestId("minigames-today")).toHaveTextContent("1/2 today");
  });
});

describe("U-3 — the refill hint follows consumption, not the clock", () => {
  /** ⛔ Null at 0/3 is a PRODUCT state: nothing has been consumed, so nothing
   *  is charging, and a countdown there is the noise that trains people to
   *  stop reading this row — the same failure as the sentence it replaced. */
  it("hides the timer at 0/3", () => {
    renderSection({ completedToday: 0, hoursUntilNext: null });
    expect(screen.queryByTestId("minigames-refill")).toBeNull();
    expect(screen.getByTestId("minigames-status")).toHaveAttribute("data-hours", "none");
  });

  it("shows it once anything is consumed", () => {
    renderSection({ completedToday: 1, hoursUntilNext: 18 });
    expect(screen.getByTestId("minigames-refill")).toHaveTextContent("18h");
  });

  it("still shows it at 3/3 — complete and anticipatory, never blocked", () => {
    renderSection({ completedToday: 3, slotCount: 3, hoursUntilNext: 6 });
    expect(screen.getByTestId("minigames-today")).toHaveTextContent("3/3 today");
    expect(screen.getByTestId("minigames-refill")).toHaveTextContent("6h");
  });

  /** ⛔ D-11 at the surface: an exhausted pool promises nothing. */
  it("hides it when nothing will ever refill", () => {
    renderSection({ completedToday: 3, slotCount: 3, hoursUntilNext: null });
    expect(screen.queryByTestId("minigames-refill")).toBeNull();
  });

  it("names the hours for a screen reader without printing a sentence", () => {
    renderSection({ completedToday: 1, hoursUntilNext: 18 });
    expect(screen.getByTestId("minigames-refill")).toHaveAttribute(
      "aria-label",
      "New challenges in about 18 hours",
    );
  });

  it("shows hours, never a second-by-second countdown", () => {
    renderSection({ completedToday: 1, hoursUntilNext: 18 });
    expect(screen.getByTestId("minigames-refill").textContent ?? "").not.toMatch(
      /\d+:\d+/,
    );
  });
});

describe("U-4 / U-6 — no prose under the rail", () => {
  /** The founder never noticed the explanatory sentence in smoke, which is the
   *  evidence that a sentence there does no work. It was DELETED, not reworded. */
  it("renders no all-clear sentence in any state", () => {
    for (const done of [0, 1, 2, 3]) {
      const { unmount } = renderSection({
        completedToday: done,
        hoursUntilNext: done > 0 ? 18 : null,
      });
      expect(screen.queryByTestId("minigames-all-clear")).toBeNull();
      unmount();
    }
  });

  it("says nothing about rotation, tomorrow, or content changing", () => {
    renderSection({ completedToday: 3, hoursUntilNext: 18 });
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/from time to time|tomorrow|come back|cleared them all/i);
  });

  it("adds exactly ONE row under the tiles", () => {
    renderSection();
    const tiles = screen.getByTestId("minigames-section");
    const siblings = Array.from(tiles.parentElement?.children ?? []);
    /* Tile group + footer row. Nothing else — the leading divider left with
       the Exercises tile it used to separate from (2026-08-30). A divider at
       the head of the rail divides nothing. */
    expect(siblings).toHaveLength(2);
    expect(screen.queryByTestId("learn-rail-divider")).not.toBeInTheDocument();
  });
});

describe("U-7 — no Peones affordance while monetization is disabled", () => {
  /** ⛔ A price badge beside free content reads as if the free content costs
   *  money. Nothing renders it until acceleration is actually enabled. */
  it("renders no price, no Peones badge and no unlock CTA at 3/3", () => {
    renderSection({ completedToday: 3, slotCount: 3, hoursUntilNext: 18 });
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/pe(o|ó)n|unlock|\$|♙/i);
    expect(screen.queryByTestId("minigames-unlock")).toBeNull();
  });
});
