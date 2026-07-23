import { describe, expect, it } from "vitest";
import { OnboardingCarousel } from "@/components/onboarding/onboarding-carousel";
import { renderWithIntl, screen, fireEvent } from "@/test-utils/render-with-intl";

describe("OnboardingCarousel", () => {
  it("renders slide 1 with a 1/4 progress counter and no Skip control", () => {
    renderWithIntl(<OnboardingCarousel />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /two ways into chess/i })).toBeInTheDocument();
    expect(screen.queryByText(/skip/i)).not.toBeInTheDocument();
  });

  /**
   * Slide 1's only job is orientation: this is chess, and there are two modes.
   * It used to lead with "Turn chess into your daily focus ritual", which is
   * slide 2's pitch, and spent its one moment of attention on a message the
   * next screen makes better. The mode pills carry the whole payload, so they
   * name the two paths rather than reading as loose feature chips.
   */
  it("slide 1 names both modes and sells neither", () => {
    renderWithIntl(<OnboardingCarousel />);
    expect(screen.getByText("Learn")).toBeInTheDocument();
    expect(screen.getByText("From zero")).toBeInTheDocument();
    expect(screen.getByText("Play")).toBeInTheDocument();
    expect(screen.getByText("Full matches")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  /**
   * NEXT, NEXT, NEXT, START. The advance button never claims to start
   * anything, so START means one thing everywhere: you are going in. That is
   * also the word `welcome-back.tsx` puts in the same spot for a returning
   * player, who never sees this carousel again.
   */
  it("labels the three advance buttons NEXT and only the final CTA START", () => {
    renderWithIntl(<OnboardingCarousel />);

    expect(screen.getByRole("button", { name: "NEXT" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "START" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));

    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "NEXT" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "START" })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
  });

  it("advances slide 1 -> 2 -> 3 -> 4 via the CTA button", () => {
    renderWithIntl(<OnboardingCarousel />);

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /decide better in 21 days/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /chesscito pro includes the season pass/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /learn the pieces first/i })).toBeInTheDocument();
  });

  /**
   * Slides 2 and 3 are the only place the paid layer is ever explained: the
   * cookie sends returning visitors straight past the carousel. Each screen
   * states its price once, as a line of text. A price rendered as a pill reads
   * as an item you own, sitting in the same tray as the thing it buys.
   */
  it("slide 2 states the Season Pass price once and never mentions PRO", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));

    expect(screen.getByText("Season Pass, $0.99")).toBeInTheDocument();
    expect(screen.queryByText(/PRO/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reward/i)).not.toBeInTheDocument();
  });

  /**
   * "Play free" on slide 3 reinstated the very price inversion slide 4 was
   * rebuilt to remove: the visitor read "free" here, then one screen later we
   * recommend Learn, which runs through a $0.99 Season Pass.
   */
  it("slide 3 leads with the PRO argument and never says free", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));

    expect(screen.getByText("Chesscito PRO, $1.99")).toBeInTheDocument();
    expect(screen.queryByText(/free/i)).not.toBeInTheDocument();
  });

  it("slide 4 offers Learn as the only CTA, with Play reachable via a text link", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));

    expect(screen.getByRole("link", { name: "START" })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
    expect(screen.getByRole("link", { name: /jump to play/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=play",
    );
    // The recommendation only holds if Play never grows back into a rival
    // button; both destinations stay reachable, one of them quietly.
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("always shows the Privacy/Terms/Support legal footer", () => {
    renderWithIntl(<OnboardingCarousel />);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("back arrow is disabled on slide 1, enabled after advancing, and navigates back", () => {
    renderWithIntl(<OnboardingCarousel />);
    const back = screen.getByRole("button", { name: /previous slide/i });
    expect(back).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(back).not.toBeDisabled();

    fireEvent.click(back);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("top forward arrow advances a slide same as the CTA button", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /next slide/i }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });

  it("forward arrow is disabled on slide 4 (no slide 5); back arrow returns to slide 3", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByRole("heading", { name: /learn the pieces first/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next slide/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /previous slide/i }));
    expect(
      screen.getByRole("heading", { name: /chesscito pro includes the season pass/i }),
    ).toBeInTheDocument();
  });

  it("swipes left to advance and right to go back", () => {
    renderWithIntl(<OnboardingCarousel />);
    const area = screen.getByTestId("slide-swipe-area");

    fireEvent.touchStart(area, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 50, clientY: 100 }] });
    expect(screen.getByText("2 / 4")).toBeInTheDocument();

    fireEvent.touchStart(area, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 300, clientY: 100 }] });
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });
});
