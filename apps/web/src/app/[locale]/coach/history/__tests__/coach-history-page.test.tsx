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
    onSelectEntry: (e: {
      gameId: string;
      game: { result: string; mintedTokenId?: string };
    }) => void;
  }) => (
    <>
      <button
        data-testid="entry-row-loss"
        onClick={() =>
          onSelectEntry({
            gameId: "g123",
            game: { result: "loss" },
          } as never)
        }
      >
        tap-loss
      </button>
      <button
        data-testid="entry-row-win-unclaimed"
        onClick={() =>
          onSelectEntry({
            gameId: "g456",
            game: { result: "win" },
          } as never)
        }
      >
        tap-win-unclaimed
      </button>
      <button
        data-testid="entry-row-win-claimed"
        onClick={() =>
          onSelectEntry({
            gameId: "g789",
            game: { result: "win", mintedTokenId: "42" },
          } as never)
        }
      >
        tap-win-claimed
      </button>
    </>
  ),
}));

import CoachHistoryPage from "../page";

describe("/coach/history tap-entry routing", () => {
  it("tap loss entry → push /coach/[gameId] with wallet query (no focus)", () => {
    pushMock.mockReset();
    render(<CoachHistoryPage />);
    fireEvent.click(screen.getByTestId("entry-row-loss"));
    expect(pushMock).toHaveBeenCalledWith(
      "/coach/g123?wallet=0x1111111111111111111111111111111111111111",
    );
  });

  it("tap win+!minted entry → push with focus=save (Save Later, 2026-05-31)", () => {
    pushMock.mockReset();
    render(<CoachHistoryPage />);
    fireEvent.click(screen.getByTestId("entry-row-win-unclaimed"));
    expect(pushMock).toHaveBeenCalledWith(
      "/coach/g456?wallet=0x1111111111111111111111111111111111111111&focus=save",
    );
  });

  it("tap win+minted entry → no focus param (already saved)", () => {
    pushMock.mockReset();
    render(<CoachHistoryPage />);
    fireEvent.click(screen.getByTestId("entry-row-win-claimed"));
    expect(pushMock).toHaveBeenCalledWith(
      "/coach/g789?wallet=0x1111111111111111111111111111111111111111",
    );
  });

  it("legacy selected branch is gone — no inline CoachPanel mounted", () => {
    render(<CoachHistoryPage />);
    expect(screen.queryByTestId("coach-panel")).toBeNull();
  });
});
