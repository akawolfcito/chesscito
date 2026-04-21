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
  incrby: vi.fn(),
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

function encodeAddressTopic(addr: string) {
  return ("0x" + "0".repeat(24) + addr.toLowerCase().replace(/^0x/, "")) as `0x${string}`;
}

function encodeUint256Topic(value: bigint) {
  return ("0x" + value.toString(16).padStart(64, "0")) as `0x${string}`;
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/coach/verify-purchase", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/coach/verify-purchase", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.incrby.mockReset();
    clientMock.getTransactionReceipt.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue("OK");
    redisMock.incrby.mockResolvedValue(5);
  });

  it("credits 5 on a valid Coach-5 purchase", async () => {
    redisMock.get.mockImplementation((key: string) => {
      if (key.startsWith("coach:processed-tx:")) return Promise.resolve(null);
      if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(5);
      return Promise.resolve(null);
    });
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          address: SHOP_ADDRESS,
          topics: [
            ITEM_PURCHASED_TOPIC,
            encodeAddressTopic(VALID_WALLET),
            encodeUint256Topic(3n), // COACH_5 item
          ],
        },
      ],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ ok: true, credits: 5 });
    expect(redisMock.incrby).toHaveBeenCalledWith(`coach:credits:${VALID_WALLET}`, 5);
  });

  it("credits 20 on a valid Coach-20 purchase", async () => {
    redisMock.get.mockImplementation((key: string) => {
      if (key.startsWith("coach:processed-tx:")) return Promise.resolve(null);
      if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(20);
      return Promise.resolve(null);
    });
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          address: SHOP_ADDRESS,
          topics: [
            ITEM_PURCHASED_TOPIC,
            encodeAddressTopic(VALID_WALLET),
            encodeUint256Topic(4n), // COACH_20 item
          ],
        },
      ],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ ok: true, credits: 20 });
    expect(redisMock.incrby).toHaveBeenCalledWith(`coach:credits:${VALID_WALLET}`, 20);
  });

  it("short-circuits when the tx was already processed", async () => {
    redisMock.get.mockImplementation((key: string) => {
      if (key.startsWith("coach:processed-tx:")) return Promise.resolve("1");
      return Promise.resolve(10);
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ ok: true, credits: 10 });
    expect(clientMock.getTransactionReceipt).not.toHaveBeenCalled();
    expect(redisMock.incrby).not.toHaveBeenCalled();
  });

  it("returns 400 when tx status is not success", async () => {
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({ status: "reverted", logs: [] });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when no Coach items are purchased in the tx", async () => {
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          address: SHOP_ADDRESS,
          topics: [
            ITEM_PURCHASED_TOPIC,
            encodeAddressTopic(VALID_WALLET),
            encodeUint256Topic(1n), // non-Coach item (Founder Badge)
          ],
        },
      ],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("ignores logs whose buyer is a different wallet", async () => {
    const otherWallet = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          address: SHOP_ADDRESS,
          topics: [
            ITEM_PURCHASED_TOPIC,
            encodeAddressTopic(otherWallet),
            encodeUint256Topic(3n),
          ],
        },
      ],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("ignores logs emitted by a different contract address", async () => {
    redisMock.get.mockResolvedValue(null);
    clientMock.getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          address: "0x0000000000000000000000000000000000000099",
          topics: [
            ITEM_PURCHASED_TOPIC,
            encodeAddressTopic(VALID_WALLET),
            encodeUint256Topic(3n),
          ],
        },
      ],
    });

    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when txHash is missing", async () => {
    const res = await POST(makeRequest({ walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when txHash is malformed", async () => {
    const res = await POST(makeRequest({ txHash: "0xnope", walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when walletAddress is malformed", async () => {
    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: "0xnope" }));
    expect(res.status).toEqual(400);
  });

  it("returns 500 when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });
    const res = await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(500);
  });
});
