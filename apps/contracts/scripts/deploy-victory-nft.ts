import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network, upgrades } from "hardhat";

// Celo Mainnet stablecoin addresses
const CELO_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
  USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
  cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
};

// Victory NFT prices in USD with 6 decimals
const VICTORY_PRICES: Record<number, bigint> = {
  1: 5_000n,   // Easy  — $0.005
  2: 10_000n,  // Medium — $0.01
  3: 20_000n,  // Hard  — $0.02
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function main() {
  const safeOwner = ethers.getAddress(requireEnv("SAFE_OWNER"));
  const signerAddress = ethers.getAddress(requireEnv("SIGNER_ADDRESS"));
  const treasuryAddress = ethers.getAddress(process.env.VICTORY_TREASURY ?? safeOwner);
  const prizePoolAddress = ethers.getAddress(process.env.VICTORY_PRIZE_POOL ?? requireEnv("VICTORY_PRIZE_POOL"));
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Safe owner: ${safeOwner}`);
  console.log(`Signer: ${signerAddress}`);
  console.log(`Treasury: ${treasuryAddress}`);
  console.log(`Prize pool: ${prizePoolAddress}`);

  // Deploy proxy — deployer is initial contract owner so we can configure,
  // then transfer ownership to safeOwner at the end.
  const factory = await ethers.getContractFactory("VictoryNFTUpgradeable");
  const victory = await upgrades.deployProxy(
    factory,
    [treasuryAddress, prizePoolAddress, signerAddress, deployer.address],
    {
      kind: "transparent",
      initializer: "initialize",
      initialOwner: safeOwner,
      unsafeAllow: ["constructor"],
    }
  );
  await victory.waitForDeployment();

  const victoryProxy = await victory.getAddress();
  const victoryImpl = await upgrades.erc1967.getImplementationAddress(victoryProxy);
  const victoryProxyAdmin = await upgrades.erc1967.getAdminAddress(victoryProxy);

  console.log(`\nVictory NFT proxy: ${victoryProxy}`);
  console.log(`Victory NFT implementation: ${victoryImpl}`);
  console.log(`Victory NFT ProxyAdmin: ${victoryProxyAdmin}`);

  // Configure accepted tokens (only on mainnet/known networks)
  if (Number(chainId) === 42220) {
    console.log("\nConfiguring accepted tokens for Celo Mainnet...");
    for (const [symbol, { address, decimals }] of Object.entries(CELO_TOKENS)) {
      const tx = await victory.setAcceptedToken(address, decimals);
      await tx.wait();
      console.log(`  ${symbol}: ${address} (${decimals} decimals)`);
    }
  }

  // Configure prices per difficulty
  console.log("\nConfiguring prices...");
  for (const [difficulty, price] of Object.entries(VICTORY_PRICES)) {
    const tx = await victory.setPrice(Number(difficulty), price);
    await tx.wait();
    const usd = Number(price) / 1_000_000;
    console.log(`  Difficulty ${difficulty}: $${usd.toFixed(3)}`);
  }

  // Transfer contract ownership to safeOwner
  if (deployer.address.toLowerCase() !== safeOwner.toLowerCase()) {
    console.log(`\nTransferring ownership to Safe: ${safeOwner}`);
    const txOwner = await victory.transferOwnership(safeOwner);
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
    record = { network: network.name, chainId: Number(chainId) };
  }

  record.victoryNFTProxy = victoryProxy;
  record.victoryNFTImpl = victoryImpl;
  record.victoryNFTProxyAdmin = victoryProxyAdmin;
  record.victoryNFTDeployedAt = new Date().toISOString();

  await fs.writeFile(outputFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log(`\nDeployment record updated: deployments/${network.name}.json`);
  console.log("\nFrontend env:");
  console.log(`NEXT_PUBLIC_VICTORY_NFT_ADDRESS=${victoryProxy}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
