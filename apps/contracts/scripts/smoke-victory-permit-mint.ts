// scripts/smoke-victory-permit-mint.ts
// Smoke test for mintSignedWithPermit on the VictoryNFTUpgradeable proxy —
// mints a real victory token on celo-sepolia using an EIP-712 voucher +
// an EIP-2612 permit signature, with NO prior approve() call (that's the
// whole point of the permit-mint path).
//
// NEVER runs on mainnet. The script aborts with a hard error if
// network.name === "celo".
//
// Required env:
//   SIGNER_PRIVATE_KEY — raw key matching the contract's on-chain signer()
//
// Prerequisite: run deploy-mock-permit-token.ts first so
// deployments/<network>.json has victoryNFTPermitTestToken with a minted
// balance for the deployer wallet.
//
// Usage:
//   npx hardhat run scripts/smoke-victory-permit-mint.ts --network celo-sepolia

import fs from "node:fs/promises";
import path from "node:path";

import { ethers, network } from "hardhat";

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

type DeploymentRecord = {
  victoryNFTProxy?: string;
  victoryNFTPermitTestToken?: string;
  victoryNFTPermitTestTokenDecimals?: number;
};

async function main() {
  if (network.name === "celo") {
    throw new Error("Smoke script refuses to run on celo (mainnet).");
  }

  const { chainId } = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}`);

  const deploymentPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  const record = JSON.parse(await fs.readFile(deploymentPath, "utf8")) as DeploymentRecord;

  const proxyAddress = record.victoryNFTProxy;
  const tokenAddress = record.victoryNFTPermitTestToken;
  const tokenDecimals = record.victoryNFTPermitTestTokenDecimals;
  if (!proxyAddress) throw new Error(`No victoryNFTProxy in deployments/${network.name}.json`);
  if (!tokenAddress || tokenDecimals === undefined) {
    throw new Error(
      `No victoryNFTPermitTestToken in deployments/${network.name}.json. ` +
        "Run deploy-mock-permit-token.ts first."
    );
  }
  console.log(`VictoryNFT proxy: ${proxyAddress}`);
  console.log(`Permit test token: ${tokenAddress} (${tokenDecimals} decimals)`);

  const [deployer] = await ethers.getSigners();
  const player = deployer;
  console.log(`Player (deployer): ${player.address}`);

  const signerKey = requireEnv("SIGNER_PRIVATE_KEY");
  const voucherSigner = new ethers.Wallet(signerKey);

  const victory = await ethers.getContractAt("VictoryNFTUpgradeable", proxyAddress);
  const token = await ethers.getContractAt("MockERC20Permit", tokenAddress);

  const onChainSigner: string = await victory.signer();
  if (onChainSigner.toLowerCase() !== voucherSigner.address.toLowerCase()) {
    throw new Error(`SIGNER_PRIVATE_KEY does not match on-chain signer (${onChainSigner}).`);
  }
  console.log(`On-chain signer matches SIGNER_PRIVATE_KEY ✔`);

  const balance: bigint = await token.balanceOf(player.address);
  console.log(`Player token balance: ${balance.toString()}`);

  const treasury: string = await victory.treasury();
  const prizePool: string = await victory.prizePool();

  const difficulty = 1; // Easy — $0.005
  const priceUsd6: bigint = await victory.priceUsd6(difficulty);
  if (priceUsd6 === 0n) throw new Error(`No price set for difficulty ${difficulty}`);
  const totalAmount =
    tokenDecimals >= 6
      ? priceUsd6 * 10n ** BigInt(tokenDecimals - 6)
      : priceUsd6 / 10n ** BigInt(6 - tokenDecimals);

  if (balance < totalAmount) {
    throw new Error(
      `Player balance ${balance} < required ${totalAmount}. Re-run deploy-mock-permit-token.ts.`
    );
  }

  const failures: string[] = [];
  const now = Math.floor(Date.now() / 1000);
  const voucherDeadline = BigInt(now + 600);
  const permitDeadline = BigInt(now + 600);
  const nonce = BigInt(now); // timestamp-derived, avoids colliding with prior smoke runs

  console.log(`\n[1/2] Sign voucher + permit, call mintSignedWithPermit (no prior approve)…`);

  const voucherSig = await voucherSigner.signTypedData(
    { name: "VictoryNFT", version: "1", chainId, verifyingContract: proxyAddress },
    {
      VictoryMint: [
        { name: "player", type: "address" },
        { name: "difficulty", type: "uint8" },
        { name: "totalMoves", type: "uint16" },
        { name: "timeMs", type: "uint32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    { player: player.address, difficulty, totalMoves: 20, timeMs: 45_000, nonce, deadline: voucherDeadline }
  );

  const permitNonce: bigint = await token.nonces(player.address);
  const tokenName: string = await token.name();
  const permitSignature = await player.signTypedData(
    { name: tokenName, version: "1", chainId, verifyingContract: tokenAddress },
    {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    { owner: player.address, spender: proxyAddress, value: totalAmount, nonce: permitNonce, deadline: permitDeadline }
  );
  const { v, r, s } = ethers.Signature.from(permitSignature);

  try {
    const tx = await victory
      .connect(player)
      .mintSignedWithPermit(
        difficulty,
        20,
        45_000,
        tokenAddress,
        nonce,
        voucherDeadline,
        voucherSig,
        permitDeadline,
        v,
        r,
        s
      );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`tx ${tx.hash} did not mine successfully (status=${receipt?.status ?? "null"})`);
    }
    console.log(`  tx: ${tx.hash} (block ${receipt.blockNumber})`);

    // No blockTag pinning here: forno.celo-sepolia load-balances across
    // multiple nodes, and a read explicitly pinned to receipt.blockNumber
    // can hit a node that hasn't indexed that height yet ("block is out
    // of range" — observed 2026-07-03). A short settle delay + plain
    // "latest" reads are more robust against that than pinning.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const totalMinted: bigint = await victory.totalMinted();
    const tokenId = totalMinted; // _nextTokenId starts at 1, increments post-mint
    const ownerOfToken: string = await victory.ownerOf(tokenId);
    const victoryData = await victory.getVictory(tokenId);

    console.log(`  tokenId: ${tokenId.toString()}`);
    console.log(`  owner: ${ownerOfToken}`);
    console.log(`  difficulty: ${victoryData.difficulty}, totalMoves: ${victoryData.totalMoves}`);

    if (ownerOfToken.toLowerCase() === player.address.toLowerCase()) bannerOk("ownerOf(tokenId) == player");
    else {
      bannerFail("ownerOf(tokenId) != player", ownerOfToken);
      failures.push("owner-mismatch");
    }
    if (Number(victoryData.difficulty) === difficulty) bannerOk("VictoryData.difficulty matches");
    else {
      bannerFail("VictoryData.difficulty mismatch", victoryData.difficulty);
      failures.push("difficulty-mismatch");
    }

    let foundEvent = false;
    const mintedTopic = victory.interface.getEvent("VictoryMinted").topicHash;
    for (const log of receipt.logs) {
      if (log.topics[0] === mintedTopic) {
        foundEvent = true;
        break;
      }
    }
    if (foundEvent) bannerOk("VictoryMinted event fired");
    else {
      bannerFail("VictoryMinted event missing");
      failures.push("event-missing");
    }

    console.log(`\n[2/2] Verify 80/20 payment split (no prior approve() anywhere above)…`);
    // Read Transfer events directly rather than diffing balances: on this
    // network treasury happens to equal the player wallet (a placeholder
    // from the original testnet deploy), which makes the treasury leg a
    // self-transfer with zero net balance change — a before/after delta
    // would wrongly read as "money missing" even though the contract
    // correctly executed both transferFrom calls. Events fire for
    // self-transfers too, so they verify the real on-chain behavior
    // regardless of address collisions.
    const expectedTreasury = (totalAmount * 80n) / 100n;
    const expectedPrizePool = totalAmount - expectedTreasury;

    const transferTopic = token.interface.getEvent("Transfer").topicHash;
    const transfers = receipt.logs
      .filter((log) => log.address.toLowerCase() === tokenAddress.toLowerCase() && log.topics[0] === transferTopic)
      .map((log) => token.interface.decodeEventLog("Transfer", log.data, log.topics));

    const treasuryTransfer = transfers.find(
      (t) => t.from.toLowerCase() === player.address.toLowerCase() && t.to.toLowerCase() === treasury.toLowerCase()
    );
    const prizePoolTransfer = transfers.find(
      (t) => t.from.toLowerCase() === player.address.toLowerCase() && t.to.toLowerCase() === prizePool.toLowerCase()
    );

    console.log(
      `  treasury Transfer: ${treasuryTransfer ? treasuryTransfer.value.toString() : "none"} ` +
        `(expected ${expectedTreasury.toString()})`
    );
    console.log(
      `  prizePool Transfer: ${prizePoolTransfer ? prizePoolTransfer.value.toString() : "none"} ` +
        `(expected ${expectedPrizePool.toString()})`
    );

    if (treasuryTransfer && treasuryTransfer.value === expectedTreasury) bannerOk("treasury received 80%");
    else {
      bannerFail("treasury split wrong", treasuryTransfer?.value);
      failures.push("treasury-split");
    }
    if (prizePoolTransfer && prizePoolTransfer.value === expectedPrizePool) bannerOk("prizePool received 20%");
    else {
      bannerFail("prizePool split wrong", prizePoolTransfer?.value);
      failures.push("prizepool-split");
    }

    if (treasury.toLowerCase() === player.address.toLowerCase()) {
      console.log("  ℹ treasury == player on this network (testnet placeholder) — self-transfer, balance delta 0 by design.");
    }
  } catch (err) {
    bannerFail("mintSignedWithPermit threw", err);
    failures.push("mint-threw");
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
