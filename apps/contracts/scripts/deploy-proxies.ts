import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network, upgrades } from "hardhat";

type DeploymentRecord = {
  network: string;
  chainId: number;
  deployedAt: string;
  safeOwner: string;
  signer: string;
  proxyAdmin?: string;
  badgesProxy: string;
  badgesImpl: string;
  scoreboardProxy: string;
  scoreboardImpl: string;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

async function transferProxyAdminOwnershipIfNeeded(proxyAddress: string, safeOwner: string) {
  const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
  const proxyAdmin = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function transferOwnership(address newOwner) external",
    ],
    proxyAdminAddress
  );
  const currentOwner = await proxyAdmin.owner();

  if (currentOwner.toLowerCase() === safeOwner.toLowerCase()) {
    return proxyAdminAddress;
  }

  const tx = await proxyAdmin.transferOwnership(safeOwner);
  await tx.wait();

  return proxyAdminAddress;
}

async function main() {
  const safeOwner = ethers.getAddress(requireEnv("SAFE_OWNER"));
  const signerWallet = new ethers.Wallet(requireEnv("SIGNER_PRIVATE_KEY"));
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  const badgesBaseURI = process.env.BADGES_BASE_URI ?? "ipfs://chesscito/badges";
  const submitCooldown = BigInt(process.env.SCOREBOARD_SUBMIT_COOLDOWN ?? "60");
  const maxSubmissionsPerDay = BigInt(process.env.SCOREBOARD_MAX_SUBMISSIONS_PER_DAY ?? "25");

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Safe owner: ${safeOwner}`);
  console.log(`Signer: ${signerWallet.address}`);

  const transparentProxyOptions = {
    kind: "transparent" as const,
    initializer: "initialize",
    initialOwner: safeOwner,
  };

  const badgesFactory = await ethers.getContractFactory("BadgesUpgradeable");
  const badges = await upgrades.deployProxy(
    badgesFactory,
    [badgesBaseURI, signerWallet.address, safeOwner],
    transparentProxyOptions
  );
  await badges.waitForDeployment();
  const badgesProxy = await badges.getAddress();
  const badgesImpl = await upgrades.erc1967.getImplementationAddress(badgesProxy);

  const scoreboardFactory = await ethers.getContractFactory("ScoreboardUpgradeable");
  const scoreboard = await upgrades.deployProxy(
    scoreboardFactory,
    [submitCooldown, maxSubmissionsPerDay, signerWallet.address, safeOwner],
    transparentProxyOptions
  );
  await scoreboard.waitForDeployment();
  const scoreboardProxy = await scoreboard.getAddress();
  const scoreboardImpl = await upgrades.erc1967.getImplementationAddress(scoreboardProxy);

  const proxyAdmin = await transferProxyAdminOwnershipIfNeeded(badgesProxy, safeOwner);

  const deployment: DeploymentRecord = {
    network: network.name,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    safeOwner,
    signer: signerWallet.address,
    proxyAdmin,
    badgesProxy,
    badgesImpl,
    scoreboardProxy,
    scoreboardImpl,
  };

  const outputDir = path.join(process.cwd(), "deployments");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, `${network.name}.json`),
    `${JSON.stringify(deployment, null, 2)}\n`,
    "utf8"
  );

  console.log("\nDeployed Transparent Proxies");
  console.log(`Badges proxy: ${badgesProxy}`);
  console.log(`Badges implementation: ${badgesImpl}`);
  console.log(`Scoreboard proxy: ${scoreboardProxy}`);
  console.log(`Scoreboard implementation: ${scoreboardImpl}`);
  console.log(`ProxyAdmin: ${proxyAdmin}`);
  console.log(`Deployment file: deployments/${network.name}.json`);
  console.log("\nFrontend env exports");
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);
  console.log(`NEXT_PUBLIC_BADGES_ADDRESS=${badgesProxy}`);
  console.log(`NEXT_PUBLIC_SCOREBOARD_ADDRESS=${scoreboardProxy}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
