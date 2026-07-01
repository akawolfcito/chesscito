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
    process.env.TREASURY_PAYOUT_ADDRESS?.trim() || owner,
  );
  const { chainId } = await ethers.provider.getNetwork();
  if (
    chainId === 42220n &&
    process.env.CONFIRM_MAINNET_TREASURY_DEPLOY !== "YES"
  ) {
    throw new Error(
      "Mainnet deploy blocked. Set CONFIRM_MAINNET_TREASURY_DEPLOY=YES after reviewing configuration.",
    );
  }

  const outputDir = path.join(process.cwd(), "deployments");
  const outputFile = path.join(outputDir, `${network.name}.json`);
  await fs.mkdir(outputDir, { recursive: true });

  let record: Record<string, unknown> = {
    network: network.name,
    chainId: Number(chainId),
  };
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(outputFile, "utf8"));
    if (parsed == null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(`Invalid deployment record shape: deployments/${network.name}.json`);
    }
    record = parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (
    record.chesscitoTreasury &&
    process.env.CONFIRM_TREASURY_REDEPLOY !== "YES"
  ) {
    throw new Error(
      `Treasury already recorded for ${network.name}. Set CONFIRM_TREASURY_REDEPLOY=YES to replace it deliberately.`,
    );
  }

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Treasury owner: ${owner}`);
  console.log(`Payout address: ${payoutAddress}`);

  const factory = await ethers.getContractFactory("ChesscitoTreasury");
  const treasury = await factory.deploy(owner, payoutAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`ChesscitoTreasury deployed: ${treasuryAddress}`);

  record.chesscitoTreasury = treasuryAddress;
  record.chesscitoTreasuryOwner = owner;
  record.chesscitoTreasuryPayout = payoutAddress;
  record.chesscitoTreasuryDeployedAt = new Date().toISOString();
  await fs.writeFile(outputFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log(`Deployment record updated: deployments/${network.name}.json`);
  console.log("Frontend env (set manually; never commit the deployed value):");
  console.log(`NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS=${treasuryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
