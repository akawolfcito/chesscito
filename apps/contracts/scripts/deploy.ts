// scripts/deploy.ts
// Run: npx hardhat run scripts/deploy.ts --network <network>
//
// Env vars required (via .env + dotenv):
//   SIGNER_ADDRESS          – backend hot-wallet that signs vouchers
//   TREASURY_ADDRESS        – receives Shop proceeds
//   USDC_ADDRESS            – real USDC on target chain (leave empty to deploy MockUSDC)
//   INITIAL_MAX_LEVEL_ID    – number of live levels at deploy (default: 10)
//   SUBMIT_COOLDOWN_SECS    – scoreboard cooldown in seconds (default: 30)
//   MAX_SUBMISSIONS_PER_DAY – daily score-submit cap (default: 20)
//   MAX_QUANTITY_PER_TX     – shop per-tx quantity cap, 0 = unlimited (default: 10)

import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // ── Config ──────────────────────────────────────────────────────────────
  const signerAddress      = process.env.SIGNER_ADDRESS   ?? deployer.address;
  const treasuryAddress    = process.env.TREASURY_ADDRESS ?? deployer.address;
  const maxLevelId         = BigInt(process.env.INITIAL_MAX_LEVEL_ID    ?? "10");
  const submitCooldown     = BigInt(process.env.SUBMIT_COOLDOWN_SECS    ?? "30");
  const maxSubmissionsDay  = BigInt(process.env.MAX_SUBMISSIONS_PER_DAY ?? "20");
  const maxQtyPerTx        = BigInt(process.env.MAX_QUANTITY_PER_TX     ?? "10");
  const baseURI            = process.env.BASE_URI ?? "ipfs://PLACEHOLDER/";

  // ── Payment token ────────────────────────────────────────────────────────
  let usdcAddress = process.env.USDC_ADDRESS ?? "";
  if (!usdcAddress) {
    console.log("No USDC_ADDRESS set — deploying MockUSDC for testing…");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mock = await MockUSDC.deploy();
    await mock.waitForDeployment();
    usdcAddress = await mock.getAddress();
    console.log("MockUSDC deployed:", usdcAddress);
  }

  // ── BadgesUpgradeable (UUPS proxy) ───────────────────────────────────────
  console.log("\nDeploying BadgesUpgradeable…");
  const Badges = await ethers.getContractFactory("BadgesUpgradeable");
  const badges = await upgrades.deployProxy(
    Badges,
    [baseURI, signerAddress, deployer.address, maxLevelId],
    { initializer: "initialize", kind: "uups" }
  );
  await badges.waitForDeployment();
  const badgesProxy = await badges.getAddress();
  console.log("BadgesUpgradeable proxy :", badgesProxy);
  console.log("BadgesUpgradeable impl  :", await upgrades.erc1967.getImplementationAddress(badgesProxy));

  // ── ScoreboardUpgradeable (UUPS proxy) ──────────────────────────────────
  console.log("\nDeploying ScoreboardUpgradeable…");
  const Scoreboard = await ethers.getContractFactory("ScoreboardUpgradeable");
  const scoreboard = await upgrades.deployProxy(
    Scoreboard,
    [submitCooldown, maxSubmissionsDay, signerAddress, deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await scoreboard.waitForDeployment();
  const scoreboardProxy = await scoreboard.getAddress();
  console.log("ScoreboardUpgradeable proxy:", scoreboardProxy);
  console.log("ScoreboardUpgradeable impl :", await upgrades.erc1967.getImplementationAddress(scoreboardProxy));

  // ── Shop (non-upgradeable) ───────────────────────────────────────────────
  console.log("\nDeploying Shop…");
  const Shop = await ethers.getContractFactory("Shop");
  const shop = await Shop.deploy(
    deployer.address,  // initialOwner
    usdcAddress,
    treasuryAddress,
    maxQtyPerTx
  );
  await shop.waitForDeployment();
  const shopAddress = await shop.getAddress();
  console.log("Shop deployed:", shopAddress);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network          : ${(await ethers.provider.getNetwork()).name}`);
  console.log(`  Deployer         : ${deployer.address}`);
  console.log(`  Signer           : ${signerAddress}`);
  console.log(`  Treasury         : ${treasuryAddress}`);
  console.log(`  USDC             : ${usdcAddress}`);
  console.log(`  Badges proxy     : ${badgesProxy}`);
  console.log(`  Scoreboard proxy : ${scoreboardProxy}`);
  console.log(`  Shop             : ${shopAddress}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Transfer Badges/Scoreboard ownership to multisig if deployer != multisig.");
  console.log("  2. Run scripts/configure-shop.ts to set item prices.");
  console.log("  3. Verify contracts on block explorer (see scripts/verify.ts).");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
