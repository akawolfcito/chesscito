import { describe, it, expect, vi, beforeEach } from "vitest";
import { keccak256, toBytes } from "viem";

// SHOP_ADDRESS is captured at module import. Set the env BEFORE any
// module under test loads by using vi.hoisted — hoisted blocks run
// before both imports and mocks.
const { SHOP_ADDRESS } = vi.hoisted(() => {
  const addr = "0x1234567890123456789012345678901234567890";
  process.env.NEXT_PUBLIC_SHOP_ADDRESS = addr;
  return { SHOP_ADDRESS: addr };
});

// --- Mocks ---
const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

const clientMock = vi.hoisted(() => ({
  getTransactionReceipt: vi.fn(),
}));
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: () => clientMock,
    http: () => ({}),
  };
});

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

import { POST } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const VALID_TX = "0x" + "a".repeat(64);

const ITEM_PURCHASED_TOPIC = keccak256(
  toBytes("ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)")
);

const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const CELO_ADDRESS = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const TREASURY_ADDRESS = "0x917497FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

const PRO_ITEM_ID = 6n;
const COACH_5_ITEM_ID = 3n;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function encodeAddressTopic(addr: string) {
  return ("0x" + "0".repeat(24) + addr.toLowerCase().replace(/^0x/, "")) as `0x${string}`;
}

function encodeUint256Topic(value: bigint) {
  return ("0x" + value.toString(16).padStart(64, "0")) as `0x${string}`;
}

function encodeItemPurchasedData(args: {
  quantity?: bigint;
  unitPriceUsd6?: bigint;
  totalTokenAmount?: bigint;
  treasury?: string;
}) {
  // Mirrors ShopUpgradeable.ItemPurchased non-indexed payload exactly:
  // 4 fields × 32 bytes = 128 bytes. `token` is INDEXED on the real
  // contract and lives in topics, not data — see makeProLog below.
  const enc = (n: bigint) => n.toString(16).padStart(64, "0");
  const encAddr = (a: string) =>
    "0".repeat(24) + a.toLowerCase().replace(/^0x/, "");
  return ("0x" +
    enc(args.quantity ?? 1n) +
    enc(args.unitPriceUsd6 ?? 1_990_000n) +
    enc(args.totalTokenAmount ?? 1_990_000_000_000_000_000n) +
    encAddr(args.treasury ?? TREASURY_ADDRESS)) as `0x${string}`;
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/verify-pro", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeProLog(opts: { wallet?: string; itemId?: bigint; token?: string } = {}) {
  return {
    address: SHOP_ADDRESS,
    // Real contract has 3 indexed params (buyer, itemId, token) → 4 topics.
    topics: [
      ITEM_PURCHASED_TOPIC,
      encodeAddressTopic(opts.wallet ?? VALID_WALLET),
      encodeUint256Topic(opts.itemId ?? PRO_ITEM_ID),
      encodeAddressTopic(opts.token ?? USDC_ADDRESS),
    ],
    data: encodeItemPurchasedData({}),
  };
}

describe("POST /api/verify-pro", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.eval.mockReset();
    clientMock.getTransactionReceipt.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue("OK");
  });

  it("activates PRO with expiresAt = now + 30d on a fresh purchase", async () => {
    const NOW = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    redisMock.get.mockResolvedValue(null); // no processed tx
    redisMock.eval.mockResolvedValue(String(NOW + THIRTY_DAYS_MS));
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeProLog()],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: true, expiresAt: NOW + THIRTY_DAYS_MS });

    // Lua call: KEYS = [coach:pro:<wallet>], ARGV = [now, addMs]
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('SET'"),
      [`coach:pro:${VALID_WALLET}`],
      [NOW, THIRTY_DAYS_MS],
    );
    // Dedupe key set with 90d TTL
    expect(redisMock.set).toHaveBeenCalledWith(
      `coach:pro:processed-tx:${VALID_TX}`,
      "1",
      { ex: 90 * 24 * 60 * 60 },
    );
  });

  it("extends from currentExpiresAt when PRO is still active", async () => {
    const NOW = 1_700_000_000_000;
    const CURRENT_EXPIRES = NOW + 10 * 24 * 60 * 60 * 1000; // 10 days left
    const EXTENDED = CURRENT_EXPIRES + THIRTY_DAYS_MS;
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    redisMock.get.mockResolvedValue(null);
    redisMock.eval.mockResolvedValue(String(EXTENDED));
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeProLog()],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: true, expiresAt: EXTENDED });
  });

  it("extends from now when PRO has expired (Lua treats stale value as base = now)", async () => {
    const NOW = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    redisMock.get.mockResolvedValue(null);
    redisMock.eval.mockResolvedValue(String(NOW + THIRTY_DAYS_MS));
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeProLog()],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: true, expiresAt: NOW + THIRTY_DAYS_MS });
  });

  it("refuses PRO when payment was made in CELO (defense-in-depth)", async () => {
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeProLog({ token: CELO_ADDRESS })],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
    expect(await res.json()).toEqual({ error: "No PRO purchase found in transaction" });
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("ignores logs with a different itemId (e.g. Coach pack purchase, not PRO)", async () => {
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeProLog({ itemId: COACH_5_ITEM_ID })],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
    expect(await res.json()).toEqual({ error: "No PRO purchase found in transaction" });
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("ignores logs whose buyer is a different wallet", async () => {
    const otherWallet = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeProLog({ wallet: otherWallet })],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("ignores logs emitted by a different contract address", async () => {
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          ...makeProLog(),
          address: "0x0000000000000000000000000000000000000099",
        },
      ],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("short-circuits with current expiresAt when txHash was already processed", async () => {
    const NOW = 1_700_000_000_000;
    const EXISTING_EXPIRES = NOW + 5 * 24 * 60 * 60 * 1000; // 5 days left
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    redisMock.get.mockImplementation((key: string) => {
      if (key.startsWith("coach:pro:processed-tx:")) return Promise.resolve("1");
      if (key === `coach:pro:${VALID_WALLET}`) return Promise.resolve(String(EXISTING_EXPIRES));
      return Promise.resolve(null);
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: true, expiresAt: EXISTING_EXPIRES });
    expect(clientMock.getTransactionReceipt).not.toHaveBeenCalled();
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("idempotent retry on a processed tx returns active=false when PRO key has lapsed", async () => {
    const NOW = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    redisMock.get.mockImplementation((key: string) => {
      if (key.startsWith("coach:pro:processed-tx:")) return Promise.resolve("1");
      // PRO key expired → Redis auto-purged it → returns null
      if (key === `coach:pro:${VALID_WALLET}`) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: false, expiresAt: 0 });
  });

  it("returns 400 when tx status is not success", async () => {
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({ status: "reverted", logs: [] });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
    expect(await res.json()).toEqual({ error: "Transaction failed on-chain" });
  });

  it("returns 400 when txHash is missing", async () => {
    const res = await POST(makeRequest({ walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when txHash is malformed", async () => {
    const res = await POST(makeRequest({ txHash: "0xnope", walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
    expect(await res.json()).toEqual({ error: "Invalid transaction hash" });
  });

  it("returns 400 when walletAddress is malformed", async () => {
    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: "0xnope" }));
    expect(res.status).toEqual(400);
    expect(await res.json()).toEqual({ error: "Invalid wallet address" });
  });

  it("returns 500 when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });
    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(500);
  });
});
