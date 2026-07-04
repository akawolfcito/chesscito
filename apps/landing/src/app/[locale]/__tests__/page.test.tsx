import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test-utils/render-with-intl";
import { WelcomeBack } from "@/components/onboarding/welcome-back";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
  }),
}));

describe("[locale] onboarding page", () => {
  it("renders the full carousel for a first-time visitor (no cookie)", async () => {
    cookieStore.clear();
    const { default: Page } = await import("@/app/[locale]/page");
    renderWithIntl(<Page />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("falls back to the full carousel for a corrupt cookie (missing mode)", async () => {
    cookieStore.clear();
    cookieStore.set("chesscito_onboarded", "true");
    const { default: Page } = await import("@/app/[locale]/page");
    renderWithIntl(<Page />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("branches to WelcomeBack with the stored mode when a valid cookie is present", async () => {
    // WelcomeBack is an async Server Component — React DOM's test renderer
    // can't mount an unresolved child promise, so this checks the element
    // Page() returns (type + props) rather than deep-rendering it. The
    // WelcomeBack render itself is covered by welcome-back.test.tsx.
    cookieStore.clear();
    cookieStore.set("chesscito_onboarded", "true");
    cookieStore.set("chesscito_preferred_mode", "learn");
    const { default: Page } = await import("@/app/[locale]/page");
    const element = Page();
    expect(element.type).toBe(WelcomeBack);
    expect(element.props.preferredMode).toBe("learn");
  });
});
