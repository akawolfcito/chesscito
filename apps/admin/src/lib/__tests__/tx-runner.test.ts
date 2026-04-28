import { describe, it, expect } from "vitest";
import type { AbiFunction } from "viem";

import { buildCalldata } from "../tx-runner";

const PAUSE_ABI: AbiFunction = {
  type: "function",
  name: "pause",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [],
};

const UNPAUSE_ABI: AbiFunction = {
  type: "function",
  name: "unpause",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [],
};

const SET_ITEM_ABI: AbiFunction = {
  type: "function",
  name: "setItem",
  stateMutability: "nonpayable",
  inputs: [
    { name: "itemId", type: "uint256" },
    { name: "priceUsd6", type: "uint256" },
    { name: "enabled", type: "bool" },
  ],
  outputs: [],
};

const SET_ACCEPTED_TOKEN_ABI: AbiFunction = {
  type: "function",
  name: "setAcceptedToken",
  stateMutability: "nonpayable",
  inputs: [
    { name: "token", type: "address" },
    { name: "accepted", type: "bool" },
  ],
  outputs: [],
};

const SHOP = "0x24846C772af7233ADfD98b9A96273120f3a1f74b";

describe("buildCalldata", () => {
  it("encodes setItem(5, 1_000_000, true) to the same calldata viem would emit", () => {
    const data = buildCalldata({
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      contract: SHOP,
      abiItem: SET_ITEM_ABI,
      args: [5n, 1_000_000n, true],
    });
    expect(data).toBe(
      "0xbbcf696a000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000001",
    );
  });

  it("encodes setAcceptedToken(CELO, true) deterministically", () => {
    const data = buildCalldata({
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      contract: SHOP,
      abiItem: SET_ACCEPTED_TOKEN_ABI,
      args: ["0x471EcE3750Da237f93B8E339c536989b8978a438", true],
    });
    expect(data).toBe(
      "0xc997dbca000000000000000000000000471ece3750da237f93b8e339c536989b8978a4380000000000000000000000000000000000000000000000000000000000000001",
    );
  });

  it("encodes pause() to its 4-byte selector with no args", () => {
    const data = buildCalldata({
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      contract: SHOP,
      abiItem: PAUSE_ABI,
      args: [],
    });
    expect(data).toBe("0x8456cb59");
  });

  it("encodes unpause() to its 4-byte selector with no args", () => {
    const data = buildCalldata({
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      contract: SHOP,
      abiItem: UNPAUSE_ABI,
      args: [],
    });
    expect(data).toBe("0x3f4ba83a");
  });
});
