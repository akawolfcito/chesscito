import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network } from "hardhat";

/**
 * Smoke test for the LabyrinthBadges proxy deployed on a target network.
 *
 * Validates the full Phase D architecture end-to-end:
 *   - claim happy path at 1-star tier
 *   - LabyrinthClaimed event payload
 *   - balanceOf + bestMintedStars updates
 *   - same-tier re-claim revert (StarsNotStrictlyBetter)
 *   - strict-improvement re-claim succeeds (1★ → 3★)
 *   - safeTransferFrom revert (soulbound)
 *   - uri(tokenId) format
 *
 * Reads the deployed proxy address from `deployments/${network.name}.json`,
 * signs the EIP-712 LabyrinthMint voucher with `SIGNER_PRIVATE_KEY` (the
 * raw key matching the on-chain signer), and submits the claim as the
 * deployer wallet acting as the player.
 *
 * NEVER runs on mainnet. The script aborts with a hard error if
 * `network.name === "celo"` to prevent accidental mainnet smoke runs.
 *
 * Required env:
 *   SIGNER_PRIVATE_KEY — raw key matching the contract's `signer()`
 *
 * Usage:
 *   npx hardhat run scripts/smoke-labyrinth-badges.ts --network celo-sepolia
 */

const DEFAULT_LAB_ID_STRING = "pawn-lab-1";
const LAB_OPTIMAL_MOVES = 3;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function bannerOk(label: string) {
  console.log(`  ✅ ${label}`);
}

function bannerFail(label: string, detail?: unknown) {
  console.log(`  ❌ ${label}${detail ? `: ${String(detail)}` : ""}`);
}

