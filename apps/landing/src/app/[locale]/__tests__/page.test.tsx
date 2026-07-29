import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test-utils/render-with-intl";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
  }),
}));

async function renderPage() {
  const { default: Page } = await import("@/app/[locale]/page");
  return renderWithIntl(<Page />);
}

describe("[locale] onboarding page", () => {
  it("opens on slide 1 for a first-time visitor (no cookie)", async () => {
    cookieStore.clear();
    await renderPage();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("falls back to slide 1 for a corrupt cookie (missing mode)", async () => {
    cookieStore.clear();
    cookieStore.set("chesscito_onboarded", "true");
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
    cookieStore.clear();
    cookieStore.set("chesscito_onboarded", "true");
    cookieStore.set("chesscito_preferred_mode", "learn");
    await renderPage();

    expect(screen.getByText("4 of 4")).toBeInTheDocument();
    expect(screen.getByText(/last used/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /training/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
  });
});
