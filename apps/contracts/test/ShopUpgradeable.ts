import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("ShopUpgradeable", function () {
  async function deployFixture() {
    const [owner, buyer, treasury, other] = await ethers.getSigners();

    // Deploy mock tokens: 6-dec (USDC-like), 6-dec (USDT-like), 18-dec (cUSD-like)
    const mockFactory = await ethers.getContractFactory("MockERC20");
    const usdc = await mockFactory.deploy("Mock USDC", "USDC", 6);
    const usdt = await mockFactory.deploy("Mock USDT", "USDT", 6);
    const cusd = await mockFactory.deploy("Mock cUSD", "cUSD", 18);
    await Promise.all([usdc.waitForDeployment(), usdt.waitForDeployment(), cusd.waitForDeployment()]);

    // Deploy ShopUpgradeable via transparent proxy
    const shopFactory = await ethers.getContractFactory("ShopUpgradeable");
    const shop = await upgrades.deployProxy(
      shopFactory,
      [treasury.address, 10n, owner.address],
      {
        kind: "transparent",
        initializer: "initialize",
        initialOwner: owner.address,
        unsafeAllow: ["constructor"],
      }
    );
    await shop.waitForDeployment();

    // Configure accepted tokens
    await shop.connect(owner).setAcceptedToken(await usdc.getAddress(), 6);
    await shop.connect(owner).setAcceptedToken(await usdt.getAddress(), 6);
    await shop.connect(owner).setAcceptedToken(await cusd.getAddress(), 18);

    // Configure items: Founder Badge = $0.10, Retry Shield = $0.025
    await shop.connect(owner).setItem(1n, 100_000n, true);
    await shop.connect(owner).setItem(2n, 25_000n, true);

    // Mint tokens to buyer
    await usdc.mint(buyer.address, 1_000_000n);             // 1 USDC
    await usdt.mint(buyer.address, 1_000_000n);             // 1 USDT
    await cusd.mint(buyer.address, ethers.parseEther("1")); // 1 cUSD

    return { owner, buyer, treasury, other, usdc, usdt, cusd, shop };
  }

  // ── Purchase with 6-decimal token ────────────────────────────────────
  describe("buyItem with 6-decimal token", function () {
    it("transfers correct amount to treasury", async function () {
      const { buyer, treasury, usdc, shop } = await loadFixture(deployFixture);
      const shopAddr = await shop.getAddress();

      await usdc.connect(buyer).approve(shopAddr, 100_000n);
      await shop.connect(buyer).buyItem(1n, 1n, await usdc.getAddress());

      expect(await usdc.balanceOf(treasury.address)).to.equal(100_000n);
    });

    it("transfers correct amount for quantity > 1", async function () {
      const { buyer, treasury, usdt, shop } = await loadFixture(deployFixture);
      const shopAddr = await shop.getAddress();

      // 2x Retry Shield = 2 * 25000 = 50000
      await usdt.connect(buyer).approve(shopAddr, 50_000n);
      await shop.connect(buyer).buyItem(2n, 2n, await usdt.getAddress());

      expect(await usdt.balanceOf(treasury.address)).to.equal(50_000n);
    });

    it("emits ItemPurchased with correct values", async function () {
      const { buyer, treasury, usdc, shop } = await loadFixture(deployFixture);
      const shopAddr = await shop.getAddress();
      const usdcAddr = await usdc.getAddress();

      await usdc.connect(buyer).approve(shopAddr, 100_000n);
      const tx = await shop.connect(buyer).buyItem(1n, 1n, usdcAddr);
      const receipt = await tx.wait();

      // Parse event from receipt logs
      const iface = shop.interface;
      const event = receipt!.logs
        .map((log) => { try { return iface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === "ItemPurchased");

      expect(event).to.not.be.null;
      expect(event!.args[0]).to.equal(buyer.address);     // buyer
      expect(event!.args[1]).to.equal(1n);                 // itemId
      expect(event!.args[2]).to.equal(1n);                 // quantity
      expect(event!.args[3]).to.equal(100_000n);           // unitPriceUsd6
      expect(event!.args[4]).to.equal(100_000n);           // totalTokenAmount
      expect(event!.args[5]).to.equal(usdcAddr);           // token
      expect(event!.args[6]).to.equal(treasury.address);   // treasury
    });
  });

  // ── Purchase with 18-decimal token ───────────────────────────────────
  describe("buyItem with 18-decimal token (cUSD)", function () {
    it("normalizes price correctly (priceUsd6 * 10^12)", async function () {
      const { buyer, treasury, cusd, shop } = await loadFixture(deployFixture);
      const shopAddr = await shop.getAddress();

      // Item 2 = 25000 (usd6) → 25000 * 10^12 = 25_000_000_000_000_000 in 18-dec
      const expected = 25_000n * 10n ** 12n;
      await cusd.connect(buyer).approve(shopAddr, expected);
      await shop.connect(buyer).buyItem(2n, 1n, await cusd.getAddress());

      expect(await cusd.balanceOf(treasury.address)).to.equal(expected);
    });
  });

  // ── Rejection cases ──────────────────────────────────────────────────
  describe("reverts", function () {
    it("rejects unaccepted token", async function () {
      const { buyer, shop } = await loadFixture(deployFixture);
      const mockFactory = await ethers.getContractFactory("MockERC20");
      const rogue = await mockFactory.deploy("Rogue", "RGE", 6);
      await rogue.waitForDeployment();

      await expect(
        shop.connect(buyer).buyItem(1n, 1n, await rogue.getAddress())
      ).to.be.rejectedWith("TokenNotAccepted");
    });

    it("rejects token address(0)", async function () {
      const { buyer, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(buyer).buyItem(1n, 1n, ethers.ZeroAddress)
      ).to.be.rejectedWith("InvalidAddress");
    });

    it("rejects disabled item", async function () {
      const { owner, buyer, usdc, shop } = await loadFixture(deployFixture);
      await shop.connect(owner).disableItem(1n);

      await expect(
        shop.connect(buyer).buyItem(1n, 1n, await usdc.getAddress())
      ).to.be.rejectedWith("ItemDisabled");
    });

    it("rejects unconfigured item", async function () {
      const { buyer, usdc, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(buyer).buyItem(99n, 1n, await usdc.getAddress())
      ).to.be.rejectedWith("ItemNotConfigured");
    });

    it("rejects zero quantity", async function () {
      const { buyer, usdc, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(buyer).buyItem(1n, 0n, await usdc.getAddress())
      ).to.be.rejectedWith("InvalidQuantity");
    });

    it("rejects quantity exceeding max", async function () {
      const { buyer, usdc, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(buyer).buyItem(1n, 11n, await usdc.getAddress())
      ).to.be.rejectedWith("QuantityExceedsMax");
    });

    it("rejects insufficient allowance", async function () {
      const { buyer, usdc, shop } = await loadFixture(deployFixture);

      // No approval → SafeERC20 reverts
      await expect(
        shop.connect(buyer).buyItem(1n, 1n, await usdc.getAddress())
      ).to.be.rejected;
    });

    it("rejects insufficient balance", async function () {
      const { other, usdc, shop } = await loadFixture(deployFixture);
      const shopAddr = await shop.getAddress();
      await usdc.connect(other).approve(shopAddr, 100_000n);

      // `other` has no balance → SafeERC20 reverts
      await expect(
        shop.connect(other).buyItem(1n, 1n, await usdc.getAddress())
      ).to.be.rejected;
    });
  });

  // ── Admin functions ──────────────────────────────────────────────────
  describe("admin", function () {
    it("owner can add accepted token", async function () {
      const { owner, shop } = await loadFixture(deployFixture);
      const mockFactory = await ethers.getContractFactory("MockERC20");
      const newToken = await mockFactory.deploy("New", "NEW", 8);
      await newToken.waitForDeployment();
      const addr = await newToken.getAddress();

      await shop.connect(owner).setAcceptedToken(addr, 8);

      expect(await shop.acceptedTokens(addr)).to.equal(8n);
    });

    it("rejects setAcceptedToken with decimals=0", async function () {
      const { owner, usdc, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(owner).setAcceptedToken(await usdc.getAddress(), 0)
      ).to.be.rejectedWith("InvalidDecimals");
    });

    it("rejects setAcceptedToken with decimals < 6", async function () {
      const { owner, shop } = await loadFixture(deployFixture);
      const mockFactory = await ethers.getContractFactory("MockERC20");
      const lowDec = await mockFactory.deploy("Low", "LOW", 4);
      await lowDec.waitForDeployment();

      await expect(
        shop.connect(owner).setAcceptedToken(await lowDec.getAddress(), 4)
      ).to.be.rejectedWith("InvalidDecimals");
    });

    it("rejects setAcceptedToken with decimals > 18", async function () {
      const { owner, shop } = await loadFixture(deployFixture);
      const mockFactory = await ethers.getContractFactory("MockERC20");
      const highDec = await mockFactory.deploy("High", "HIGH", 24);
      await highDec.waitForDeployment();

      await expect(
        shop.connect(owner).setAcceptedToken(await highDec.getAddress(), 24)
      ).to.be.rejectedWith("InvalidDecimals");
    });

    it("rejects setAcceptedToken with address(0)", async function () {
      const { owner, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(owner).setAcceptedToken(ethers.ZeroAddress, 6)
      ).to.be.rejectedWith("InvalidAddress");
    });

    it("owner can remove accepted token", async function () {
      const { owner, usdc, shop } = await loadFixture(deployFixture);
      const addr = await usdc.getAddress();

      await shop.connect(owner).removeAcceptedToken(addr);

      expect(await shop.acceptedTokens(addr)).to.equal(0n);
    });

    it("re-adding a previously removed token works", async function () {
      const { owner, buyer, treasury, usdc, shop } = await loadFixture(deployFixture);
      const addr = await usdc.getAddress();
      const shopAddr = await shop.getAddress();

      await shop.connect(owner).removeAcceptedToken(addr);
      await shop.connect(owner).setAcceptedToken(addr, 6);

      await usdc.connect(buyer).approve(shopAddr, 25_000n);
      await shop.connect(buyer).buyItem(2n, 1n, addr);

      expect(await usdc.balanceOf(treasury.address)).to.equal(25_000n);
    });

    it("rejects setTreasury to address(0)", async function () {
      const { owner, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(owner).setTreasury(ethers.ZeroAddress)
      ).to.be.rejectedWith("InvalidAddress");
    });

    it("rejects setTreasury to same address", async function () {
      const { owner, treasury, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(owner).setTreasury(treasury.address)
      ).to.be.rejectedWith("SameTreasury");
    });

    it("disableItem delists without changing price", async function () {
      const { owner, shop } = await loadFixture(deployFixture);

      await shop.connect(owner).disableItem(1n);
      const [price, enabled] = await shop.getItem(1n);

      expect(price).to.equal(100_000n);
      expect(enabled).to.equal(false);
    });

    it("setItems configures multiple items in batch", async function () {
      const { owner, shop } = await loadFixture(deployFixture);

      await shop.connect(owner).setItems([3n, 4n], [50_000n, 75_000n], [true, false]);

      const [price3, enabled3] = await shop.getItem(3n);
      expect(price3).to.equal(50_000n);
      expect(enabled3).to.equal(true);

      const [price4, enabled4] = await shop.getItem(4n);
      expect(price4).to.equal(75_000n);
      expect(enabled4).to.equal(false);
    });

    it("setItems reverts on length mismatch", async function () {
      const { owner, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(owner).setItems([3n, 4n], [50_000n], [true, false])
      ).to.be.rejectedWith("LengthMismatch");
    });

    it("setItems reverts if any price is zero", async function () {
      const { owner, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(owner).setItems([3n, 4n], [50_000n, 0n], [true, true])
      ).to.be.rejectedWith("InvalidPrice");
    });

    it("non-owner cannot call admin functions", async function () {
      const { buyer, usdc, shop } = await loadFixture(deployFixture);

      await expect(
        shop.connect(buyer).setAcceptedToken(await usdc.getAddress(), 6)
      ).to.be.rejected;

      await expect(shop.connect(buyer).setItem(3n, 50_000n, true)).to.be.rejected;
      await expect(shop.connect(buyer).setTreasury(buyer.address)).to.be.rejected;
      await expect(shop.connect(buyer).pause()).to.be.rejected;
    });
  });

  // ── Pause ────────────────────────────────────────────────────────────
  describe("pause", function () {
    it("blocks purchases when paused", async function () {
      const { owner, buyer, usdc, shop } = await loadFixture(deployFixture);
      const shopAddr = await shop.getAddress();

      await shop.connect(owner).pause();
      await usdc.connect(buyer).approve(shopAddr, 100_000n);

      await expect(
        shop.connect(buyer).buyItem(1n, 1n, await usdc.getAddress())
      ).to.be.rejectedWith("EnforcedPause()");
    });

    it("resumes purchases after unpause", async function () {
      const { owner, buyer, treasury, usdc, shop } = await loadFixture(deployFixture);
      const shopAddr = await shop.getAddress();

      await shop.connect(owner).pause();
      await shop.connect(owner).unpause();

      await usdc.connect(buyer).approve(shopAddr, 100_000n);
      await shop.connect(buyer).buyItem(1n, 1n, await usdc.getAddress());

      expect(await usdc.balanceOf(treasury.address)).to.equal(100_000n);
    });
  });

  // ── Upgrade ──────────────────────────────────────────────────────────
  describe("proxy upgrade", function () {
    it("preserves state after upgrade", async function () {
      const { owner, shop } = await loadFixture(deployFixture);

      // Read state before upgrade
      const [priceBefore, enabledBefore] = await shop.getItem(1n);

      // Upgrade to same implementation (simulates upgrade)
      const shopV2Factory = await ethers.getContractFactory("ShopUpgradeable");
      const upgraded = await upgrades.upgradeProxy(
        await shop.getAddress(),
        shopV2Factory,
        { unsafeAllow: ["constructor"] }
      );

      // Verify state preserved
      const [priceAfter, enabledAfter] = await upgraded.getItem(1n);
      expect(priceAfter).to.equal(priceBefore);
      expect(enabledAfter).to.equal(enabledBefore);
    });
  });
});
