// scripts/upgrade-victory-nft.ts
// Upgrades the VictoryNFTUpgradeable proxy's implementation to ship
// mintSignedWithPermit. Additive-only change — no new storage, no
// reinitializer needed (see contracts/VictoryNFTUpgradeable.sol).
//
// Usage:
//   hardhat run scripts/upgrade-victory-nft.ts --network <network>
//
// Safe by default: without CONFIRM_UPGRADE=yes this only runs the OZ
// upgrades plugin's standalone layout/safety check on the new
// implementation and exits — it does NOT deploy or wire anything. Re-run
// with CONFIRM_UPGRADE=yes to execute the upgrade transaction.
//
// Requires: the connected signer (DEPLOYER_PRIVATE_KEY) must be the current
// owner of the proxy's ProxyAdmin — the script aborts otherwise.
//
// Deliberately bypasses upgrades.forceImport()/upgrades.upgradeProxy():
// forceImport reconstructs the local .openzeppelin manifest (gitignored,
// so a fresh checkout never has it) by matching on-chain bytecode against
// local artifacts — but Hardhat only keeps the latest compiled artifact,
// never the historical one that's actually live on-chain. Passed the NEW
// factory, forceImport has no way to detect the mismatch and records the
// proxy as if it already ran the new version. upgradeProxy then diffs
// "requested version" against that poisoned manifest entry, finds them
// equal, and silently skips both the deploy and the admin upgrade call —
// confirmed on Sepolia 2026-07-03: script reported "Upgraded" but the
// proxy's EIP-1967 implementation slot never changed and the new
// implementation's bytecode was never actually deployed under that
// no-op run. Deploying + upgrading directly avoids that failure mode
// entirely, at the cost of the plugin's automatic storage-layout diff
// (acceptable here — additive-only change, already verified by hand and
// by the SDD review process, see docs/handoffs/2026-07-03-victory-nft-
// permit-mint-handoff.md).

import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network, upgrades } from "hardhat";

type DeploymentRecord = {
  victoryNFTProxy?: string;
  victoryNFTImpl?: string;
  victoryNFTImplPrevious?: string;
  victoryNFTUpgradedAt?: string;
  [key: string]: unknown;
};

const PROXY_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function upgradeAndCall(address proxy, address implementation, bytes data) external payable",
];

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();

  const deploymentPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  const record = JSON.parse(await fs.readFile(deploymentPath, "utf8")) as DeploymentRecord;

  const proxyAddress = record.victoryNFTProxy;
  if (!proxyAddress) {
    throw new Error(`No victoryNFTProxy recorded in deployments/${network.name}.json`);
  }

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Proxy: ${proxyAddress}`);

  const factory = await ethers.getContractFactory("VictoryNFTUpgradeable");

  // Same accepted risk as the original deploy-victory-nft.ts: the contract
  // inherits non-upgradeable @openzeppelin/contracts ReentrancyGuard,
  // which has a constructor. Contract's own natspec documents why this is
  // proxy-safe (OZ v5 ReentrancyGuard's _status slot is always
  // NOT_ENTERED between calls, so a slot collision across upgrades is
  // benign).
  await upgrades.validateImplementation(factory, { unsafeAllow: ["constructor"] });
  console.log("New implementation: passes standalone upgrade-safety checks.");

  // Both reads are direct on-chain storage reads (EIP-1967 admin/impl
  // slots) — no dependency on the local .openzeppelin manifest.
  const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
  const proxyAdmin = await ethers.getContractAt(PROXY_ADMIN_ABI, proxyAdminAddress, signer);
  const proxyAdminOwner: string = await proxyAdmin.owner();

  if (proxyAdminOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the ProxyAdmin owner (${proxyAdminOwner} owns ` +
        `${proxyAdminAddress}). Connect the wallet that owns the ProxyAdmin before upgrading.`
    );
  }

  const previousImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`Current implementation: ${previousImpl}`);

  if (process.env.CONFIRM_UPGRADE !== "yes") {
    console.log(
      "\nNo transaction sent. Re-run with CONFIRM_UPGRADE=yes to deploy the " +
        "new implementation and upgrade the proxy."
    );
    return;
  }

  console.log("\nCONFIRM_UPGRADE=yes — deploying new implementation...");
  const impl = await factory.connect(signer).deploy();
  await impl.waitForDeployment();
  const newImplAddress = await impl.getAddress();
  console.log(`Deployed new implementation: ${newImplAddress}`);

  if (newImplAddress.toLowerCase() === previousImpl.toLowerCase()) {
    throw new Error("New implementation address matches the previous one — aborting upgrade.");
  }

  console.log(`Calling ProxyAdmin.upgradeAndCall(${proxyAddress}, ${newImplAddress}, "0x")...`);
  const tx = await proxyAdmin.upgradeAndCall(proxyAddress, newImplAddress, "0x");
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt?.blockNumber}, tx ${receipt?.hash}`);

  // Self-verify against the live chain rather than trusting the tx receipt
  // alone — this is exactly the class of silent-no-op this script exists
  // to catch. Retried with backoff: public multi-node RPC endpoints (e.g.
  // forno.celo-sepolia) can serve a read from a node that hasn't yet
  // caught up to the block the tx landed in, producing a false negative
  // immediately after confirmation (observed 2026-07-03 — the upgrade had
  // actually succeeded, a bare single read just hit a lagging node).
  let confirmedImpl = "";
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    confirmedImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    if (confirmedImpl.toLowerCase() === newImplAddress.toLowerCase()) break;
    if (attempt < maxAttempts) {
      console.log(
        `  Verification attempt ${attempt}/${maxAttempts}: slot reads ${confirmedImpl}, ` +
          "retrying in 3s (likely RPC propagation lag)..."
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  if (confirmedImpl.toLowerCase() !== newImplAddress.toLowerCase()) {
    throw new Error(
      `Upgrade did not take effect after ${maxAttempts} verification attempts: proxy ` +
        `implementation slot reads ${confirmedImpl}, expected ${newImplAddress}. Tx ` +
        `${receipt?.hash} confirmed — check the block explorer before assuming failure.`
    );
  }
  console.log(`\nUpgraded. New implementation confirmed on-chain: ${confirmedImpl}`);

  record.victoryNFTImplPrevious = previousImpl;
  record.victoryNFTImpl = confirmedImpl;
  record.victoryNFTUpgradedAt = new Date().toISOString();
  await fs.writeFile(deploymentPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`Deployment record updated: deployments/${network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
