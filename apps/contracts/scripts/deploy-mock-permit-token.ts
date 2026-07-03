// scripts/deploy-mock-permit-token.ts
// Deploys MockERC20Permit (dev/test only — permissionless mint) to a
// testnet, registers it as an accepted token on the VictoryNFTUpgradeable
// proxy, and mints test tokens to the deployer. Prerequisite for
// smoke-victory-permit-mint.ts: the real accepted token on celo-sepolia
// (MockUSDC) has no EIP-2612 permit support, so it can't exercise
// mintSignedWithPermit.
//
// NEVER runs on mainnet — the script aborts with a hard error if
// network.name === "celo".
//
// Usage:
//   hardhat run scripts/deploy-mock-permit-token.ts --network celo-sepolia

import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network } from "hardhat";

const DECIMALS = 6;
const MINT_AMOUNT = 1_000n * 10n ** BigInt(DECIMALS); // 1000 test tokens

type DeploymentRecord = {
  victoryNFTProxy?: string;
  victoryNFTPermitTestToken?: string;
  victoryNFTPermitTestTokenDecimals?: number;
  victoryNFTPermitTestTokenDeployedAt?: string;
  [key: string]: unknown;
};

async function main() {
  if (network.name === "celo") {
    throw new Error("Refusing to deploy a mock/test token to celo (mainnet).");
  }

  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);

  const deploymentPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  const record = JSON.parse(await fs.readFile(deploymentPath, "utf8")) as DeploymentRecord;

  const proxyAddress = record.victoryNFTProxy;
  if (!proxyAddress) {
    throw new Error(`No victoryNFTProxy recorded in deployments/${network.name}.json`);
  }

  // Compute the nonce once and increment it locally for every subsequent
  // tx instead of letting each call re-query "pending" from the RPC.
  // forno.celo-sepolia is a load-balanced public endpoint — a re-query
  // between sequential txs can land on a node that hasn't yet observed
  // the prior tx, returning a stale (already-used) nonce and getting the
  // next tx rejected outright ("nonce too low"), as happened here
  // 2026-07-03 on the mint() call after deploy+setAcceptedToken had
  // already gone through.
  let nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");

  const factory = await ethers.getContractFactory("MockERC20Permit");
  const token = await factory.deploy("Mock Permit USDC", "mUSDCP", DECIMALS, { nonce: nonce++ });
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`Deployed MockERC20Permit: ${tokenAddress}`);

  const victory = await ethers.getContractAt("VictoryNFTUpgradeable", proxyAddress);

  const owner: string = await victory.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Deployer ${deployer.address} is not the VictoryNFT owner (${owner}). ` +
        "Connect the wallet that owns the proxy before registering the token."
    );
  }

  const setTx = await victory.setAcceptedToken(tokenAddress, DECIMALS, { nonce: nonce++ });
  await setTx.wait();
  console.log(`Registered as accepted token (${DECIMALS} decimals).`);

  const mintTx = await token.mint(deployer.address, MINT_AMOUNT, { nonce: nonce++ });
  await mintTx.wait();
  console.log(`Minted ${MINT_AMOUNT.toString()} (raw units) to ${deployer.address}.`);

  record.victoryNFTPermitTestToken = tokenAddress;
  record.victoryNFTPermitTestTokenDecimals = DECIMALS;
  record.victoryNFTPermitTestTokenDeployedAt = new Date().toISOString();
  await fs.writeFile(deploymentPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`Deployment record updated: deployments/${network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
