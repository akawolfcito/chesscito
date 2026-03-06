import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Shop", function () {
  async function deployShopFixture() {
    const [owner, buyer, treasury] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("MockUSDC");
    const token = await tokenFactory.deploy();
    await token.waitForDeployment();

    const shopFactory = await ethers.getContractFactory("Shop");
    const shop = await shopFactory.deploy(owner.address, await token.getAddress(), treasury.address, 10n);
    await shop.waitForDeployment();

    await token.mint(buyer.address, 1_000_000_000n);

    return { owner, buyer, treasury, token, shop };
  }

  it("buys configured items and transfers stablecoin to treasury", async function () {
    const { owner, buyer, treasury, token, shop } = await loadFixture(deployShopFixture);

    await shop.connect(owner).setItem(1n, 10_000n, true);
    await token.connect(buyer).approve(await shop.getAddress(), 20_000n);

    await shop.connect(buyer).buyItem(1n, 2n);

    expect(await token.balanceOf(treasury.address)).to.equal(20_000n);
  });

  it("reverts when qty is zero", async function () {
    const { owner, buyer, shop } = await loadFixture(deployShopFixture);

    await shop.connect(owner).setItem(1n, 10_000n, true);

    await expect(shop.connect(buyer).buyItem(1n, 0n)).to.be.rejectedWith("InvalidQuantity");
  });

  it("reverts when allowance is insufficient", async function () {
    const { owner, buyer, shop } = await loadFixture(deployShopFixture);

    await shop.connect(owner).setItem(1n, 10_000n, true);

    await expect(shop.connect(buyer).buyItem(1n, 1n)).to.be.rejectedWith("ERC20InsufficientAllowance");
  });
});