async function main() {
  if (network.name === "celo") {
    throw new Error("Smoke script refuses to run on celo (mainnet).");
  }

  const { chainId } = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);

  const deploymentsPath = path.join(
    process.cwd(),
    "deployments",
    `${network.name}.json`
  );
  const record = JSON.parse(await fs.readFile(deploymentsPath, "utf8")) as {
    labyrinthBadgesProxy?: string;
  };
  const proxyAddress = record.labyrinthBadgesProxy;
  if (!proxyAddress) {
    throw new Error(
      `No labyrinthBadgesProxy in ${deploymentsPath}. Run deploy-labyrinth-badges.ts first.`
    );
  }
  console.log(`LabyrinthBadges proxy: ${proxyAddress}`);

  const [deployer] = await ethers.getSigners();
  const player = deployer;
  console.log(`Player (deployer): ${player.address}`);

  const signerKey = requireEnv("SIGNER_PRIVATE_KEY");
  const voucherSigner = new ethers.Wallet(signerKey);

  const badges = await ethers.getContractAt("LabyrinthBadges", proxyAddress);

  const onChainSigner = await badges.signer();
  if (onChainSigner.toLowerCase() !== voucherSigner.address.toLowerCase()) {
    throw new Error(
      `SIGNER_PRIVATE_KEY does not match on-chain signer (${onChainSigner}).`
    );
  }
  console.log(`On-chain signer matches SIGNER_PRIVATE_KEY ✔`);

  // First read the canonical lab. If state is fully exhausted on it, fall
  // back to a timestamp-derived synthetic id so the script can validate the
  // full happy flow against fresh state on every run.
  const canonicalLabId = DEFAULT_LAB_ID_STRING;
  const canonicalHash = ethers.id(canonicalLabId);
  const priorCanonical = await badges.bestMintedStars(player.address, canonicalHash);

  let labIdString = canonicalLabId;
  let labyrinthIdHash = canonicalHash;
  if (priorCanonical >= 1n) {
    labIdString = `smoke-${Date.now()}`;
    labyrinthIdHash = ethers.id(labIdString);
    console.log(
      `Canonical "${canonicalLabId}" already has state for this player (best=${priorCanonical.toString()}). Falling back to ephemeral id "${labIdString}".`
    );
  }
  const campaignIdHash = ethers.ZeroHash;

  const priorStars = await badges.bestMintedStars(player.address, labyrinthIdHash);
  console.log(
    `Prior bestMintedStars(player, "${labIdString}"): ${priorStars.toString()}`
  );

  const domain = {
    name: "LabyrinthBadges",
    version: "1",
    chainId,
    verifyingContract: proxyAddress,
  };
  const types = {
    LabyrinthMint: [
      { name: "player", type: "address" },
      { name: "labyrinthId", type: "bytes32" },
      { name: "moves", type: "uint256" },
      { name: "stars", type: "uint256" },
      { name: "campaignId", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  async function sign(args: {
    moves: bigint;
    stars: bigint;
    nonce: bigint;
    deadline: bigint;
  }) {
    return voucherSigner.signTypedData(domain, types, {
      player: player.address,
      labyrinthId: labyrinthIdHash,
      moves: args.moves,
      stars: args.stars,
      campaignId: campaignIdHash,
      nonce: args.nonce,
      deadline: args.deadline,
    });
  }

  const failures: string[] = [];
  // Use a wide deadline (1 hour) so all subsequent claims share it.
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // Use timestamp-derived nonces to avoid colliding with prior smoke runs.
  const baseNonce = BigInt(Math.floor(Date.now() / 1000));

  // ─────────────────────────── Check 1: 1★ claim ────────────────────────────
  console.log(`\n[1/5] Claim 1★ (moves=5)…`);
  const nonceA = baseNonce;
  const movesA = 5n;
  const starsA = 1n;
  const sigA = await sign({ moves: movesA, stars: starsA, nonce: nonceA, deadline });

  try {
    const tx = await badges
      .connect(player)
      .claimLabyrinthSigned(
        labyrinthIdHash,
        movesA,
        starsA,
        campaignIdHash,
        nonceA,
        deadline,
        sigA
      );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`1★ tx ${tx.hash} did not mine successfully (status=${receipt?.status ?? "null"})`);
    }
    // Pin subsequent reads to the receipt's block so the public RPC's
    // eventual-consistency window doesn't return pre-mine state.
    const blockTag = receipt.blockNumber;
    const tokenId1 = await badges.tokenIdFor(labyrinthIdHash, 1);
    const balance1 = await badges.balanceOf(player.address, tokenId1, { blockTag });
    const best1 = await badges.bestMintedStars(player.address, labyrinthIdHash, { blockTag });

    let foundEvent = false;
    const claimedTopic = badges.interface.getEvent("LabyrinthClaimed").topicHash;
    for (const log of receipt.logs) {
      if (log.topics[0] === claimedTopic) {
        foundEvent = true;
        break;
      }
    }

    console.log(`  tx: ${tx.hash} (block ${blockTag})`);
    console.log(`  tokenId(1★): ${tokenId1.toString()}`);
    console.log(`  balance: ${balance1.toString()}`);
    console.log(`  bestMintedStars: ${best1.toString()}`);

    if (balance1 === 1n) bannerOk("balanceOf == 1");
    else {
      bannerFail("balanceOf != 1", balance1);
      failures.push("balanceOf-after-1star");
    }
    if (best1 === 1n) bannerOk("bestMintedStars == 1");
    else {
      bannerFail("bestMintedStars != 1", best1);
      failures.push("bestMintedStars-after-1star");
    }
    if (foundEvent) bannerOk("LabyrinthClaimed event fired");
    else {
      bannerFail("LabyrinthClaimed event missing");
      failures.push("event-1star");
    }
  } catch (err) {
    bannerFail("1★ claim threw", err);
    failures.push("1star-claim-threw");
  }

  // ─────────────────────────── Check 2: same-tier revert ────────────────────
  console.log(`\n[2/5] Re-claim same 1★ tier — expect StarsNotStrictlyBetter revert…`);
  const nonceB = baseNonce + 1n;
  const sigB = await sign({ moves: movesA, stars: starsA, nonce: nonceB, deadline });
  try {
    await badges
      .connect(player)
      .claimLabyrinthSigned(
        labyrinthIdHash,
        movesA,
        starsA,
        campaignIdHash,
        nonceB,
        deadline,
        sigB
      );
    bannerFail("same-tier re-claim did NOT revert (should have)");
    failures.push("same-tier-no-revert");
  } catch (err) {
    const msg = String(err);
    // Public Celo Sepolia RPC strips custom error names from generic
    // reverts. Accept either the decoded "StarsNotStrictlyBetter" or any
    // generic "execution reverted" — both prove the contract refused.
    if (msg.includes("StarsNotStrictlyBetter") || msg.includes("execution reverted")) {
      bannerOk("revert as expected (same-tier rejected)");
    } else {
      bannerFail("threw with unexpected message", msg.slice(0, 200));
      failures.push("same-tier-wrong-revert");
    }
  }

  // ─────────────────────────── Check 3: improve to 3★ ───────────────────────
  console.log(`\n[3/5] Improve to 3★ (moves=3)…`);
  const nonceC = baseNonce + 2n;
  const movesC = 3n;
  const starsC = 3n;
  const sigC = await sign({ moves: movesC, stars: starsC, nonce: nonceC, deadline });

  let tokenId3: bigint | undefined;
  try {
    const tx = await badges
      .connect(player)
      .claimLabyrinthSigned(
        labyrinthIdHash,
        movesC,
        starsC,
        campaignIdHash,
        nonceC,
        deadline,
        sigC
      );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`3★ tx ${tx.hash} did not mine successfully (status=${receipt?.status ?? "null"})`);
    }
    const blockTag = receipt.blockNumber;
    tokenId3 = await badges.tokenIdFor(labyrinthIdHash, 3);
    const balance3 = await badges.balanceOf(player.address, tokenId3, { blockTag });
    const best3 = await badges.bestMintedStars(player.address, labyrinthIdHash, { blockTag });
    console.log(`  tx: ${tx.hash} (block ${blockTag})`);
    console.log(`  tokenId(3★): ${tokenId3.toString()}`);
    console.log(`  balance(3★): ${balance3.toString()}`);
    console.log(`  bestMintedStars: ${best3.toString()}`);

    if (balance3 === 1n) bannerOk("balance(3★) == 1");
    else {
      bannerFail("balance(3★) != 1", balance3);
      failures.push("balance-after-3star");
    }
    if (best3 === 3n) bannerOk("bestMintedStars == 3");
    else {
      bannerFail("bestMintedStars != 3", best3);
      failures.push("bestMintedStars-after-3star");
    }
  } catch (err) {
    bannerFail("3★ improvement threw", err);
    failures.push("3star-claim-threw");
  }

  // ─────────────────────────── Check 4: soulbound transfer revert ───────────
  console.log(`\n[4/5] safeTransferFrom — expect soulbound revert…`);
  if (!tokenId3) {
    console.log(`  ⚠ skipping (3★ claim did not produce a tokenId)`);
  } else {
    try {
      await badges
        .connect(player)
        .safeTransferFrom(player.address, ethers.Wallet.createRandom().address, tokenId3, 1n, "0x");
      bannerFail("safeTransferFrom did NOT revert (should have)");
      failures.push("transfer-no-revert");
    } catch (err) {
      const msg = String(err);
      if (msg.includes("non-transferable") || msg.includes("execution reverted")) {
        bannerOk("soulbound revert as expected");
      } else {
        bannerFail("threw with unexpected message", msg.slice(0, 200));
        failures.push("transfer-wrong-revert");
      }
    }
  }

  // ─────────────────────────── Check 5: uri(tokenId) ────────────────────────
  console.log(`\n[5/5] uri(tokenId) format…`);
  if (!tokenId3) {
    console.log(`  ⚠ skipping (no tokenId available)`);
  } else {
    try {
      const baseURI = await badges.baseURI();
      const uri = await badges.uri(tokenId3);
      const expected = `${baseURI}${tokenId3.toString()}.json`;
      console.log(`  baseURI: ${baseURI}`);
      console.log(`  uri:     ${uri}`);
      if (uri === expected) bannerOk("uri matches baseURI + tokenId + .json");
      else {
        bannerFail("uri mismatch", `expected ${expected}`);
        failures.push("uri-mismatch");
      }
    } catch (err) {
      bannerFail("uri call threw", err);
      failures.push("uri-threw");
    }
  }

  console.log(`\n────────────────────────────────────────────────────`);
  if (failures.length === 0) {
    console.log(`✅ All smoke checks passed against ${network.name}.`);
  } else {
    console.log(`❌ ${failures.length} check(s) failed: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
