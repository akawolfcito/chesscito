import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { FocusPassport } from "../focus-passport";

const FORBIDDEN = /verified|on-?chain|\bNFT\b|\bmint\b|proof|brain health|cure|improves (focus|memory)/i;

afterEach(() => {
  cleanup();
});

function filledCount(): number {
  return screen
    .getAllByTestId("focus-passport-slot")
    .filter((el) => el.getAttribute("data-filled") === "true").length;
}

describe("<FocusPassport>", () => {
  it("loading: renders 7 slots, none filled (no false days), aria-busy", () => {
    render(
      <FocusPassport streak={5} totalCompleted={9} todayDone={true} isLoading={true} />,
    );
    expect(screen.getAllByTestId("focus-passport-slot")).toHaveLength(7);
    expect(filledCount()).toBe(0);
    expect(screen.getByTestId("focus-passport")).toHaveAttribute("aria-busy", "true");
  });

  it("empty (streak 0): 0 filled flames, no title (start-your-streak removed)", () => {
    render(
      <FocusPassport streak={0} totalCompleted={0} todayDone={false} isLoading={false} />,
    );
    expect(filledCount()).toBe(0);
    expect(screen.queryByTestId("focus-passport-title")).toBeNull();
  });

  it("day1 (streak 1): 1 filled + day 1 copy", () => {
    render(
      <FocusPassport streak={1} totalCompleted={1} todayDone={true} isLoading={false} />,
    );
    expect(filledCount()).toBe(1);
    expect(screen.getByTestId("focus-passport-title").textContent).toMatch(/day 1/i);
  });

  it("building (streak 3): 3 filled + N day streak copy", () => {
    render(
      <FocusPassport streak={3} totalCompleted={3} todayDone={true} isLoading={false} />,
    );
    expect(filledCount()).toBe(3);
    expect(screen.getByTestId("focus-passport-title").textContent).toMatch(/3 day streak/i);
  });

  it("week (streak 10): caps at 7 filled + 7-day focus copy", () => {
    render(
      <FocusPassport streak={10} totalCompleted={12} todayDone={true} isLoading={false} />,
    );
    expect(filledCount()).toBe(7);
    expect(screen.getByTestId("focus-passport-title").textContent).toMatch(/7-day focus/i);
  });

  it("copy contains no forbidden web3 / medical terms", () => {
    const { container } = render(
      <FocusPassport streak={4} totalCompleted={6} todayDone={false} isLoading={false} />,
    );
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("renders flame variants: blue past + color current + gray pending (streak 3, todayDone)", () => {
    render(
      <FocusPassport streak={3} totalCompleted={3} todayDone={true} isLoading={false} />,
    );
    const kinds = screen
      .getAllByTestId("focus-passport-slot")
      .map((el) => el.getAttribute("data-kind"));
    expect(kinds).toEqual(["blue", "blue", "color", "gray", "gray", "gray", "gray"]);
  });

  it("glows the next-pending flame when today is not yet done", () => {
    render(
      <FocusPassport streak={3} totalCompleted={3} todayDone={false} isLoading={false} />,
    );
    const slots = screen.getAllByTestId("focus-passport-slot");
    expect(slots.map((el) => el.getAttribute("data-kind"))).toEqual([
      "blue",
      "blue",
      "blue",
      "gray",
      "gray",
      "gray",
      "gray",
    ]);
    expect(slots[3].getAttribute("data-glow")).toBe("true");
  });

  it("loading renders all gray flames with no glow", () => {
    render(
      <FocusPassport streak={5} totalCompleted={9} todayDone={true} isLoading={true} />,
    );
    const slots = screen.getAllByTestId("focus-passport-slot");
    expect(slots.every((el) => el.getAttribute("data-kind") === "gray")).toBe(true);
    expect(slots.every((el) => el.getAttribute("data-glow") === null)).toBe(true);
  });
});
