// scripts/verify-victory-nft-impl.ts
// Verifies the current VictoryNFTUpgradeable implementation on the block
// explorer (Celoscan/Blockscout via the etherscan-v2 plugin config).
//
// Usage:
//   hardhat run scripts/verify-victory-nft-impl.ts --network <network>
//
// Reads deployments/<network>.json → victoryNFTImpl. Run
// upgrade-victory-nft.ts first so that field points at the new
// implementation.

import fs from "node:fs/promises";
import path from "node:path";

import { network, run } from "hardhat";

type DeploymentRecord = {
  victoryNFTImpl?: string;
};

async function main() {
  const deploymentPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  const record = JSON.parse(await fs.readFile(deploymentPath, "utf8")) as DeploymentRecord;

  const impl = record.victoryNFTImpl;
  if (!impl) {
    throw new Error(`No victoryNFTImpl recorded in deployments/${network.name}.json`);
  }

  console.log(`Network: ${network.name}`);
  console.log(`Verifying VictoryNFTUpgradeable implementation: ${impl}`);

  try {
    // No constructor arguments — the implementation's constructor only
    // calls _disableInitializers(), same pattern as Badges/Scoreboard.
    await run("verify:verify", { address: impl, constructorArguments: [] });
    console.log(`✓ verified ${impl}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Already Verified")) {
      console.log(`↩ already verified ${impl}`);
    } else {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
