import { describe, expect, it } from "vitest";
import { renderWithIntl, screen, fireEvent } from "@/test-utils/render-with-intl";
import { OnboardingCarousel } from "@/components/onboarding/onboarding-carousel";
import { SLIDE_VISUALS } from "@/lib/onboarding/slides";

function firstTime() {
  return renderWithIntl(
    <OnboardingCarousel initialStep={1} lastUsedMode={null} />,
  );
}

function backgroundSources(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-slide-bg] img")].map(
    (img) => img.getAttribute("src") ?? "",
  );
}

function visibleStep(container: HTMLElement): number {
  const active = container.querySelector('[data-slide-bg][data-active="true"]');
  return Number(active?.getAttribute("data-slide-bg"));
}

describe("OnboardingCarousel — chrome", () => {
  it("opens on slide 1 for a first-time visitor", () => {
    firstTime();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("advances and goes back", () => {
    firstTime();
    fireEvent.click(screen.getByRole("button", { name: /next slide/i }));
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /previous slide/i }));
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("keeps the legal footer and the language switch together", () => {
    firstTime();
    expect(screen.getByRole("link", { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /language/i })).toBeInTheDocument();
  });

  it("takes its nav labels from the copy bundle, not English literals", () => {
    renderWithIntl(<OnboardingCarousel initialStep={1} lastUsedMode={null} />, {
      locale: "es",
    });
    expect(
      screen.getByRole("button", { name: /diapositiva siguiente/i }),
    ).toBeInTheDocument();
  });
});

describe("OnboardingCarousel — backgrounds", () => {
  // Mounting only the active slide would make every tap decode a fresh image
  // and flash the blue underneath. Four slides used to share one background,
  // so this cost is new, not inherited.
  it("mounts all four illustrations at once and shows exactly one", () => {
    const { container } = firstTime();

    expect(backgroundSources(container)).toEqual([
      `${SLIDE_VISUALS[1].backgroundSrc}.png`,
      `${SLIDE_VISUALS[2].backgroundSrc}.png`,
      `${SLIDE_VISUALS[3].backgroundSrc}.png`,
      `${SLIDE_VISUALS[4].backgroundSrc}.png`,
    ]);
    expect(
      container.querySelectorAll('[data-slide-bg][data-active="true"]'),
    ).toHaveLength(1);
    expect(visibleStep(container)).toBe(1);
  });

  it("swaps which one is visible as the visitor advances", () => {
    const { container } = firstTime();
    fireEvent.click(screen.getByRole("button", { name: /next slide/i }));
    expect(visibleStep(container)).toBe(2);
  });

  it("never renders the retired gold frame", () => {
    const { container } = firstTime();
    expect(container.innerHTML).not.toContain("bg-slides.");
  });
});

describe("OnboardingCarousel — title art per locale", () => {
  it("uses the English wordmarks in English", () => {
    const { container } = renderWithIntl(
      <OnboardingCarousel initialStep={2} lastUsedMode={null} />,
    );
    const title = container.querySelector("[data-slide-title] img");
    expect(title?.getAttribute("src")).toBe(
      `${SLIDE_VISUALS[2].titleSrc.en}.png`,
    );
    expect(title?.getAttribute("alt")).toBe("Learn");
  });

  // The Spanish art spells a different word, so the alt has to change with it
  // or a screen reader announces "Learn" over a picture reading APRENDE.
  it("switches both the file and the alt in Spanish", () => {
    const { container } = renderWithIntl(
      <OnboardingCarousel initialStep={2} lastUsedMode={null} />,
      { locale: "es" },
    );
    const title = container.querySelector("[data-slide-title] img");
    expect(title?.getAttribute("src")).toBe(
      `${SLIDE_VISUALS[2].titleSrc.es}.png`,
    );
    expect(title?.getAttribute("alt")).toBe("Aprende");
  });

  it("shares one wordmark across locales on slide 1", () => {
    expect(SLIDE_VISUALS[1].titleSrc.en).toBe(SLIDE_VISUALS[1].titleSrc.es);
  });
});

describe("OnboardingCarousel — slide 4", () => {
  it("replaces the gold advance button with the mode switch", () => {
    const { container } = renderWithIntl(
      <OnboardingCarousel initialStep={4} lastUsedMode={null} />,
    );

    expect(container.querySelector(".primary-play-cta")).toBeNull();
    expect(screen.getByRole("link", { name: /training/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
  });

  it("drops a returning visitor here with their history marked", () => {
    renderWithIntl(<OnboardingCarousel initialStep={4} lastUsedMode="play" />);
    expect(screen.getByText("4 of 4")).toBeInTheDocument();
    expect(screen.getByText(/last used/i)).toBeInTheDocument();
  });

  // The shortcut skips the pitch; it must not hide it.
  it("lets a returning visitor walk back through slides 1-3", () => {
    renderWithIntl(<OnboardingCarousel initialStep={4} lastUsedMode="learn" />);
    fireEvent.click(screen.getByRole("button", { name: /previous slide/i }));
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
  });
});
