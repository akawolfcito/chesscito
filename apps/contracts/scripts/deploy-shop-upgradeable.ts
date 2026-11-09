import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network, upgrades } from "hardhat";

// Celo Mainnet stablecoin addresses
const CELO_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
  USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
  cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function main() {
  const safeOwner = ethers.getAddress(requireEnv("SAFE_OWNER"));
  const treasuryAddress = ethers.getAddress(process.env.SHOP_TREASURY ?? safeOwner);
  const maxQuantityPerTx = BigInt(process.env.MAX_QUANTITY_PER_TX ?? "10");
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Safe owner: ${safeOwner}`);
  console.log(`Treasury: ${treasuryAddress}`);

  // Deploy proxy — deployer is initial contract owner so we can configure items,
  // then transfer ownership to safeOwner at the end.
  const shopFactory = await ethers.getContractFactory("ShopUpgradeable");
  const shop = await upgrades.deployProxy(
    shopFactory,
    [treasuryAddress, maxQuantityPerTx, deployer.address],
    {
      kind: "transparent",
      initializer: "initialize",
      initialOwner: safeOwner,
      unsafeAllow: ["constructor"],
    }
  );
  await shop.waitForDeployment();

  const shopProxy = await shop.getAddress();
  const shopImpl = await upgrades.erc1967.getImplementationAddress(shopProxy);
  const shopProxyAdmin = await upgrades.erc1967.getAdminAddress(shopProxy);

  console.log(`\nShop proxy: ${shopProxy}`);
  console.log(`Shop implementation: ${shopImpl}`);
  console.log(`Shop ProxyAdmin: ${shopProxyAdmin}`);

  // Configure accepted tokens (only on mainnet/known networks)
  if (Number(chainId) === 42220) {
    console.log("\nConfiguring accepted tokens for Celo Mainnet...");
    for (const [symbol, { address, decimals }] of Object.entries(CELO_TOKENS)) {
      const tx = await shop.setAcceptedToken(address, decimals);
      await tx.wait();
      console.log(`  ${symbol}: ${address} (${decimals} decimals)`);
    }
  }

  // Configure items: Founder Badge = $0.10, Retry Shield = $0.025
  console.log("\nConfiguring items...");
  const tx1 = await shop.setItem(1n, 100_000n, true);
  await tx1.wait();
  console.log("  Item 1 (Founder Badge): $0.10");

  const tx2 = await shop.setItem(2n, 25_000n, true);
  await tx2.wait();
  console.log("  Item 2 (Retry Shield): $0.025");

  // Transfer contract ownership to safeOwner
  if (deployer.address.toLowerCase() !== safeOwner.toLowerCase()) {
    console.log(`\nTransferring ownership to Safe: ${safeOwner}`);
    const txOwner = await shop.transferOwnership(safeOwner);
    await txOwner.wait();
    console.log("  Ownership transferred");
  }

  // Append to existing deployment record
  const outputDir = path.join(process.cwd(), "deployments");
  const outputFile = path.join(outputDir, `${network.name}.json`);
  await fs.mkdir(outputDir, { recursive: true });

  let record: Record<string, unknown> = {};
  try {
    const existing = await fs.readFile(outputFile, "utf8");
    record = JSON.parse(existing);
  } catch {
    // No existing file — start fresh
    record = { network: network.name, chainId: Number(chainId) };
  }

  record.shopProxy = shopProxy;
  record.shopImpl = shopImpl;
  record.shopProxyAdmin = shopProxyAdmin;
  record.shopDeployedAt = new Date().toISOString();

  await fs.writeFile(outputFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log(`\nDeployment record updated: deployments/${network.name}.json`);
  console.log("\nFrontend env:");
  console.log(`NEXT_PUBLIC_SHOP_ADDRESS=${shopProxy}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
