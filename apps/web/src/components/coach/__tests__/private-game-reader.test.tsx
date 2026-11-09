import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen, waitFor, fireEvent } from "@/test-utils/render-with-intl";
import { PrivateGameReader } from "../private-game-reader";
import { CoachHistory } from "../coach-history";

const access = vi.hoisted(() => ({
  headers: null as Record<string, string> | null,
  authorize: vi.fn(), invalidate: vi.fn(), pending: false, error: false, canAuthorize: true,
}));
vi.mock("@/lib/coach/use-history-read-access", () => ({ useHistoryReadAccess: () => access }));
vi.mock("@/app/[locale]/coach/[gameId]/coach-game-client", () => ({
  CoachGameClient: ({ gameRecord }: { gameRecord: { gameId: string } | null }) => <div>{gameRecord?.gameId ?? "Missing fixture"}</div>,
}));
vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
const wallet = `0x${"1".repeat(40)}` as `0x${string}`;
const other = `0x${"2".repeat(40)}` as `0x${string}`;
const gameId = "550e8400-e29b-41d4-a716-446655440000";
describe("private read consumers", () => {
  beforeEach(() => {
    access.headers = null;
    access.authorize.mockReset();
    access.invalidate.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });
  it("does not fetch history or games before explicit wallet confirmation", () => {
    render(<CoachHistory walletAddress={wallet} credits={0} onSelectEntry={() => {}} />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm wallet" }));
    expect(access.authorize).toHaveBeenCalledTimes(1);
  });
  it("does not fetch or render the detail record before authorization", () => {
    render(<PrivateGameReader gameId={gameId} wallet={wallet} locale="en" />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText(gameId)).not.toBeInTheDocument();
  });
  it("passes proof in headers and clears the displayed record when authorization is lost", async () => {
    access.headers = { "x-test-proof": "fixture" };
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ gameId }) } as Response);
    const { rerender } = render(<PrivateGameReader gameId={gameId} wallet={wallet} locale="es" />);
    await waitFor(() => expect(screen.getByText(gameId)).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("locale=es"), expect.objectContaining({
      headers: access.headers, cache: "no-store",
    }));
    access.headers = null;
    rerender(<PrivateGameReader gameId={gameId} wallet={other} locale="es" />);
    expect(screen.queryByText(gameId)).not.toBeInTheDocument();
  });
  it("invalidates a server-rejected proof instead of rendering private data", async () => {
    access.headers = { "x-test-proof": "fixture" };
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);
    render(<PrivateGameReader gameId={gameId} wallet={wallet} locale="en" />);
    await waitFor(() => expect(access.invalidate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(gameId)).not.toBeInTheDocument();
  });
});
