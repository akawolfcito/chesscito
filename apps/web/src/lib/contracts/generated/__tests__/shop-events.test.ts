import { describe, it, expect } from "vitest";
import { decodeEventLog, keccak256, toBytes } from "viem";

import { ITEM_PURCHASED_ABI } from "../shop-events.js";

/** Smoke test for the generated shop-events module. The whole point of
 *  the generator (apps/contracts/scripts/generate-event-abis.mjs) is to
 *  prevent the bug-class behind the verify-pro hot-fix (4c8748f) and the
 *  coach-verify hot-fix (4ecca3c) — a hand-written ABI drifting from the
 *  contract source. This test asserts the module loads, the
 *  ItemPurchased fragment matches the on-chain shape we expect, and viem
 *  can actually decode a real-shape log with it. If a future regenerate
 *  produces a different shape (e.g. someone changes the contract event
 *  signature), this test breaks loud. */
describe("generated/shop-events.ts", () => {
  it("exposes ITEM_PURCHASED_ABI with the correct on-chain shape", () => {
    expect(ITEM_PURCHASED_ABI).toHaveLength(1);
    const event = ITEM_PURCHASED_ABI[0];
    expect(event.type).toBe("event");
    expect(event.name).toBe("ItemPurchased");

    // 3 indexed → 4 topics on-chain (selector + buyer + itemId + token);
    // 4 non-indexed → 128 bytes data.
    const indexed = event.inputs.filter((i) => i.indexed === true);
    const nonIndexed = event.inputs.filter((i) => i.indexed === false);
    expect(indexed.map((i) => i.name)).toEqual(["buyer", "itemId", "token"]);
    expect(nonIndexed.map((i) => i.name)).toEqual([
      "quantity",
      "unitPriceUsd6",
      "totalTokenAmount",
      "treasury",
    ]);
  });

  it("viem decodeEventLog round-trips a real-shape log against the generated ABI", () => {
    const ITEM_PURCHASED_TOPIC = keccak256(
      toBytes("ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)"),
    );
    const buyer = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
    const token = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
    const treasury = "0x917497FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
    const itemId = 6n;

    const encAddrTopic = (a: string) =>
      ("0x" + "0".repeat(24) + a.toLowerCase().replace(/^0x/, "")) as `0x${string}`;
    const encUint = (n: bigint) => n.toString(16).padStart(64, "0");
    const encAddrInData = (a: string) => "0".repeat(24) + a.toLowerCase().replace(/^0x/, "");

    const decoded = decodeEventLog({
      abi: ITEM_PURCHASED_ABI,
      topics: [
        ITEM_PURCHASED_TOPIC,
        encAddrTopic(buyer),
        ("0x" + encUint(itemId)) as `0x${string}`,
        encAddrTopic(token),
      ],
      data: ("0x" +
        encUint(1n) +
        encUint(1_990_000n) +
        encUint(1_990_000_000_000_000_000n) +
        encAddrInData(treasury)) as `0x${string}`,
    });

    expect(decoded.eventName).toBe("ItemPurchased");
    expect(decoded.args.buyer.toLowerCase()).toBe(buyer);
    expect(decoded.args.itemId).toBe(itemId);
    expect(decoded.args.token.toLowerCase()).toBe(token.toLowerCase());
  });
});
