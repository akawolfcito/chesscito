import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { ChallengeCard } from "../challenge-card";
import type { ChallengeCardProps } from "../challenge-card";

// Same guardrail the FocusPassport leaf enforces: no web3 / medical claims.
const FORBIDDEN =
  /verified|on-?chain|\bNFT\b|\bmint\b|proof|brain health|cure|improves (focus|memory)/i;

const CHALLENGE: ChallengeCardProps["challenge"] = {
  durationDays: 21,
  shieldBonus: 3,
  priceLabel: "$1.99",
};

function passport(
  over: Partial<ChallengeCardProps["focusPassport"]> = {},
): ChallengeCardProps["focusPassport"] {
  return { streak: 0, totalCompleted: 0, todayDone: false, isLoading: false, ...over };
}

function filledDots(): number {
  return screen
    .getAllByTestId("focus-passport-slot")
    .filter((el) => el.getAttribute("data-filled") === "true").length;
}

afterEach(() => {
  cleanup();
});

describe("<ChallengeCard>", () => {
  it("loading: empty dot shell, no Join CTA, aria-busy", () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 5, isLoading: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: true }}
        onJoinChallenge={() => {}}
      />,
    );
    expect(screen.getAllByTestId("focus-passport-slot")).toHaveLength(7);
    expect(filledDots()).toBe(0);
    expect(screen.queryByTestId("challenge-join-cta")).toBeNull();
    expect(screen.getByTestId("challenge-card")).toHaveAttribute("aria-busy", "true");
  });

  it("offer (not joined): stat tiles + Join CTA, dots lit = streak", () => {
    const onJoin = vi.fn();
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 3, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={onJoin}
      />,
    );
    expect(filledDots()).toBe(3);
    const card = screen.getByTestId("challenge-card");
    expect(card.textContent).toMatch(/21/);
    expect(card.textContent).toMatch(/\+3/);
    expect(card.textContent).toMatch(/\$1\.99/);
    expect(card.textContent).toMatch(/21-Day Mind Challenge/i);
    const cta = screen.getByTestId("challenge-join-cta");
    fireEvent.click(cta);
    expect(onJoin).toHaveBeenCalledTimes(1);
    // No active-only affordances in the offer state.
    expect(screen.queryByTestId("challenge-active-badge")).toBeNull();
  });

  it("offer with a long streak caps lit flames at 7 (FocusPassport window)", () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 40, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    );
    expect(filledDots()).toBe(7);
  });

  it("active (joined): ACTIVE badge, Day X/21, shields count, no Join CTA", () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 1, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: true, dayOfChallenge: 1, shieldsCredited: 3 }}
        onJoinChallenge={null}
      />,
    );
    expect(screen.getByTestId("challenge-active-badge")).toBeInTheDocument();
    const card = screen.getByTestId("challenge-card");
    expect(card.textContent).toMatch(/Day 1 \/ 21/i);
    expect(card.textContent).toMatch(/3/);
    expect(screen.getByTestId("challenge-card").textContent).toMatch(/Mind Challenge/i);
    expect(screen.queryByTestId("challenge-join-cta")).toBeNull();
  });

  it("copy contains no forbidden web3 / medical terms", () => {
    const { container } = render(
      <ChallengeCard
        focusPassport={passport({ streak: 4 })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    );
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("renders ES locale copy for the Join CTA (i18n parity)", () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 2 })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
      { locale: "es" },
    );
    // The CTA must resolve to real ES copy, never the literal key path.
    expect(screen.getByTestId("challenge-join-cta").textContent ?? "").not.toMatch(
      /CHALLENGE_CARD_COPY/,
    );
  });
});
