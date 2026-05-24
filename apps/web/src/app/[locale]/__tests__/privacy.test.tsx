import { describe, it, expect, vi } from "vitest";
import { renderWithIntl, screen } from "@/test-utils/render-with-intl";

// LegalPageShell is a client component using useRouter from
// @/i18n/navigation. Mock the navigation hook so the standalone page
// can render outside an AppRouter context.
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

// Privacy page is now an async server component (Stage C migration).
// `next-intl/server` is stubbed globally in vitest.setup.ts to resolve
// against the EN bundle, so each test just awaits the component and
// wraps the result in renderWithIntl (LegalPageShell uses
// useTranslations and needs the client provider).

import PrivacyPage from "../privacy/page";

describe("Privacy page — Coach session memory section", () => {
  it("renders the PRIVACY_COACH_COPY heading", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(
      screen.getByText(/Coach Match History \(Chesscito PRO\)/i),
    ).toBeInTheDocument();
  });

  it("renders the para1 retention disclosure", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/365 days from creation/i)).toBeInTheDocument();
  });

  it("renders the 'Your control' subheading + body", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/Your control:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Deletion is permanent and immediate/i),
    ).toBeInTheDocument();
  });

  it("renders the 'What's stored' subheading + body — game metadata, not move list", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/What's stored:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We do NOT store your full move list/i),
    ).toBeInTheDocument();
  });

  it("renders the 'Lost wallet access' subheading + body — out-of-band recourse", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/Lost wallet access:/i)).toBeInTheDocument();
    expect(screen.getByText(/support@chesscito\.com/i)).toBeInTheDocument();
  });
});
