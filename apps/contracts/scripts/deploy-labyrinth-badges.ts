import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network, upgrades } from "hardhat";

/**
 * Phase D deploy script for LabyrinthBadges (soulbound ERC-1155).
 *
 * Spec: docs/superpowers/specs/2026-06-02-labyrinth-badges-contract-v0.1.md
 *
 * Required env:
 *   SAFE_OWNER        — multisig or operator wallet that owns the proxy
 *   SIGNER_ADDRESS    — backend hot wallet that signs claim vouchers
 *
 * Optional env:
 *   LABYRINTH_BADGES_BASE_URI — defaults to "ipfs://chesscito/labyrinth-badges"
 *
 * Usage:
 *   pnpm --filter hardhat hardhat run scripts/deploy-labyrinth-badges.ts \
 *     --network celo-sepolia
 */

const DEFAULT_BASE_URI = "ipfs://chesscito/labyrinth-badges";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function main() {
  const safeOwner = ethers.getAddress(requireEnv("SAFE_OWNER"));
  const signerAddress = ethers.getAddress(requireEnv("SIGNER_ADDRESS"));
  const baseURI = process.env.LABYRINTH_BADGES_BASE_URI?.trim() || DEFAULT_BASE_URI;

  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Safe owner: ${safeOwner}`);
  console.log(`Signer: ${signerAddress}`);
  console.log(`Base URI: ${baseURI}`);

  // LabyrinthBadges has no post-init configuration (no token allowlist,
  // no prices, no allowlist mapping in v0.1). Deploy directly with
  // safeOwner as the initial owner.
  const factory = await ethers.getContractFactory("LabyrinthBadges");
  const labyrinthBadges = await upgrades.deployProxy(
    factory,
    [baseURI, signerAddress, safeOwner],
    {
      kind: "transparent",
      initializer: "initialize",
    }
  );
  await labyrinthBadges.waitForDeployment();

  const proxy = await labyrinthBadges.getAddress();
  const impl = await upgrades.erc1967.getImplementationAddress(proxy);
  const proxyAdmin = await upgrades.erc1967.getAdminAddress(proxy);

  console.log(`\nLabyrinthBadges proxy: ${proxy}`);
  console.log(`LabyrinthBadges implementation: ${impl}`);
  console.log(`LabyrinthBadges ProxyAdmin: ${proxyAdmin}`);

  // Append to existing deployment record so the file accumulates all
  // contracts deployed on this network.
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

  record.labyrinthBadgesProxy = proxy;
  record.labyrinthBadgesImpl = impl;
  record.labyrinthBadgesProxyAdmin = proxyAdmin;
  record.labyrinthBadgesDeployedAt = new Date().toISOString();

  await fs.writeFile(outputFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log(`\nDeployment record updated: deployments/${network.name}.json`);
  console.log("\nFrontend env (to add via `vercel env add`, not to commit):");
  console.log(`NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS=${proxy}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
