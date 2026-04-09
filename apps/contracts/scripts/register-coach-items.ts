// scripts/register-coach-items.ts
// Registers Coach credit pack items on ShopUpgradeable.
//
// Usage:
//   npx hardhat run scripts/register-coach-items.ts --network celo
//
// Requires DEPLOYER_PRIVATE_KEY in .env (must be shop owner).
// Shop proxy address is read from deployments/celo.json.

import { ethers } from "hardhat";
import deployments from "../deployments/celo.json";

const SHOP_PROXY = deployments.shopProxy;

const ITEMS: { itemId: bigint; price: bigint; enabled: boolean; label: string }[] = [
  { itemId: 3n, price: 50_000n, enabled: true, label: "Coach 5-Credit Pack" },   // $0.05
  { itemId: 4n, price: 100_000n, enabled: true, label: "Coach 20-Credit Pack" }, // $0.10
];

async function main() {
  const ownerKey = process.env.SAFE_OWNER_KEY;
  if (!ownerKey) throw new Error("Set SAFE_OWNER_KEY env var (remove it after use)");
  const owner = new ethers.Wallet(ownerKey, ethers.provider);
  console.log("Owner:", owner.address);

  const shop = await ethers.getContractAt("ShopUpgradeable", SHOP_PROXY, owner);

  const itemIds = ITEMS.map((i) => i.itemId);
  const prices = ITEMS.map((i) => i.price);
  const enabledFlags = ITEMS.map((i) => i.enabled);

  console.log(`Registering ${ITEMS.length} coach items on Shop ${SHOP_PROXY}…`);
  ITEMS.forEach((i) =>
    console.log(`  [${i.itemId}] ${i.label} — $${Number(i.price) / 1e6}`)
  );

  const tx = await shop.setItems(itemIds, prices, enabledFlags);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Done. Coach credit packs registered.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
