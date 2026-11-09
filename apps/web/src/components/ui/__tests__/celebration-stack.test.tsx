import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CelebrationStack } from "@/components/ui/celebration-stack";

function renderStack(props: Partial<React.ComponentProps<typeof CelebrationStack>> = {}) {
  return render(
    <CelebrationStack
      text="WELL DONE"
      stroke="#000"
      accent="#fc0"
      avatarSlot="exercises.avatar-fun"
      {...props}
    />,
  );
}

describe("CelebrationStack", () => {
  it("reserves the lesson box even with no lesson to show", () => {
    const { container } = renderStack();
    const lesson = container.querySelector(".overlay-lesson");
    expect(lesson).not.toBeNull();
    expect(lesson?.textContent).toBe("");
  });

  it("renders the lesson when there is one, in the same box", () => {
    const { container } = renderStack({ lesson: "You learned: the fork" });
    expect(container.querySelectorAll(".overlay-lesson")).toHaveLength(1);
    expect(container.querySelector(".overlay-lesson")?.textContent).toBe(
      "You learned: the fork",
    );
  });

  it("never applies a bottom margin to the headline block (founder 2026-07-29)", () => {
    const { container } = renderStack();
    const headlineBlock = container.querySelector(".absolute.bottom-full");
    expect(headlineBlock).not.toBeNull();
    expect(headlineBlock?.className).not.toMatch(/-?mb-/);
  });

  it("sizes the avatar frame at 13.5rem, not the retired 20rem", () => {
    const { container } = renderStack();
    expect(container.querySelector(".h-\\[13\\.5rem\\]")).not.toBeNull();
    expect(container.querySelector(".h-80")).toBeNull();
  });

  it("layers effect children inside the avatar frame", () => {
    const { container } = renderStack({
      children: <div data-testid="confetti" />,
    });
    const frame = container.querySelector(".h-\\[13\\.5rem\\]");
    expect(frame?.querySelector('[data-testid="confetti"]')).not.toBeNull();
  });
});

/**
 * The reason this component exists. The Daily sheet used to carry a COPY of
 * these measurements and it went stale — it kept the `-mb-6` and the 20rem
 * wolf that the exercises overlay had already been corrected away from, and
 * dropped the lesson box entirely.
 *
 * Asserting on the sources is the only way to catch the reintroduction: a
 * consumer that re-declares the geometry inline still renders, still passes
 * every behavioural test, and silently forks the design again.
 */
describe("celebration geometry is not re-declared by its consumers", () => {
  const CONSUMERS = [
    "src/components/daily/daily-tactic-sheet.tsx",
    "src/components/exercises/mission-panel-candy.tsx",
  ];

  /** Measurements that belong to CelebrationStack alone. Each one is a class
   *  the two copies actually disagreed on. */
  const OWNED_GEOMETRY = [
    // ⚠️ Was a bare `w-[92vw]` until 2026-08-11. That is 92% of the VIEWPORT,
    // not of the 390px app frame, so on desktop web the block grew past the
    // frame and the lesson line was clipped at both ends. Capped with `min()`,
    // which is a no-op below ~424px — mobile, the only channel that ships, is
    // unchanged.
    "w-[min(92vw,var(--app-max-width))]",
    "h-[13.5rem]",
    "h-[12.5rem]",
    "h-80",
    "h-72",
    "-mb-6",
  ];

  for (const consumer of CONSUMERS) {
    it(`${consumer} declares none of it`, () => {
      const source = readFileSync(join(process.cwd(), consumer), "utf8");
      for (const measurement of OWNED_GEOMETRY) {
        expect(source, measurement).not.toContain(measurement);
      }
    });
  }

  it("CelebrationStack is the one place that does", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/ui/celebration-stack.tsx"),
      "utf8",
    );
    expect(source).toContain("w-[min(92vw,var(--app-max-width))]");
    // The bare form must not come back: it is the exact bug that clipped the
    // lesson line on web, and it reads as correct next to the capped one.
    expect(source).not.toContain("w-[92vw]");
    expect(source).toContain("h-[13.5rem]");
    expect(source).toContain("h-[12.5rem]");
  });
});
