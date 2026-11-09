import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen, waitFor } from "@/test-utils/render-with-intl";
import { PrivateGameReader } from "../private-game-reader";
import { CoachHistory } from "../coach-history";

vi.mock("@/app/[locale]/coach/[gameId]/coach-game-client", () => ({
  CoachGameClient: ({ gameRecord }: { gameRecord: { gameId: string } | null }) => <div>{gameRecord?.gameId ?? "Missing fixture"}</div>,
}));
vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
const wallet = `0x${"1".repeat(40)}` as `0x${string}`;
const other = `0x${"2".repeat(40)}` as `0x${string}`;
const gameId = "550e8400-e29b-41d4-a716-446655440000";
describe("public game readers", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json([]))));
  it("loads history automatically without a wallet signature", async () => {
    render(<CoachHistory walletAddress={wallet} credits={0} onSelectEntry={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Confirm wallet" })).not.toBeInTheDocument();
    for (const [, init] of vi.mocked(fetch).mock.calls) expect(init?.headers).toBeUndefined();
  });
  it("loads a public detail record without authorization headers", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ gameId }));
    render(<PrivateGameReader gameId={gameId} wallet={wallet} locale="es" />);
    await waitFor(() => expect(screen.getByText(gameId)).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("locale=es"), expect.objectContaining({ cache: "no-store" }));
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toBeUndefined();
  });
  it("drops stale data and aborts the previous read when the wallet changes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ gameId }));
    const { rerender } = render(<PrivateGameReader gameId={gameId} wallet={wallet} locale="en" />);
    await waitFor(() => expect(screen.getByText(gameId)).toBeInTheDocument());
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}));
    rerender(<PrivateGameReader gameId={gameId} wallet={other} locale="en" />);
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText(gameId)).not.toBeInTheDocument();
  });
  it("shows an unavailable result without rendering a failed response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    render(<PrivateGameReader gameId={gameId} wallet={wallet} locale="en" />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText(gameId)).not.toBeInTheDocument();
  });
});
