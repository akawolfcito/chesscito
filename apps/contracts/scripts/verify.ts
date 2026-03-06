// scripts/verify.ts
// Run after deploy.ts:
//   npx hardhat run scripts/verify.ts --network <network>
//
// Env vars:
//   BADGES_PROXY      – proxy address from deploy
//   SCOREBOARD_PROXY  – proxy address from deploy
//   SHOP_ADDRESS      – shop address from deploy
//   USDC_ADDRESS      – payment token address
//   TREASURY_ADDRESS  – treasury address
//   MAX_QUANTITY_PER_TX – (default 10)

import { run, upgrades, ethers } from "hardhat";

async function verify(address: string, constructorArguments: unknown[] = []) {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log("✓ verified", address);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Already Verified")) {
      console.log("↩ already verified", address);
    } else {
      console.error("✗ failed", address, msg);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const badgesProxy     = process.env.BADGES_PROXY     ?? "";
  const scoreboardProxy = process.env.SCOREBOARD_PROXY ?? "";
  const shopAddress     = process.env.SHOP_ADDRESS     ?? "";
  const usdcAddress     = process.env.USDC_ADDRESS     ?? "";
  const shopOwner       = process.env.SHOP_OWNER       ?? process.env.SAFE_OWNER ?? deployer.address;
  const treasuryAddress = process.env.TREASURY_ADDRESS ?? deployer.address;
  const maxQtyPerTx     = BigInt(process.env.MAX_QUANTITY_PER_TX ?? "10");

  if (badgesProxy) {
    const impl = await upgrades.erc1967.getImplementationAddress(badgesProxy);
    console.log("Verifying Badges impl:", impl);
    await verify(impl);
  }

  if (scoreboardProxy) {
    const impl = await upgrades.erc1967.getImplementationAddress(scoreboardProxy);
    console.log("Verifying Scoreboard impl:", impl);
    await verify(impl);
  }

  if (shopAddress && usdcAddress) {
    console.log("Verifying Shop:", shopAddress);
    await verify(shopAddress, [
      shopOwner,
      usdcAddress,
      treasuryAddress,
      maxQtyPerTx,
    ]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
