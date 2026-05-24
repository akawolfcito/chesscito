import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl as render, screen, fireEvent, waitFor } from "@/test-utils/render-with-intl";
import { CoachHistoryDeletePanel } from "../coach-history-delete-panel";

const useAccountMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
  useSignMessage: () => ({
    signMessageAsync: vi.fn(async () => "0x" + "11".repeat(65)),
  }),
}));

const useCoachHistoryCountMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/use-coach-history-count", () => ({
  useCoachHistoryCount: useCoachHistoryCountMock,
}));

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

// Post-refactor (2026-05-1X): the destructive surface is collapsed by
// default behind a "Manage history" toggle so it does not visually
// compete with the main Training Journal content. Tests that assert
// against the delete UI must expand the toggle first.
function expandManageToggle() {
  fireEvent.click(screen.getByRole("button", { name: /Manage history/i }));
}

describe("<CoachHistoryDeletePanel>", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    useCoachHistoryCountMock.mockReset();
    vi.restoreAllMocks();

    useAccountMock.mockReturnValue({ address: VALID_WALLET });
    useCoachHistoryCountMock.mockReturnValue({
      rowCount: 5,
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  it("renders the panel title from COACH_COPY", () => {
    render(<CoachHistoryDeletePanel />);
    expandManageToggle();
    expect(screen.getByText(/Delete all your Coach history/i)).toBeInTheDocument();
  });

  it("disables the delete button when rowCount=0 (red-team P0-7)", () => {
    useCoachHistoryCountMock.mockReturnValue({
      rowCount: 0,
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<CoachHistoryDeletePanel />);
    expandManageToggle();
    expect(screen.getByRole("button", { name: /Delete history/i })).toBeDisabled();
  });

  it("enables the delete button when rowCount>0", () => {
    render(<CoachHistoryDeletePanel />);
    expandManageToggle();
    expect(screen.getByRole("button", { name: /Delete history/i })).toBeEnabled();
  });

  it("opens the confirm sheet when delete button clicked", () => {
    render(<CoachHistoryDeletePanel />);
    expandManageToggle();
    fireEvent.click(screen.getByRole("button", { name: /Delete history/i }));
    expect(screen.getByText(/Delete all history\?/i)).toBeInTheDocument();
  });

  it("happy path: confirm → sign → DELETE → success status text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ deleted: true, supabase_rows: 5 }),
        }),
      ),
    );
    const refetch = vi.fn();
    useCoachHistoryCountMock.mockReturnValue({ rowCount: 5, isLoading: false, refetch });

    render(<CoachHistoryDeletePanel />);
    expandManageToggle();
    fireEvent.click(screen.getByRole("button", { name: /Delete history/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete everything/i }));

    await waitFor(() =>
      expect(screen.getByText(/All Coach data cleared/i)).toBeInTheDocument(),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("DELETE non-2xx → renders errorToast inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "boom" }),
        }),
      ),
    );

    render(<CoachHistoryDeletePanel />);
    expandManageToggle();
    fireEvent.click(screen.getByRole("button", { name: /Delete history/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete everything/i }));

    await waitFor(() =>
      expect(screen.getByText(/Could not delete — please retry/i)).toBeInTheDocument(),
    );
  });

  it("returns null when no wallet address (not connected)", () => {
    useAccountMock.mockReturnValue({ address: undefined });
    const { container } = render(<CoachHistoryDeletePanel />);
    expect(container.firstChild).toBeNull();
  });
});
