import { ethers } from "hardhat";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const paymentToken = ethers.getAddress(requireEnv("USDC_ADDRESS"));
  const owner = ethers.getAddress(process.env.SHOP_OWNER ?? process.env.SAFE_OWNER ?? deployer.address);
  const treasury = ethers.getAddress(process.env.SHOP_TREASURY ?? owner);
  const maxQuantityPerTx = BigInt(process.env.MAX_QUANTITY_PER_TX ?? "10");

  const shopFactory = await ethers.getContractFactory("Shop");
  const shop = await shopFactory.deploy(owner, paymentToken, treasury, maxQuantityPerTx);
  await shop.waitForDeployment();

  console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Shop: ${await shop.getAddress()}`);
  console.log(`Owner: ${owner}`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Payment token (USDC): ${paymentToken}`);
  console.log(`Max quantity per tx: ${maxQuantityPerTx}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
