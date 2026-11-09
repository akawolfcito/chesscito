import { ethers, network } from "hardhat";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function parseAddresses(name: string): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => ethers.getAddress(value.trim()))
    .filter((value, index, all) => all.indexOf(value) === index);
}

async function main() {
  const treasuryAddress = ethers.getAddress(
    requireEnv("CHESSCITO_TREASURY_ADDRESS"),
  );
  const accepted = parseAddresses("TREASURY_ACCEPTED_TOKENS");
  const rejected = parseAddresses("TREASURY_REJECTED_TOKENS");
  if (accepted.length === 0 && rejected.length === 0) {
    throw new Error(
      "Set TREASURY_ACCEPTED_TOKENS and/or TREASURY_REJECTED_TOKENS as comma-separated addresses",
    );
  }
  const rejectedSet = new Set(rejected.map((token) => token.toLowerCase()));
  const conflicts = accepted.filter((token) => rejectedSet.has(token.toLowerCase()));
  if (conflicts.length > 0) {
    throw new Error(`Conflicting accepted/rejected tokens: ${conflicts.join(", ")}`);
  }

  const [signer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  if (
    chainId === 42220n &&
    process.env.CONFIRM_MAINNET_TREASURY_CONFIG !== "YES"
  ) {
    throw new Error(
      "Mainnet configuration blocked. Set CONFIRM_MAINNET_TREASURY_CONFIG=YES after reviewing token lists.",
    );
  }
  const treasury = await ethers.getContractAt(
    "ChesscitoTreasury",
    treasuryAddress,
    signer,
  );
  const owner = await treasury.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Configured signer ${signer.address} is not Treasury owner ${owner}`,
    );
  }

  console.log(`Network: ${network.name}`);
  console.log(`ChesscitoTreasury: ${treasuryAddress}`);
  console.log(`Owner signer: ${signer.address}`);

  for (const token of accepted) {
    if (await treasury.acceptedToken(token)) {
      console.log(`Already accepted; skipped: ${token}`);
      continue;
    }
    const tx = await treasury.setAcceptedToken(token, true);
    await tx.wait();
    console.log(`Accepted token: ${token}`);
  }
  for (const token of rejected) {
    if (!(await treasury.acceptedToken(token))) {
      console.log(`Already rejected; skipped: ${token}`);
      continue;
    }
    const tx = await treasury.setAcceptedToken(token, false);
    await tx.wait();
    console.log(`Rejected token: ${token}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
