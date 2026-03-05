import fs from "node:fs/promises";
import path from "node:path";

import { network, run } from "hardhat";

type DeploymentRecord = {
  badgesImpl: string;
  scoreboardImpl: string;
};

async function main() {
  const deploymentPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  const raw = await fs.readFile(deploymentPath, "utf8");
  const deployment = JSON.parse(raw) as DeploymentRecord;

  for (const [label, address] of [
    ["BadgesUpgradeable", deployment.badgesImpl],
    ["ScoreboardUpgradeable", deployment.scoreboardImpl],
  ] as const) {
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [],
      });
      console.log(`Verified ${label} at ${address}`);
    } catch (error) {
      console.error(`Failed verifying ${label} at ${address}`);
      console.error(error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
