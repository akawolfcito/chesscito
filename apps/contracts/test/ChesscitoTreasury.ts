import "@nomicfoundation/hardhat-chai-matchers";

import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ChesscitoTreasury", function () {
  async function deployFixture() {
    const [owner, user, payout, nextPayout, recipient, pendingOwner] =
      await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("MockERC20");
    const accepted = await tokenFactory.deploy("Accepted USD", "aUSD", 6);
    const unsupported = await tokenFactory.deploy("Unsupported USD", "uUSD", 6);
    await accepted.waitForDeployment();
    await unsupported.waitForDeployment();

    const treasuryFactory = await ethers.getContractFactory("ChesscitoTreasury");
    const treasury = await treasuryFactory.deploy(owner.address, payout.address);
    await treasury.waitForDeployment();

    await accepted.mint(user.address, 1_000_000n);
    await unsupported.mint(user.address, 1_000_000n);

    return {
      owner,
      user,
      payout,
      nextPayout,
      recipient,
      pendingOwner,
      accepted,
      unsupported,
      treasury,
    };
  }

  it("stores owner and payout address", async function () {
    const { owner, payout, treasury } = await loadFixture(deployFixture);
    expect(await treasury.owner()).to.equal(owner.address);
    expect(await treasury.payoutAddress()).to.equal(payout.address);
  });

  it("holds a direct ERC20 transfer without user approval", async function () {
    const { user, accepted, treasury } = await loadFixture(deployFixture);
    const treasuryAddress = await treasury.getAddress();

    await accepted.connect(user).transfer(treasuryAddress, 10_000n);

    expect(await accepted.balanceOf(treasuryAddress)).to.equal(10_000n);
    expect(await accepted.allowance(user.address, treasuryAddress)).to.equal(0n);
  });

  it("updates accepted-token metadata only for the owner", async function () {
    const { owner, user, accepted, treasury } = await loadFixture(deployFixture);
    const tokenAddress = await accepted.getAddress();

    await expect(treasury.connect(owner).setAcceptedToken(tokenAddress, true))
      .to.emit(treasury, "AcceptedTokenUpdated")
      .withArgs(tokenAddress, true);
    expect(await treasury.acceptedToken(tokenAddress)).to.equal(true);

    await expect(
      treasury.connect(user).setAcceptedToken(tokenAddress, false),
    ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
  });

  it("withdraws accepted and unsupported tokens to any valid recipient", async function () {
    const { owner, user, recipient, accepted, unsupported, treasury } =
      await loadFixture(deployFixture);
    const treasuryAddress = await treasury.getAddress();
    const acceptedAddress = await accepted.getAddress();
    const unsupportedAddress = await unsupported.getAddress();

    await accepted.connect(user).transfer(treasuryAddress, 20_000n);
    await unsupported.connect(user).transfer(treasuryAddress, 30_000n);
    await treasury.connect(owner).setAcceptedToken(acceptedAddress, true);

    await expect(treasury.connect(owner).withdrawToken(acceptedAddress, recipient.address, 20_000n))
      .to.emit(treasury, "TokenWithdrawn")
      .withArgs(acceptedAddress, recipient.address, 20_000n);
    await treasury.connect(owner).withdrawToken(unsupportedAddress, recipient.address, 30_000n);

    expect(await accepted.balanceOf(recipient.address)).to.equal(20_000n);
    expect(await unsupported.balanceOf(recipient.address)).to.equal(30_000n);
  });

  it("updates payout and withdraws to it", async function () {
    const { owner, user, payout, nextPayout, accepted, treasury } =
      await loadFixture(deployFixture);
    const treasuryAddress = await treasury.getAddress();
    const tokenAddress = await accepted.getAddress();

    await accepted.connect(user).transfer(treasuryAddress, 12_000n);
    await expect(treasury.connect(owner).setPayoutAddress(nextPayout.address))
      .to.emit(treasury, "PayoutAddressUpdated")
      .withArgs(payout.address, nextPayout.address);
    await treasury.connect(owner).withdrawTokenToPayout(tokenAddress, 12_000n);

    expect(await accepted.balanceOf(nextPayout.address)).to.equal(12_000n);
  });

  it("uses two-step ownership transfer", async function () {
    const { owner, pendingOwner, treasury } = await loadFixture(deployFixture);

    await treasury.connect(owner).transferOwnership(pendingOwner.address);
    expect(await treasury.owner()).to.equal(owner.address);
    expect(await treasury.pendingOwner()).to.equal(pendingOwner.address);

    await treasury.connect(pendingOwner).acceptOwnership();
    expect(await treasury.owner()).to.equal(pendingOwner.address);
  });

  it("disables ownership renunciation so held funds cannot be stranded", async function () {
    const { owner, treasury } = await loadFixture(deployFixture);
    await expect(treasury.connect(owner).renounceOwnership()).to.be.revertedWithCustomError(
      treasury,
      "OwnershipRenunciationDisabled",
    );
  });

  it("rejects unauthorized payout and withdrawal operations", async function () {
    const { user, nextPayout, accepted, treasury } = await loadFixture(deployFixture);
    const tokenAddress = await accepted.getAddress();

    await expect(
      treasury.connect(user).setPayoutAddress(nextPayout.address),
    ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    await expect(
      treasury.connect(user).withdrawToken(tokenAddress, user.address, 1n),
    ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    await expect(
      treasury.connect(user).withdrawTokenToPayout(tokenAddress, 1n),
    ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
  });

  it("rejects invalid payout and token addresses", async function () {
    const { owner, payout, treasury } = await loadFixture(deployFixture);
    const factory = await ethers.getContractFactory("ChesscitoTreasury");

    await expect(factory.deploy(owner.address, ethers.ZeroAddress)).to.be.revertedWithCustomError(
      treasury,
      "InvalidAddress",
    );
    await expect(
      treasury.connect(owner).setAcceptedToken(ethers.ZeroAddress, true),
    ).to.be.revertedWithCustomError(treasury, "InvalidAddress");
    await expect(
      treasury.connect(owner).setPayoutAddress(payout.address),
    ).to.be.revertedWithCustomError(treasury, "SamePayoutAddress");
    await expect(
      treasury.connect(owner).setPayoutAddress(await treasury.getAddress()),
    ).to.be.revertedWithCustomError(treasury, "InvalidAddress");
  });
});
