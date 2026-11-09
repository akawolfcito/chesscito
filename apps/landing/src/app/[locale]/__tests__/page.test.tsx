import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test-utils/render-with-intl";

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));

async function renderPage() {
  const { default: Page } = await import("@/app/[locale]/page");
  return renderWithIntl(await Page({ params: Promise.resolve({ locale: "en" }) }));
}

describe("[locale] onboarding page", () => {
  it("opens on slide 1 for a first-time visitor (no cookie)", async () => {
    document.cookie = "chesscito_onboarded=; max-age=0";
    document.cookie = "chesscito_preferred_mode=; max-age=0";
    await renderPage();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("falls back to slide 1 for a corrupt cookie (missing mode)", async () => {
    document.cookie = "chesscito_onboarded=; max-age=0";
    document.cookie = "chesscito_preferred_mode=; max-age=0";
    document.cookie = "chesscito_onboarded=true";
    await renderPage();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    expect(screen.queryByText(/last used/i)).not.toBeInTheDocument();
  });

  /**
   * There is no second screen any more. A returning visitor gets the same
   * carousel, opened on the choice slide with their previous pick labelled —
   * which is why this can be a plain render assertion now, where it used to
   * have to inspect the returned element because `WelcomeBack` was an async
   * Server Component the test renderer could not mount.
   */
  it("drops a returning visitor on slide 4 with their mode labelled", async () => {
    document.cookie = "chesscito_onboarded=; max-age=0";
    document.cookie = "chesscito_preferred_mode=; max-age=0";
    document.cookie = "chesscito_onboarded=true";
    document.cookie = "chesscito_preferred_mode=learn";
    await renderPage();

    expect(screen.getByText("4 of 4")).toBeInTheDocument();
    expect(screen.getByText(/last used/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /training/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
  });
});
