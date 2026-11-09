import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("ScoreboardUpgradeable", function () {
  async function deployScoreboardFixture() {
    const [owner, player] = await ethers.getSigners();
    const signingWallet = ethers.Wallet.createRandom();
    const factory = await ethers.getContractFactory("ScoreboardUpgradeable");
    const scoreboard = await upgrades.deployProxy(factory, [60n, 2n, signingWallet.address, owner.address], {
      kind: "transparent",
      initializer: "initialize",
    });

    await scoreboard.waitForDeployment();

    return {
      owner,
      player,
      scoreboard,
      signingWallet,
      chainId: (await ethers.provider.getNetwork()).chainId,
    };
  }

  async function signSubmission({
    player,
    levelId,
    score,
    timeMs,
    nonce,
    deadline,
    signer,
    chainId,
    verifyingContract,
  }: {
    player: string;
    levelId: bigint;
    score: bigint;
    timeMs: bigint;
    nonce: bigint;
    deadline: bigint;
    signer: ethers.Wallet;
    chainId: bigint;
    verifyingContract: string;
  }) {
    return signer.signTypedData(
      {
        name: "Scoreboard",
        version: "1",
        chainId,
        verifyingContract,
      },
      {
        ScoreSubmission: [
          { name: "player", type: "address" },
          { name: "levelId", type: "uint256" },
          { name: "score", type: "uint256" },
          { name: "timeMs", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player,
        levelId,
        score,
        timeMs,
        nonce,
        deadline,
      }
    );
  }

  it("sets initialize config through proxy", async function () {
    const { owner, scoreboard, signingWallet } = await loadFixture(deployScoreboardFixture);

    expect(await scoreboard.owner()).to.equal(owner.address);
    expect(await scoreboard.submitCooldown()).to.equal(60n);
    expect(await scoreboard.maxSubmissionsPerDay()).to.equal(2n);
    expect(await scoreboard.signer()).to.equal(signingWallet.address);
  });

  it("emits ScoreSubmitted, tracks nonce usage, and stores timestamps", async function () {
    const { player, scoreboard, signingWallet, chainId } = await loadFixture(deployScoreboardFixture);
    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 250n,
      timeMs: 15000n,
      nonce: 99n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: await scoreboard.getAddress(),
    });

    await scoreboard.connect(player).submitScoreSigned(1n, 250n, 15000n, 99n, deadline, signature);

    expect(await scoreboard.usedNonces(player.address, 99n)).to.equal(true);
    expect(await scoreboard.lastSubmissionAt(player.address)).to.not.equal(0n);
  });

  it("blocks submissions during cooldown", async function () {
    const { player, scoreboard, signingWallet, chainId } = await loadFixture(deployScoreboardFixture);
    const verifyingContract = await scoreboard.getAddress();
    const deadline = BigInt((await time.latest()) + 600);

    const firstSignature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 250n,
      timeMs: 15000n,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract,
    });
    await scoreboard.connect(player).submitScoreSigned(1n, 250n, 15000n, 1n, deadline, firstSignature);

    const secondSignature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 251n,
      timeMs: 15001n,
      nonce: 2n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract,
    });

    await expect(
      scoreboard.connect(player).submitScoreSigned(1n, 251n, 15001n, 2n, deadline, secondSignature)
    ).to.be.rejectedWith("CooldownActive");
  });

  it("enforces the daily limit, rejects nonce replay, and resets on the next day", async function () {
    const { owner, player, scoreboard, signingWallet, chainId } = await loadFixture(deployScoreboardFixture);
    const verifyingContract = await scoreboard.getAddress();
    const deadline = BigInt((await time.latest()) + 600);

    await scoreboard.connect(owner).setSubmitCooldown(0n);

    for (const [nonce, score] of [
      [11n, 10n],
      [12n, 11n],
    ] as const) {
      const signature = await signSubmission({
        player: player.address,
        levelId: 1n,
        score,
        timeMs: 1000n + nonce,
        nonce,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract,
      });
      await scoreboard.connect(player).submitScoreSigned(1n, score, 1000n + nonce, nonce, deadline, signature);
    }

    const limitedSignature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 12n,
      timeMs: 1003n,
      nonce: 13n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract,
    });

    await expect(
      scoreboard.connect(player).submitScoreSigned(1n, 12n, 1003n, 13n, deadline, limitedSignature)
    ).to.be.rejectedWith("DailyLimitReached");

    const replaySignature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 13n,
      timeMs: 1004n,
      nonce: 12n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract,
    });

    await expect(
      scoreboard.connect(player).submitScoreSigned(1n, 13n, 1004n, 12n, deadline, replaySignature)
    ).to.be.rejectedWith("NonceUsed");

    await time.increase(24 * 60 * 60);

    const nextDayDeadline = BigInt((await time.latest()) + 600);
    const nextDaySignature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 14n,
      timeMs: 1005n,
      nonce: 14n,
      deadline: nextDayDeadline,
      signer: signingWallet,
      chainId,
      verifyingContract,
    });

    await scoreboard
      .connect(player)
      .submitScoreSigned(1n, 14n, 1005n, 14n, nextDayDeadline, nextDaySignature);
  });

  it("lets the owner update config, pauses submissions, and rejects expired signatures", async function () {
    const { owner, player, scoreboard, signingWallet, chainId } = await loadFixture(deployScoreboardFixture);
    const verifyingContract = await scoreboard.getAddress();
    const deadline = BigInt((await time.latest()) + 60);

    await scoreboard.connect(owner).setSubmitCooldown(120n);
    await scoreboard.connect(owner).setMaxSubmissionsPerDay(5n);

    await time.increase(61);

    const expiredSignature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 250n,
      timeMs: 15000n,
      nonce: 40n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract,
    });

    await expect(
      scoreboard.connect(player).submitScoreSigned(1n, 250n, 15000n, 40n, deadline, expiredSignature)
    ).to.be.rejectedWith("SignatureExpired");

    await scoreboard.connect(owner).pause();

    const freshDeadline = BigInt((await time.latest()) + 600);
    const pausedSignature = await signSubmission({
      player: player.address,
      levelId: 1n,
      score: 251n,
      timeMs: 15001n,
      nonce: 41n,
      deadline: freshDeadline,
      signer: signingWallet,
      chainId,
      verifyingContract,
    });

    await expect(
      scoreboard.connect(player).submitScoreSigned(1n, 251n, 15001n, 41n, freshDeadline, pausedSignature)
    ).to.be.rejectedWith("EnforcedPause()");
  });
});
