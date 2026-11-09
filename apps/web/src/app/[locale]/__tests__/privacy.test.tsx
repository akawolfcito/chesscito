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

describe("Privacy page — processing and Coach disclosure", () => {
  it("renders the PRIVACY_COACH_COPY heading", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(
      screen.getByText(/Coach Analysis and Match History/i),
    ).toBeInTheDocument();
  });

  it("renders retention settings without promising deletion of every copy", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/one-year expiry setting/i)).toBeInTheDocument();
  });

  it("renders the limited scope of Coach history deletion", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/Deleting Coach history:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/If a storage service fails during deletion, some targeted data may remain/i),
    ).toBeInTheDocument();
  });

  it("discloses that saved games include moves associated with the wallet", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/What Coach stores:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Saved game records include the move list/i),
    ).toBeInTheDocument();
  });

  it("routes lost-wallet and privacy requests to Support without guaranteeing deletion", async () => {
    const tree = await PrivacyPage();
    renderWithIntl(tree);
    expect(screen.getByText(/Other requests and lost wallet access:/i)).toBeInTheDocument();
    expect(screen.getByText(/We may need evidence that you control the relevant wallet or account/i)).toBeInTheDocument();
  });
});
