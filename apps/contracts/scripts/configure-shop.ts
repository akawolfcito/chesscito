// scripts/configure-shop.ts
// Run after deploy.ts:
//   SHOP_ADDRESS=0x... npx hardhat run scripts/configure-shop.ts --network <network>
//
// Edit ITEMS below to match your game's item catalogue.
// Prices are in USDC micro-units (6 decimals): 1 USDC = 1_000_000.

import { ethers } from "hardhat";

// ── Item catalogue ─────────────────────────────────────────────────────────
// itemId should match your off-chain item IDs exactly.
const ITEMS: { itemId: bigint; price: bigint; enabled: boolean; label: string }[] = [
  { itemId: 1n, price: 100_000n, enabled: true, label: "Founder Badge" }, // 0.10 USDC
];

async function main() {
  const shopAddress = process.env.SHOP_ADDRESS;
  if (!shopAddress) throw new Error("Set SHOP_ADDRESS env var");

  const [deployer] = await ethers.getSigners();
  const shop = await ethers.getContractAt("Shop", shopAddress, deployer);

  const itemIds     = ITEMS.map((i) => i.itemId);
  const prices      = ITEMS.map((i) => i.price);
  const enabledFlags = ITEMS.map((i) => i.enabled);

  console.log(`Configuring ${ITEMS.length} items on Shop ${shopAddress}…`);
  ITEMS.forEach((i) =>
    console.log(`  [${i.itemId}] ${i.label} — ${Number(i.price) / 1e6} USDC`)
  );

  const tx = await shop.setItems(itemIds, prices, enabledFlags);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
