import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("Badges", function () {
  async function deployBadgesFixture() {
    const [owner, player, otherPlayer] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    const badges = await hre.viem.deployContract("Badges", [
      "ipfs://chesscito/badges/",
      owner.account.address,
    ]);

    return {
      owner,
      player,
      otherPlayer,
      publicClient,
      badges,
    };
  }

  it("sets owner and metadata uri scheme", async function () {
    const { owner, badges } = await loadFixture(deployBadgesFixture);

    expect(await badges.read.owner()).to.equal(getAddress(owner.account.address));
    expect(await badges.read.uri([3n])).to.equal("ipfs://chesscito/badges/3.json");
  });

  it("mints one badge per wallet and level", async function () {
    const { player, publicClient, badges } = await loadFixture(deployBadgesFixture);
    const badgesAsPlayer = await hre.viem.getContractAt("Badges", badges.address, {
      client: { wallet: player },
    });

    const hash = await badgesAsPlayer.write.claimBadge([1n]);
    await publicClient.waitForTransactionReceipt({ hash });

    expect(await badges.read.hasClaimedBadge([getAddress(player.account.address), 1n])).to.equal(true);
    expect(await badges.read.balanceOf([getAddress(player.account.address), 1n])).to.equal(1n);

    const events = await badges.getEvents.BadgeClaimed();
    expect(events).to.have.length(1);
    expect(events[0].args.player).to.equal(getAddress(player.account.address));
    expect(events[0].args.levelId).to.equal(1n);
    expect(events[0].args.tokenId).to.equal(1n);
  });

  it("prevents claiming the same level twice for the same wallet", async function () {
    const { player, badges } = await loadFixture(deployBadgesFixture);
    const badgesAsPlayer = await hre.viem.getContractAt("Badges", badges.address, {
      client: { wallet: player },
    });

    await badgesAsPlayer.write.claimBadge([2n]);

    await expect(badgesAsPlayer.write.claimBadge([2n])).to.be.rejectedWith("BadgeAlreadyClaimed");
  });

  it("allows different wallets to claim the same level", async function () {
    const { player, otherPlayer, badges } = await loadFixture(deployBadgesFixture);
    const badgesAsPlayer = await hre.viem.getContractAt("Badges", badges.address, {
      client: { wallet: player },
    });
    const badgesAsOtherPlayer = await hre.viem.getContractAt("Badges", badges.address, {
      client: { wallet: otherPlayer },
    });

    await badgesAsPlayer.write.claimBadge([4n]);
    await badgesAsOtherPlayer.write.claimBadge([4n]);

    expect(await badges.read.balanceOf([getAddress(player.account.address), 4n])).to.equal(1n);
    expect(await badges.read.balanceOf([getAddress(otherPlayer.account.address), 4n])).to.equal(1n);
  });

  it("lets the owner update the base uri", async function () {
    const { badges } = await loadFixture(deployBadgesFixture);

    await badges.write.setBaseURI(["https://assets.chesscito.xyz/badges/"]);

    expect(await badges.read.uri([7n])).to.equal("https://assets.chesscito.xyz/badges/7.json");
  });
});
