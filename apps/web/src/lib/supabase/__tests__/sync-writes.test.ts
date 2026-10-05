import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), upsert: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  server: vi.fn(),
}));
vi.mock("../server", () => ({ getSupabaseServer: mocks.server }));
import { getSyncState, setSyncState, upsertScoreAuthoritative, upsertVictoryAuthoritative, upsertPassportCache } from "../queries";

const score = { player: "FixturePlayer", level_id: 1, score: 100, time_ms: 500, tx_hash: "fixture-score" };
const victory = { player: "FixturePlayer", token_id: 1, difficulty: 1, total_moves: 3,
  time_ms: 500, tx_hash: "fixture-victory", minted_at: "2026-10-05T00:00:00Z" };
const operations = [
  () => upsertScoreAuthoritative(score), () => upsertVictoryAuthoritative(victory),
  () => setSyncState("last_synced_block", "100"),
  () => upsertPassportCache([{ player: "FixturePlayer", is_verified: true }]),
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.server.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue(mocks);
  mocks.select.mockReturnValue(mocks);
  mocks.eq.mockReturnValue(mocks);
  mocks.maybeSingle.mockResolvedValue({ data: { value: "100" }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("reconciliation database safety", () => {
  it("preserves idempotent authoritative conflict keys and normalized rows", async () => {
    await upsertScoreAuthoritative(score);
    await upsertVictoryAuthoritative(victory);
    expect(mocks.from.mock.calls).toEqual([["scores"], ["victories"]]);
    expect(mocks.upsert.mock.calls).toEqual([
      [{ ...score, player: "fixtureplayer" }, { onConflict: "tx_hash" }],
      [{ ...victory, player: "fixtureplayer" }, { onConflict: "tx_hash" }],
    ]);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("reads only the keyed cursor with cache bypass, then writes only that key", async () => {
    expect(await getSyncState("last_synced_block")).toBe("100");
    expect(mocks.server).toHaveBeenCalledWith({ freshReads: true });
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith("value");
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("key", "last_synced_block");
    await setSyncState("last_synced_block", "200");
    expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith(
      { key: "last_synced_block", value: "200" }, { onConflict: "key" },
    );
  });
  it.each(operations)("propagates returned Supabase write errors", async operation => {
    mocks.upsert.mockResolvedValue({ error: { message: "fixture failure" } });
    await expect(operation()).rejects.toThrow();
  });
  it.each([...operations, () => getSyncState("last_synced_block")])(
    "fails closed when the reconciliation database is unavailable", async operation => {
      mocks.server.mockReturnValue(null);
      await expect(operation()).rejects.toThrow("Sync database unavailable");
    },
  );
  it("does not turn a failed cursor read into the historical default", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "fixture failure" } });
    await expect(getSyncState("last_synced_block")).rejects.toThrow("Sync cursor read failed");
  });
  it("allows a genuinely absent cursor to use the existing default", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getSyncState("last_synced_block")).toBeNull();
  });
});
