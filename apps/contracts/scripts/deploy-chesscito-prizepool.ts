// scripts/deploy-chesscito-prizepool.ts
// Deploys a SECOND instance of ChesscitoTreasury.sol — reused as-is, no new
// Solidity — to serve as a traceable custody vault for Victory NFT prize
// pool funds (the 20% leg of the 80/20 split). This is custody only, not
// distribution: automated prize payout logic is tracked separately as
// GitHub issue #101 ("Prize pool distribution v2"). Owner withdraws
// manually via withdrawToken/withdrawTokenToPayout until that lands.
//
// Deliberately a separate script (not a rerun of deploy-chesscito-
// treasury.ts): that script keys its deployment record under
// `chesscitoTreasury` — rerunning it for a second instance would either
// refuse or, with the redeploy-confirm flag, overwrite the first
// instance's recorded address. This script uses its own `chesscitoPrizePool`
// keys so both instances coexist in deployments/<network>.json.
//
// Usage:
//   hardhat run scripts/deploy-chesscito-prizepool.ts --network <network>
//
// Required env:
//   SAFE_OWNER — owner (and default payout) address for the new instance
// Optional env:
//   PRIZEPOOL_PAYOUT_ADDRESS — defaults to SAFE_OWNER if unset
//   CONFIRM_MAINNET_PRIZEPOOL_DEPLOY=YES — required gate on celo (42220)
//   CONFIRM_PRIZEPOOL_REDEPLOY=YES — required if chesscitoPrizePool already
//     recorded for this network (prevents accidental overwrite)

import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network } from "hardhat";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = ethers.getAddress(requireEnv("SAFE_OWNER"));
  const payoutAddress = ethers.getAddress(
    process.env.PRIZEPOOL_PAYOUT_ADDRESS?.trim() || owner
  );
  const { chainId } = await ethers.provider.getNetwork();

  if (chainId === 42220n && process.env.CONFIRM_MAINNET_PRIZEPOOL_DEPLOY !== "YES") {
    throw new Error(
      "Mainnet deploy blocked. Set CONFIRM_MAINNET_PRIZEPOOL_DEPLOY=YES after reviewing configuration."
    );
  }

  const outputDir = path.join(process.cwd(), "deployments");
  const outputFile = path.join(outputDir, `${network.name}.json`);
  await fs.mkdir(outputDir, { recursive: true });

  let record: Record<string, unknown> = { network: network.name, chainId: Number(chainId) };
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(outputFile, "utf8"));
    if (parsed == null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(`Invalid deployment record shape: deployments/${network.name}.json`);
    }
    record = parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (record.chesscitoPrizePool && process.env.CONFIRM_PRIZEPOOL_REDEPLOY !== "YES") {
    throw new Error(
      `Prize pool already recorded for ${network.name}. Set CONFIRM_PRIZEPOOL_REDEPLOY=YES to replace it deliberately.`
    );
  }

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Prize pool owner: ${owner}`);
  console.log(`Payout address: ${payoutAddress}`);

  const factory = await ethers.getContractFactory("ChesscitoTreasury");
  const prizePool = await factory.deploy(owner, payoutAddress);
  await prizePool.waitForDeployment();
  const prizePoolAddress = await prizePool.getAddress();
  console.log(`ChesscitoTreasury (prize pool instance) deployed: ${prizePoolAddress}`);

  record.chesscitoPrizePool = prizePoolAddress;
  record.chesscitoPrizePoolOwner = owner;
  record.chesscitoPrizePoolPayout = payoutAddress;
  record.chesscitoPrizePoolDeployedAt = new Date().toISOString();
  await fs.writeFile(outputFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log(`Deployment record updated: deployments/${network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
