// scripts/configure-victory-nft-treasury.ts
// Repoints VictoryNFTUpgradeable's treasury/prizePool from placeholder EOAs
// to dedicated ChesscitoTreasury custody vaults, and updates mint prices to
// whole-cent values (Easy $0.01 / Medium $0.02 / Hard $0.03 — up from the
// sub-cent $0.005/$0.01/$0.02, which the Arena "Checkmate!" popup was
// already displaying incorrectly as $0.01 for Easy due to 2-decimal
// rounding; this closes that gap by making the real price match what's
// shown instead of fixing the display separately).
//
// Idempotent: skips any setter whose target value already matches on-chain
// state, so safe to rerun.
//
// Usage:
//   hardhat run scripts/configure-victory-nft-treasury.ts --network <network>
//
// Prerequisites: deployments/<network>.json must have victoryNFTProxy,
// chesscitoTreasury (the existing instance — used as the new treasury) and
// chesscitoPrizePool (deploy-chesscito-prizepool.ts — used as the new
// prizePool).
//
// Required env:
//   CONFIRM_MAINNET_VICTORY_TREASURY_CONFIG=YES — required gate on celo (42220)

import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network } from "hardhat";

const NEW_PRICES_USD6: Record<number, bigint> = {
  1: 10_000n, // Easy — $0.01
  2: 20_000n, // Medium — $0.02
  3: 30_000n, // Hard — $0.03
};

type DeploymentRecord = {
  victoryNFTProxy?: string;
  chesscitoTreasury?: string;
  chesscitoPrizePool?: string;
};

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId === 42220n && process.env.CONFIRM_MAINNET_VICTORY_TREASURY_CONFIG !== "YES") {
    throw new Error(
      "Mainnet configuration blocked. Set CONFIRM_MAINNET_VICTORY_TREASURY_CONFIG=YES after reviewing addresses/prices below."
    );
  }

  const deploymentPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  const record = JSON.parse(await fs.readFile(deploymentPath, "utf8")) as DeploymentRecord;

  const proxyAddress = record.victoryNFTProxy;
  const newTreasury = record.chesscitoTreasury;
  const newPrizePool = record.chesscitoPrizePool;
  if (!proxyAddress) throw new Error(`No victoryNFTProxy in deployments/${network.name}.json`);
  if (!newTreasury) throw new Error(`No chesscitoTreasury in deployments/${network.name}.json`);
  if (!newPrizePool) {
    throw new Error(
      `No chesscitoPrizePool in deployments/${network.name}.json. Run deploy-chesscito-prizepool.ts first.`
    );
  }

  const [signer] = await ethers.getSigners();
  const victory = await ethers.getContractAt("VictoryNFTUpgradeable", proxyAddress, signer);

  const owner: string = await victory.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the VictoryNFT owner (${owner}).`);
  }

  console.log(`Network: ${network.name}`);
  console.log(`VictoryNFT proxy: ${proxyAddress}`);
  console.log(`Signer/owner: ${signer.address}`);
  console.log(`New treasury: ${newTreasury}`);
  console.log(`New prize pool: ${newPrizePool}`);

  const currentTreasury: string = await victory.treasury();
  if (currentTreasury.toLowerCase() === newTreasury.toLowerCase()) {
    console.log(`Treasury already set to ${newTreasury}; skipped.`);
  } else {
    const tx = await victory.setTreasury(newTreasury);
    await tx.wait();
    console.log(`Treasury updated: ${currentTreasury} -> ${newTreasury}`);
  }

  const currentPrizePool: string = await victory.prizePool();
  if (currentPrizePool.toLowerCase() === newPrizePool.toLowerCase()) {
    console.log(`Prize pool already set to ${newPrizePool}; skipped.`);
  } else {
    const tx = await victory.setPrizePool(newPrizePool);
    await tx.wait();
    console.log(`Prize pool updated: ${currentPrizePool} -> ${newPrizePool}`);
  }

  for (const [difficultyStr, newPrice] of Object.entries(NEW_PRICES_USD6)) {
    const difficulty = Number(difficultyStr);
    const currentPrice: bigint = await victory.priceUsd6(difficulty);
    if (currentPrice === newPrice) {
      console.log(`Difficulty ${difficulty}: already $${Number(newPrice) / 1_000_000}; skipped.`);
      continue;
    }
    const tx = await victory.setPrice(difficulty, newPrice);
    await tx.wait();
    console.log(
      `Difficulty ${difficulty}: $${Number(currentPrice) / 1_000_000} -> $${Number(newPrice) / 1_000_000}`
    );
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
