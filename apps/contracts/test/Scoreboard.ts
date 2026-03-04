import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("Scoreboard", function () {
  async function deployScoreboardFixture() {
    const [owner, player] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    const scoreboard = await hre.viem.deployContract("Scoreboard", [
      60n,
      2n,
      owner.account.address,
    ]);

    return {
      owner,
      player,
      publicClient,
      scoreboard,
    };
  }

  it("sets constructor config", async function () {
    const { owner, scoreboard } = await loadFixture(deployScoreboardFixture);

    expect(await scoreboard.read.owner()).to.equal(getAddress(owner.account.address));
    expect(await scoreboard.read.submitCooldown()).to.equal(60n);
    expect(await scoreboard.read.maxSubmissionsPerDay()).to.equal(2n);
  });

  it("emits ScoreSubmitted and stores timestamps", async function () {
    const { player, publicClient, scoreboard } = await loadFixture(deployScoreboardFixture);
    const scoreboardAsPlayer = await hre.viem.getContractAt("Scoreboard", scoreboard.address, {
      client: { wallet: player },
    });

    const hash = await scoreboardAsPlayer.write.submitScore([1n, 250n, 15000n, 99n]);
    await publicClient.waitForTransactionReceipt({ hash });

    const events = await scoreboard.getEvents.ScoreSubmitted();
    expect(events).to.have.length(1);
    expect(events[0].args.player).to.equal(getAddress(player.account.address));
    expect(events[0].args.levelId).to.equal(1n);
    expect(events[0].args.score).to.equal(250n);
    expect(events[0].args.timeMs).to.equal(15000n);
    expect(events[0].args.nonce).to.equal(99n);
    expect(await scoreboard.read.lastSubmissionAt([getAddress(player.account.address)]) > 0n).to.equal(
      true
    );
  });

  it("blocks submissions during cooldown", async function () {
    const { player, scoreboard } = await loadFixture(deployScoreboardFixture);
    const scoreboardAsPlayer = await hre.viem.getContractAt("Scoreboard", scoreboard.address, {
      client: { wallet: player },
    });

    await scoreboardAsPlayer.write.submitScore([1n, 250n, 15000n, 1n]);

    await expect(scoreboardAsPlayer.write.submitScore([1n, 250n, 15000n, 2n])).to.be.rejectedWith(
      "CooldownActive"
    );
  });

  it("enforces the daily limit and resets on the next day", async function () {
    const { player, scoreboard } = await loadFixture(deployScoreboardFixture);
    const scoreboardAsPlayer = await hre.viem.getContractAt("Scoreboard", scoreboard.address, {
      client: { wallet: player },
    });

    await scoreboard.write.setSubmitCooldown([0n]);

    await scoreboardAsPlayer.write.submitScore([1n, 10n, 1000n, 1n]);
    await scoreboardAsPlayer.write.submitScore([1n, 11n, 1001n, 2n]);

    await expect(scoreboardAsPlayer.write.submitScore([1n, 12n, 1002n, 3n])).to.be.rejectedWith(
      "DailyLimitReached"
    );

    await time.increase(1 * 24 * 60 * 60);

    await expect(scoreboardAsPlayer.write.submitScore([1n, 12n, 1002n, 4n])).to.be.fulfilled;
  });

  it("lets the owner update anti-spam config", async function () {
    const { scoreboard } = await loadFixture(deployScoreboardFixture);

    await scoreboard.write.setSubmitCooldown([120n]);
    await scoreboard.write.setMaxSubmissionsPerDay([5n]);

    expect(await scoreboard.read.submitCooldown()).to.equal(120n);
    expect(await scoreboard.read.maxSubmissionsPerDay()).to.equal(5n);
  });
});
