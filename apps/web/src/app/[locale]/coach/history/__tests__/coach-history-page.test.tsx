import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

vi.mock("@/lib/coach/use-coach-credits", () => ({
  useCoachCredits: () => ({ credits: 0 }),
}));
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => false,
}));

vi.mock("@/components/coach/ask-luz-banner", () => ({
  AskLuzBanner: () => <div data-testid="ask-luz-banner" />,
}));
vi.mock("@/components/coach/coach-history-delete-panel", () => ({
  CoachHistoryDeletePanel: () => <div data-testid="coach-history-delete-panel" />,
}));
vi.mock("@/components/ui/contextual-header", () => ({
  ContextualHeader: ({ title }: { title: string }) => (
    <div data-testid="ctx-header">{title}</div>
  ),
}));
vi.mock("@/components/ui/tile-icon-slot", () => ({
  TileIconSlot: () => <div data-testid="tile-icon" />,
}));

vi.mock("@/components/coach/coach-history", () => ({
  CoachHistory: ({
    onSelectEntry,
  }: {
    onSelectEntry: (e: { gameId: string }) => void;
  }) => (
    <button
      data-testid="entry-row"
      onClick={() => onSelectEntry({ gameId: "g123" } as never)}
    >
      tap
    </button>
  ),
}));

import CoachHistoryPage from "../page";

describe("/coach/history tap-entry routing", () => {
  it("tap entry → push /coach/[gameId] with wallet query", () => {
    pushMock.mockReset();
    render(<CoachHistoryPage />);
    fireEvent.click(screen.getByTestId("entry-row"));
    expect(pushMock).toHaveBeenCalledWith(
      "/coach/g123?wallet=0x1111111111111111111111111111111111111111",
    );
  });

  it("legacy selected branch is gone — no inline CoachPanel mounted", () => {
    render(<CoachHistoryPage />);
    expect(screen.queryByTestId("coach-panel")).toBeNull();
  });
});
