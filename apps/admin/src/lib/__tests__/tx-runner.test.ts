import { describe, it, expect } from "vitest";
import type { AbiFunction } from "viem";

import { buildCalldata, parseCastSendOutput } from "../tx-runner";

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
});

describe("parseCastSendOutput", () => {
  it("extracts txHash, blockNumber and gasUsed from a successful cast send blob", () => {
    const stdout = `
blockHash               0xaaaa
blockNumber             29123456
contractAddress
cumulativeGasUsed       28912
effectiveGasPrice       5000000000
from                    0x917497b64EEb85859edcF2E4ca64059EDFec1923
gasUsed                 28012
status                  1 (success)
transactionHash         0x1234567890abcdef
transactionIndex        0
type                    2
`;
    const parsed = parseCastSendOutput(stdout);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.txHash).toBe("0x1234567890abcdef");
    expect(parsed.blockNumber).toBe(29123456);
    expect(parsed.gasUsed).toBe(28012);
    expect(parsed.sender).toBe("0x917497b64EEb85859edcF2E4ca64059EDFec1923");
  });

  it("reports failure when stdout has no transactionHash", () => {
    const parsed = parseCastSendOutput("status 0 (reverted)\n");
    expect(parsed.ok).toBe(false);
  });
});
