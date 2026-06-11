import { describe, expect, it, vi } from "vitest";

import {
  buildLabyrinthCompletionIdempotencyKey,
  submitLabyrinthCompletionEarn,
} from "@/lib/peones/labyrinth-earn";

const WALLET = "0x" + "ab".repeat(20);

function okFetch(body: Record<string, unknown> = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ credited: 1, newBalance: 5, ...body }), {
      status: 200,
    }),
  ) as unknown as typeof fetch;
}

describe("buildLabyrinthCompletionIdempotencyKey", () => {
  it("starts with the documented source prefix and scopes by wallet", () => {
    const key = buildLabyrinthCompletionIdempotencyKey(WALLET, "knight", "knight-lab-3");
    // Prefix is enforced server-side (IDEMPOTENCY_PREFIX_BY_SOURCE);
    // wallet is INSIDE the key because peones_ledger_idempotency_uq is
    // GLOBAL — without it, two different wallets completing the same
    // lab would collide and the second would never get credited.
    expect(key).toBe(`labyrinth_completion:${WALLET.toLowerCase()}:knight:knight-lab-3`);
  });

  it("is replay-stable: same lab always yields the same key (no attempt/seq)", () => {
    const a = buildLabyrinthCompletionIdempotencyKey(WALLET, "rook", "rook-lab-1");
    const b = buildLabyrinthCompletionIdempotencyKey(WALLET, "rook", "rook-lab-1");
    expect(a).toBe(b);
  });
});

describe("submitLabyrinthCompletionEarn", () => {
  it("first completion (bestBefore null) POSTs amount 1 with source labyrinth_completion", async () => {
    const fetchImpl = okFetch();
    const result = await submitLabyrinthCompletionEarn({
      wallet: WALLET,
      piece: "knight",
      labyrinthId: "knight-lab-3",
      bestBefore: null,
      fetchImpl,
    });

    expect(result.kind).toBe("success");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/peones/earn");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      amount: 1,
      source: "labyrinth_completion",
      sourceId: "knight:knight-lab-3",
      idempotencyKey: `labyrinth_completion:${WALLET.toLowerCase()}:knight:knight-lab-3`,
    });
  });

  it("already-completed lab (bestBefore set) never calls the network, even on a star improvement", async () => {
    const fetchImpl = okFetch();
    const result = await submitLabyrinthCompletionEarn({
      wallet: WALLET,
      piece: "knight",
      labyrinthId: "knight-lab-1",
      bestBefore: 7, // 1★ → player now scored optimal: still no second earn
      fetchImpl,
    });

    expect(result.kind).toBe("success");
    expect(result.kind === "success" && result.credited).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("network failure degrades to kind error (fire-and-forget caller)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const result = await submitLabyrinthCompletionEarn({
      wallet: WALLET,
      piece: "rook",
      labyrinthId: "rook-lab-1",
      bestBefore: null,
      fetchImpl,
    });
    expect(result.kind).toBe("error");
  });

  it("invalid wallet short-circuits to error without a network call", async () => {
    const fetchImpl = okFetch();
    const result = await submitLabyrinthCompletionEarn({
      wallet: "not-a-wallet",
      piece: "rook",
      labyrinthId: "rook-lab-1",
      bestBefore: null,
      fetchImpl,
    });
    expect(result.kind).toBe("error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
