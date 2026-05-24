import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { MasteryTile } from "../mastery-tile";

/** Phase 5 commit 1 — <MasteryTile> per-state rendering (design-lock §1.3 + §9.3).
 *
 *  4 asserts:
 *    1. mastered  → 3 stars rendered, data-state=mastered, golden glow class
 *    2. in-progress → partial stars + sub "2/3", data-state=in-progress
 *    3. locked-buildable → no stars rendered, data-state=locked-buildable
 *    4. coming-soon → "Coming soon" sub + wax-seal element, data-state=coming-soon */

afterEach(() => {
  cleanup();
});

describe("<MasteryTile> — per-state rendering", () => {
  it("(1) mastered: renders ★★★ stars; data-state=mastered; class includes is-mastered (golden glow)", () => {
    const { container } = render(
      <MasteryTile
        piece="rook"
        state="mastered"
        starsEarned={3}
        starsTotal={3}
        onTap={vi.fn()}
      />,
    );

    const tile = container.querySelector('[data-component="mastery-tile"]');
    expect(tile).toBeInTheDocument();
    expect(tile?.getAttribute("data-state")).toBe("mastered");
    expect(tile?.className).toMatch(/is-mastered/);

    const stars = screen.getByTestId("mastery-stars");
    expect(stars.textContent).toBe("★★★");
  });

  it("(2) in-progress: renders partial stars + sub '2/3'; data-state=in-progress", () => {
    const { container } = render(
      <MasteryTile
        piece="bishop"
        state="in-progress"
        starsEarned={2}
        starsTotal={3}
        onTap={vi.fn()}
      />,
    );

    const tile = container.querySelector('[data-component="mastery-tile"]');
    expect(tile?.getAttribute("data-state")).toBe("in-progress");

    const stars = screen.getByTestId("mastery-stars");
    expect(stars.getAttribute("data-stars-earned")).toBe("2");
    expect(stars.getAttribute("data-stars-total")).toBe("3");

    const sub = screen.getByTestId("mastery-sub");
    expect(sub.textContent).toBe("2/3");
  });

  it("(3) locked-buildable: renders no stars element; data-state=locked-buildable; dim class applied", () => {
    const { container } = render(
      <MasteryTile
        piece="knight"
        state="locked-buildable"
        starsEarned={0}
        starsTotal={3}
        onTap={vi.fn()}
      />,
    );

    const tile = container.querySelector('[data-component="mastery-tile"]');
    expect(tile?.getAttribute("data-state")).toBe("locked-buildable");
    expect(tile?.className).toMatch(/is-locked-buildable/);
    expect(screen.queryByTestId("mastery-stars")).not.toBeInTheDocument();
  });

  it("(4) coming-soon: renders 'Coming soon' sub + wax-seal element; data-state=coming-soon", () => {
    const { container } = render(
      <MasteryTile
        piece="queen"
        state="coming-soon"
        starsEarned={0}
        starsTotal={3}
        onTap={vi.fn()}
      />,
    );

    const tile = container.querySelector('[data-component="mastery-tile"]');
    expect(tile?.getAttribute("data-state")).toBe("coming-soon");

    expect(screen.queryByTestId("mastery-stars")).not.toBeInTheDocument();

    const sub = screen.getByTestId("mastery-sub");
    expect(sub.textContent).toBe("Coming soon");

    expect(screen.getByTestId("mastery-wax-seal")).toBeInTheDocument();
  });
});
